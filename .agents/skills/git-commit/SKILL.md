---
description: |
  Execute git commit with conventional commit message analysis, intelligent staging, and message generation.
  Use when user asks to commit changes, create a git commit, or mentions "/commit".
  
  Supports:
  (1) Auto-detect type and scope from changes
  (2) Generate conventional commit messages from diff
  (3) Interactive commit with type/scope/description overrides
  (4) Intelligent file staging (logical grouping)

  Conventional Commits format:
  <type>[optional scope]: <description>
  
  [optional body]
  
  [optional footer(s)]

  Types:
  - feat: New feature
  - fix: Bug fix
  - docs: Documentation only
  - style: Formatting (no logic change)
  - refactor: Code restructuring
  - perf: Performance improvement
  - test: Adding/updating tests
  - build: Build system/dependencies
  - ci: CI configuration
  - chore: Maintenance/misc
  - revert: Revert commit

  Breaking changes:
  - Type/scope with !: feat!: remove deprecated endpoint
  - BREAKING CHANGE footer

  Best practices:
  - One logical change per commit
  - Present tense: "add" not "added"
  - Imperative mood: "fix bug" not "fixes bug"
  - Reference issues: Closes #123, Refs #456
  - Keep description under 72 characters
---

# Git Commit

Execute git commit with conventional commit message analysis, intelligent staging, and message generation.

## Usage

Use when user asks to commit changes, create a git commit, or mentions "/commit".

## Workflow

### Step 1: Analyze the Diff

```bash
# If files are staged, use staged diff
git diff --staged

# If no staged files, use working diff
git diff

# Check status
git status --porcelain
```

### Step 2: Stage Files (if needed)

```bash
# Stage specific files
git add path/to/file1 path/to/file2

# Stage by pattern
git add *.test.*
git add src/components/*

# Interactive staging
git add -p
```

⚠️ Never commit sensitive information (.env, credentials.json, private keys)

### Step 3: Generate Commit Message

Analyze the diff to determine:
- **Type**: What kind of change is this?
- **Scope**: What area/module is affected?
- **Description**: One-line summary (imperative mood, present tense, <72 chars)

### Step 4: Execute Commit

```bash
# Single line
git commit -m "<type>[scope]: <description>"

# Multi-line (with body/footer)
git commit -m "$(cat <<'EOF'
<type>[scope]: <description>

<optional body>

<optional footer>
EOF
)"
```

## Conventional Commits Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Types

| Type | Purpose |
|------|---------|
| feat | New feature |
| fix | Bug fix |
| docs | Documentation only |
| style | Formatting (no logic change) |
| refactor | Code restructuring |
| perf | Performance improvement |
| test | Adding/updating tests |
| build | Build system/dependencies |
| ci | CI configuration |
| chore | Maintenance/misc |
| revert | Revert commit |

## Breaking Changes

```bash
# Exclamation mark after type/scope
feat!: remove deprecated endpoint

# BREAKING CHANGE footer
feat: allow config to extend other configs

BREAKING CHANGE: `extends` key behavior changed
```

## Best Practices

- One logical change per commit
- Present tense: "add" not "added"
- Imperative mood: "fix bug" not "fixes bug"
- Reference issues: `Closes #123`, `Refs #456`
- Keep description under 72 characters

## Git Safety Protocol

- Never update git config
- Never run destructive commands (--force, hard reset) unless explicitly requested
- Never skip hooks (--no-verify) unless user asks
- Never force push to main/master
- If commit fails due to hooks, create new commit after fixing (don't amend)
