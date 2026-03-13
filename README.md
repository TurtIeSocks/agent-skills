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
| `typescript-string-literals` | TypeScript string literal unions, template literal types, key remapping, typed route/event strings, and compile-time string parsing patterns. | `typescript-string-literals/SKILL.md` |

## Contributing new skills

1. Add a new folder at repo root.
2. Add `SKILL.md` with frontmatter (`name`, `description`) and clear usage instructions.
3. Optionally add `references/` and `evals/`.
4. Update the skills table in this README.
