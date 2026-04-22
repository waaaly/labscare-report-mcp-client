---
name: commit-with-readme
description: |
  Summarize current changes before commit and update README.md based on commit type.
  Use when user is about to commit changes and wants to keep README in sync with the project.
  
  This skill combines:
  - @skill://git-commit - for generating conventional commit messages
  - @skill://create-readme - for updating README.md based on changes
  
  Workflow:
  1. Analyze git diff to understand changes
  2. Generate conventional commit message (type, scope, description)
  3. Summarize changes for the user
  4. Based on commit type, determine if README needs updating:
     - feat: Update features section
     - fix: Update bug fixes or changelog
     - docs: Update documentation sections
     - refactor: Update architecture/implementation details
     - perf: Update performance notes
     - build/ci: Update setup/installation instructions
  5. Execute git commit
  6. If README was updated, stage and commit it as a separate docs commit
  
  Dependencies:
  - @skill://git-commit
  - @skill://create-readme
---

# Commit with README Update

Summarize current changes before commit and update README.md based on commit type.

## Role

You are a helpful assistant that helps users commit their changes while keeping the project README.md in sync.

## Task

### Step 1: Analyze Changes

First, analyze the current git status and diff:

```bash
# Check what files have changed
git status --porcelain

# View the diff (staged or unstaged)
git diff --staged  # if files are staged
git diff           # if no staged files
```

### Step 2: Summarize Changes for User

Provide a clear summary of what has been modified:

**Summary Format:**
```
📋 Changes Summary:
├── Files modified: [N] files
├── New files: [list]
├── Modified: [list]
├── Deleted: [list]
└── Change type analysis:
    ├── Features: [yes/no + brief description]
    ├── Bug fixes: [yes/no + brief description]
    ├── Documentation: [yes/no]
    ├── Tests: [yes/no]
    └── Breaking changes: [yes/no]
```

### Step 3: Generate Commit Message

Using conventional commits format, determine:
- **Type**: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- **Scope**: affected module/area
- **Description**: concise summary (<72 chars)

**Proposed commit message:**
```
<type>[scope]: <description>
```

Ask user for confirmation or modification.

### Step 4: Determine README Update Needs

Based on commit type, decide if README needs updating:

| Commit Type | README Impact | Action |
|-------------|---------------|--------|
| `feat` | High - New features | Update Features section |
| `fix` | Medium - Bug fixes | Update if fixes affect usage |
| `docs` | High - Documentation | Update relevant sections |
| `refactor` | Low-Medium | Update if API changes |
| `perf` | Medium | Add performance notes |
| `build` | Low | Update setup if needed |
| `ci` | Low | Usually no README change |
| `test` | Low | Usually no README change |
| `chore` | Low | Usually no README change |

### Step 5: Update README (if needed)

If README update is required:

1. Use @skill://create-readme to review and update README
2. Focus updates on relevant sections based on change type:
   - **New features**: Add to Features section
   - **Bug fixes**: Mention in Changelog or Fixed section
   - **API changes**: Update Usage/Examples
   - **Performance**: Add Performance section or notes

3. Generate a summary of README changes

### Step 6: Execute Commits

**Commit Order:**

1. **First commit** - Main changes:
```bash
git add [changed files excluding README]
git commit -m "<type>[scope]: <description>"
```

2. **Second commit** (only if README was updated):
```bash
git add README.md
git commit -m "docs(readme): update documentation for <type>/<scope> changes"
```

## Example Workflow

**User:** "我要提交当前的修改"

**Assistant:**
```
📋 Changes Summary:
├── Files modified: 5 files
├── Modified:
│   ├── src/components/Button.tsx
│   ├── src/styles/button.css
│   └── package.json
├── New files:
│   └── src/components/Button.test.tsx
└── Change type analysis:
    ├── Features: ✅ 新增 Button 组件支持多种变体
    ├── Bug fixes: ❌ 无
    ├── Documentation: ❌ 需要更新
    ├── Tests: ✅ 新增单元测试
    └── Breaking changes: ❌ 无

📝 Proposed commit:
feat(components): add Button component with variants

📖 README Update Required:
由于添加了新功能，建议更新 README 的 Features 部分。

是否继续提交？(y/n/edit)
```

**After user confirmation:**
```bash
# Commit 1: Main feature
git add src/ package.json
git commit -m "feat(components): add Button component with variants"

# Commit 2: README update
git add README.md
git commit -m "docs(readme): add Button component documentation"
```

## Safety Protocol

- Never commit sensitive files (.env, credentials, private keys)
- Never force push to main/master
- Always ask before creating breaking changes
- Keep README updates focused and relevant to changes
