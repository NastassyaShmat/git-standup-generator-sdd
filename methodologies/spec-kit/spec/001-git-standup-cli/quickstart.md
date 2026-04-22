# Quickstart: Git Standup CLI Tool

**Branch**: `001-git-standup-cli` | **Phase**: 1 — Design & Contracts  
**Generated**: 2026-04-20

---

## Prerequisites

- **Node.js ≥ 18** (LTS): `node --version`
- **git** in PATH: `git --version`
- **npm** (for install only, not for runtime)

---

## Installation

```bash
# Clone or navigate to the repo
cd /path/to/git-standup-generator

# Install devDependencies (TypeScript compiler, ESLint, @types/node)
npm install

# Build the TypeScript source
npm run build

# Link the CLI globally so it is available as `git-standup` and `git standup`
npm link
```

After `npm link`, the `git-standup` binary is available globally:

```bash
git-standup --version
git standup --version   # via git subcommand convention
```

---

## Common Invocations

### Daily standup (default — yesterday's commits by current git user)

```bash
git-standup
```

### Custom time range (long weekend, Monday standup)

```bash
git-standup --since="3 days ago"
git-standup --since="last Friday" --until="now"
```

### Review a teammate's work

```bash
git-standup --author="alice@example.com"
```

### Markdown output (for PR description or wiki)

```bash
git-standup --format=markdown
```

### JSON output (pipe into another tool)

```bash
git-standup --format=json | jq '.summary'
```

### Group by branch (feature-level view)

```bash
git-standup --group-by=branch
```

### Group by file path prefix (codebase area view)

```bash
git-standup --group-by=path
```

### Include fixup commits in the report (override default exclusion)

```bash
# Default excludes "merge" and "wip". Replace with only "wip" to keep merge commits:
git-standup --exclude="wip"

# Exclude merge, wip, and fixup!:
git-standup --exclude="merge,wip,fixup!"
```

### Save to a file and history store

```bash
git-standup --format=markdown --output=standup.md --save
```

### Run against a different repository

```bash
git-standup --repo=/path/to/other/repo
```

---

## Development Commands

```bash
# Type-check only (no emit)
npm run typecheck

# Build (compiles src/ → dist/)
npm run build

# Run all tests (unit + integration)
npm test

# Lint
npm run lint
```

---

## Project Layout

```
src/
├── types.ts             # GitCommit, StandupEntry, StandupReport, CliOptions
├── git-reader.ts        # I/O: spawn git log
├── commit-parser.ts     # Pure: raw git output → GitCommit[]
├── commit-filter.ts     # Pure: GitCommit[] → filtered GitCommit[]
├── commit-grouper.ts    # Pure: GitCommit[] → grouped StandupEntry[]
├── report-formatter.ts  # Pure: grouped entries → StandupReport + string
├── history-store.ts     # I/O: read/write history.json
└── cli.ts               # Entry point

tests/
├── unit/                # One test file per pure module
└── integration/         # Full pipeline test against a fixture git repo
```
