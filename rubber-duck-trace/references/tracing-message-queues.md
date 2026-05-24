# Playbook: tracing message queues & event-driven flows

Read this before tracing anything where a producer publishes to a broker and a consumer handles it later — queues, topics, streams, pub/sub, webhooks-into-a-queue, Kafka / SQS / RabbitMQ / NATS / SNS, `emit`/`publish`/`consume`/`ack`. Event-driven flows break the most basic trace assumption of all: that there *is* a call stack. A producer hands off a message and returns; the "then" happens in a different process, at a different time, possibly more than once. A trace that writes "publishes X, then the handler does Y, then returns" has quietly invented a synchronous call that doesn't exist.

This playbook *extends* the four universal traps in the SKILL. Mental model first, then this domain's flavor of each trap, then phrasing, then a worked trace.

## The mental model you must trace against

The shape is **producer → broker → consumer**, and the two halves are *decoupled in time and space*: the consumer runs later, in another process, and the producer never waits for it. The load-bearing facts:

- **Publishing returns once the broker accepts the message** — not once it's handled. The producer's story usually ends at "the broker has it." Everything downstream is a *separate* timeline.
- **Delivery is a probability, not a guarantee.** Almost everything real is **at-least-once**: the broker promises the message arrives *at least* once, which means **duplicates happen** (on crashes, redelivery, timeouts). At-most-once can *lose* messages; exactly-once is rare, expensive, and usually really "at-least-once + idempotent consumer."
- **Ack closes the loop.** The consumer must acknowledge after processing; if it crashes or times out before acking, the broker **redelivers** — so the handler may run again. Whether you ack *before* or *after* the work decides loss-vs-duplication on a crash.
- **Order is not guaranteed** unless the system pins it (a Kafka partition key, an SQS FIFO queue, a single consumer). Multiple consumers and redelivery scramble order routinely.
- **Failure has its own path:** retry with backoff → after N attempts → **dead-letter queue (DLQ)**. The happy path acks; the sad path almost always gets skipped in traces.

So a trace follows the message *across the boundary*: where it's published, what broker/topic/partition holds it, who consumes it, what happens on success, and — crucially — what happens on duplicate, out-of-order, and failure.

## This domain's flavor of the four traps

- **🔀 Forks**
  - **Success vs failure** — success acks/commits/deletes; failure nacks → retry → (after N) → **DLQ**. Trace the DLQ branch; it's the one everyone forgets.
  - **Routing** — which topic/queue/partition does this land in (routing key, partition key, topic filter)? That decides who hears it.
  - **Fan-out** — pub/sub delivers a *copy* to every subscriber, so one event forks into N independent handler timelines. Competing-consumer queues do the opposite: one message goes to *one* of the group.

- **⚠️ Side effects**
  - **Publishing is the side effect that decouples** — after it, the producer is done; downstream effects fire elsewhere, later.
  - **At-least-once + non-idempotent handler = doubled effects.** A redelivered "charge the card" message charges twice. This is the canonical event-driven bug; flag any externally-visible effect in a consumer that lacks an idempotency key or dedup.
  - **Dual-write divergence** — writing to the DB *and* publishing an event as two separate steps: if one succeeds and the other fails, the system splits-brain. (The outbox pattern exists to fix exactly this.)
  - **Event cascades** — a handler that emits more events can trigger chains, amplification, or loops. Follow them one hop and note where they go.

- **⏳ Async handoffs**
  - producer → broker → consumer is the handoff: **time-decoupled** (ms or hours) and **space-decoupled** (another process/host). Make explicit that the producer does *not* wait.
  - the **in-flight / visibility window**: a consumer claims a message and the broker hides it; if it isn't acked before the timeout, it reappears for *another* consumer — which can mean the same message processed twice, concurrently.
  - between emit and handle, the world moves on — the referenced entity may have changed or been deleted by the time the consumer reads the event.

- **🤫 Silent stuff**
  - **Duplicates** from at-least-once silently double effects when the handler isn't idempotent.
  - **Out-of-order arrival** — a trace that assumes events are handled in emit order is often just wrong.
  - **The DLQ nobody watches** — failures pile up invisibly while the happy path looks perfectly healthy.
  - **Poison messages** — one message that always fails, stuck looping through retries.
  - **Visibility timeout too short** → the same message handled by two consumers at once.
  - **Schema drift** — producer changes the event shape; consumers silently skip or break.

## How to phrase a step (right vs wrong)

> ❌ *Wrong:* "It publishes `OrderPlaced`, then the inventory service decrements stock, then returns."
> *(There's no synchronous call here. The producer returns at "published"; inventory runs later, independently, and might be down right now.)*

> ✅ *Right:* "It publishes `OrderPlaced` to the broker (`order.ts:40`) and returns to the caller immediately — it does *not* wait for any consumer. The inventory service consumes the event on its own timeline; if it's offline, the message simply waits in the queue until it's back."

> ❌ *Wrong:* "The consumer receives the message and processes it once."

> ✅ *Right:* "The consumer processes the message (`worker.ts:15`), but delivery is at-least-once — if it crashes after charging but before `ack` (`:22`), the broker redelivers and the handler runs *again*. ⚠️ Unless the charge is keyed on an idempotency token, that's a double charge."

## A worked example (top-down, dev-savvy)

An order placement on a pub/sub topic with two subscribers:

1. **`placeOrder()` writes the order and publishes `OrderPlaced`** — `order.ts:38` — it persists the row, hands `OrderPlaced` to the broker, and returns `200` to the user. Its story ends here; it never waits for fulfillment. ⚠️ Note the dual write: DB + publish are two steps — if the publish failed after the DB commit, the order would exist with no event.
2. **The broker holds `OrderPlaced` on the topic** — the producer is already done; this is a fresh timeline.
3. **🔀 Fan-out — two subscribers consume independently:**
   - **InventoryService** reads it, decrements stock, ⏳ then `ack`s (`inventory.ts:11`).
   - **PaymentService** reads the *same* event (its own copy), charges the card, then `ack`s (`payment.ts:19`).
4. **PaymentService crashes after the charge but before its `ack`** — 🤫 the broker never heard the ack, so after the visibility timeout it **redelivers** the message. A consumer picks it up again and charges a second time. ⚠️ Double charge — unless the charge is idempotent on the order id.
5. **If a consumer keeps failing**, after N retries the message lands in the **DLQ** (`dlq` topic) — where it sits until someone inspects it. The order looks "placed" to the user the whole time.

> **Where the duck would squint:** step 1's dual write (DB and broker can diverge), step 4's redelivery (duplicate effects without idempotency), the unmonitored DLQ in step 5, and the fact that nothing here guarantees Inventory and Payment ran in any particular order — or that either ran *at all* yet by the time the user sees `200`.

## Broker note

Semantics differ — pin them before tracing. **Kafka:** order is guaranteed only *within a partition*; consumers track an **offset**, and committing it before vs after processing decides loss-vs-duplication; "consumer groups" load-balance partitions. **SQS:** standard queues are unordered and at-least-once with a **visibility timeout**; FIFO queues add ordering + dedup. **RabbitMQ:** messages route through exchanges to queues by binding/routing key; per-message `ack`/`nack`, with order breakable by redelivery and multiple consumers. When the trace is broker-specific, say which guarantees apply; otherwise the producer→broker→consumer model above is enough.
