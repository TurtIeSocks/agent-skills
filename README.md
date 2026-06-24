# agent-skills

Reusable prompt skills you can install into local AI coding agents.

## Table of Contents

- [What is in this repo](#what-is-in-this-repo)
- [Install](#install)
  - [Codex (native skills)](#codex-native-skills)
  - [Claude Code (slash command adapter)](#claude-code-slash-command-adapter)
  - [Gemini CLI (custom command adapter)](#gemini-cli-custom-command-adapter)
  - [Other tools](#other-tools)
- [Skills in this repo](#skills-in-this-repo)
- [Contributing new skills](#contributing-new-skills)

## What is in this repo

Each skill lives in its own folder and includes:

- `SKILL.md` (required instructions + metadata)
- Optional `references/` docs
- Optional `evals/` test data

## Install

### Codex (native skills)

Codex has native skill support and loads skill folders from:

- Project: `./.agents/skills/`
- User: `~/.agents/skills/`
- Optional extra source: `$CODEX_HOME/skills/`

Install by symlinking all repo skills into your user skill directory:

```bash
mkdir -p ~/.agents/skills
REPO="$(pwd)"
for d in "$REPO"/*; do
  [ -f "$d/SKILL.md" ] || continue
  ln -sfn "$d" ~/.agents/skills/"$(basename "$d")"
done
```

Windows (PowerShell):

```powershell
$dest = "$HOME\.agents\skills"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Get-ChildItem -Directory | Where-Object { Test-Path "$($_.FullName)\SKILL.md" } | ForEach-Object {
  New-Item -ItemType SymbolicLink -Force -Path (Join-Path $dest $_.Name) -Target $_.FullName | Out-Null
}
```

### Claude Code (slash command adapter)

Claude Code does not use Codex `SKILL.md` natively, but you can adapt each skill as a slash command markdown file.

Claude command locations:

- User: `~/.claude/commands/`
- Project: `.claude/commands/`

Quick adapter (copies each `SKILL.md` to a command file):

```bash
mkdir -p ~/.claude/commands
for d in ./*; do
  [ -f "$d/SKILL.md" ] || continue
  name="$(basename "$d")"
  cp "$d/SKILL.md" ~/.claude/commands/"$name".md
done
```

Use in Claude Code as `/project:typescript-string-literals` (project scope) or `/user:typescript-string-literals` (user scope), depending on where you installed it.

### Gemini CLI (custom command adapter)

Gemini CLI also needs an adapter. It uses TOML command files in:

- User: `~/.gemini/commands/`
- Project: `.gemini/commands/`

Minimal command file example:

```toml
# ~/.gemini/commands/typescript-string-literals.toml
description = "TypeScript string literal type patterns and safeguards."
prompt = """
Read and apply the guidance from the skill below.

<paste the SKILL.md content here>
"""
```

After adding the file, run it in Gemini CLI with:

```text
/typescript-string-literals
```

### Other tools

If a tool supports user-defined prompt files or slash commands, this repo can be adapted by:

1. One skill folder -> one command/prompt file.
2. Copy `SKILL.md` content into that platform’s command format.
3. Use the folder name as the command name for consistency.

## Skills in this repo

| Skill | Description | Path |
| --- | --- | --- |
| `leaflet` | Build interactive maps with Leaflet (vanilla + React Leaflet). Markers, popups, GeoJSON, tile providers, plugins, and common pitfalls (blank tiles, SSR crashes, broken marker icons). | `leaflet/SKILL.md` |
| `liquid-glass-css` | Web/CSS counterpart to iOS liquid-glass-design: layered "liquid glass"/glassmorphism for vanilla CSS, Tailwind v4, and React. 6-layer material model, 3 fidelity levels (incl. SVG refraction), presets, 5 components, and Tier A/B morphing. | `liquid-glass-css/SKILL.md` |
| `rubber-duck-trace` | Plain-language, step-by-step walkthroughs of how code runs. Three modes — documentation (committable trace.md), in-chat explanation, and debugging (find the gap between intended and actual behavior). | `rubber-duck-trace/SKILL.md` |
| `systematic-refactor` | Pre-refactor workflow: trace existing app, gather refactor goals from user, assess keep-vs-rewrite per module, build old→new function/module map. Runs before `brainstorming` or `writing-plans` on multi-module rewrites, ports, or architecture changes. | `systematic-refactor/SKILL.md` |
| `tanstack-form` | Build forms with TanStack Form + shadcn/ui + Zod. Render-prop field pattern, Zod schema validation, all shadcn field types, plus array, async, and dependent fields. | `tanstack-form/SKILL.md` |
| `turfjs` | Routing guide to the Turf.js v7 geospatial API. Pick the right function for distance, area, buffer, point-in-polygon, intersection, clustering, and GeoJSON manipulation. Pairs with map libraries (Leaflet, Mapbox GL, etc.) for draw-then-compute flows. | `turfjs/SKILL.md` |
| `typescript-string-literals` | TypeScript string literal unions, template literal types, key remapping, typed route/event strings, and compile-time string parsing patterns. | `typescript-string-literals/SKILL.md` |
| `zustand-subscription-patterns` | Use when wiring React components to a Zustand store and deciding how to subscribe. | `zustand-subscription-patterns/SKILL.md` |

## Contributing new skills

1. Add a new folder at repo root.
2. Add `SKILL.md` with frontmatter (`name`, `description`) and clear usage instructions.
3. Optionally add `references/` and `evals/`.
4. Update the skills table in this README.
