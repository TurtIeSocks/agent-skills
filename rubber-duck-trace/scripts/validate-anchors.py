#!/usr/bin/env python3
"""Validate anchors in a rubber-duck trace markdown file.

A rubber-duck trace claims `path/to/file.ext:NN` for every step — those anchors
are the trace's receipts. This script confirms they still resolve, so a trace
that drifted out of sync with the code surfaces *before* a reader trusts it.

Exit codes:
  0  every anchor resolves
  1  no anchors found, or input file missing
  2  one or more anchors broken (file missing, line out of range, blank line in --strict)

Usage:
    validate-anchors.py trace-login-flow.md
    validate-anchors.py trace-login-flow.md --root /path/to/repo
    validate-anchors.py trace-login-flow.md --strict
    validate-anchors.py trace-login-flow.md --refresh   # print code at each anchor
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# Match `path/to/file.ext:NN` inside backticks.
# Extensions kept generous; add new ones as needed.
ANCHOR_RE = re.compile(
    r"`([^`\s]+\.(?:tsx|ts|jsx|js|mjs|cjs|py|rs|go|rb|java|kt|swift|"
    r"cpp|cc|cxx|hpp|hh|hxx|c|h|cs|php|scala|sh|bash|zsh|"
    r"sql|md|yaml|yml|json|toml|lua|ex|exs|erl|clj|cljs|hs|ml|"
    r"dart|gleam|zig|nim|jl|r|m|mm)):(\d+)`"
)


def find_anchors(text: str) -> list[tuple[str, int, int]]:
    """Return list of (path, line_number, trace_line_where_referenced)."""
    results = []
    for trace_line_no, trace_line in enumerate(text.splitlines(), start=1):
        for match in ANCHOR_RE.finditer(trace_line):
            path, line_str = match.group(1), match.group(2)
            results.append((path, int(line_str), trace_line_no))
    return results


def validate(trace_path: Path, repo_root: Path, strict: bool, refresh: bool) -> int:
    text = trace_path.read_text()
    anchors = find_anchors(text)

    if not anchors:
        print(f"no anchors found in {trace_path}", file=sys.stderr)
        return 1

    bad = 0
    seen: set[tuple[str, int]] = set()
    for path, line, trace_line in anchors:
        key = (path, line)
        if key in seen and not refresh:
            continue
        seen.add(key)

        target = repo_root / path
        location = f"{trace_path.name}:{trace_line} -> `{path}:{line}`"

        if not target.exists():
            print(f"BROKEN  {location} — file does not exist")
            bad += 1
            continue

        try:
            lines = target.read_text().splitlines()
        except UnicodeDecodeError:
            print(f"SKIP    {location} — file is not text")
            continue

        if line < 1 or line > len(lines):
            print(
                f"BROKEN  {location} — line {line} out of range "
                f"(file has {len(lines)} lines)"
            )
            bad += 1
            continue

        content = lines[line - 1].strip()

        if strict and not content:
            print(f"WEAK    {location} — line {line} is blank/whitespace")
            bad += 1
            continue

        if refresh:
            snippet = content[:90] + ("…" if len(content) > 90 else "")
            print(f"OK      {location}  →  {snippet}")

    total = len(seen)
    ok = total - bad
    summary = f"{ok}/{total} anchors valid in {trace_path.name}"
    print(f"\n{summary}", file=sys.stderr)
    return 0 if bad == 0 else 2


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("trace", type=Path, help="path to trace markdown file")
    parser.add_argument(
        "--root",
        type=Path,
        default=Path.cwd(),
        help="repo root used to resolve anchor paths (default: current dir)",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="also flag anchors that point at blank/whitespace-only lines",
    )
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="print the actual line of code each anchor resolves to "
        "(use to spot anchors that still resolve but no longer match the narration)",
    )
    args = parser.parse_args()

    if not args.trace.exists():
        print(f"trace not found: {args.trace}", file=sys.stderr)
        return 1

    return validate(args.trace, args.root.resolve(), args.strict, args.refresh)


if __name__ == "__main__":
    sys.exit(main())
