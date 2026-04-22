# Implementation Plan: Git Standup CLI Tool

**Branch**: `001-git-standup-cli` | **Date**: 2026-04-20 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `spec/001-git-standup-cli/spec.md`

**Note**: This file is the `/speckit.plan` command output. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Build a zero-dependency TypeScript CLI tool (`git-standup`) that reads a local git repository's commit history via a single `git log` invocation, filters out noise (merge commits, WIP prefixes), groups meaningful commits by conventional commit type / branch / file path prefix, and outputs a human-readable standup report to stdout or a file in text, markdown, or JSON format. Reports can be appended to a local history file at `~/.git-standup/history.json`.

## Technical Context

**Language/Version**: TypeScript (strict mode) / Node.js ≥ 18 (LTS)  
**Primary Dependencies**: None — `node:child_process`, `node:fs`, `node:path`, `node:os`, `node:util` (built-ins) + git CLI  
**Storage**: `~/.git-standup/history.json` (append-only JSON array; one entry per `--save` invocation)  
**Testing**: Node.js built-in `node:test` + `node:assert` (zero devDependency test runner, available since Node 18)  
**Target Platform**: macOS 12+, Ubuntu 20.04+, WSL2 (Windows 10/11)  
**Project Type**: CLI tool  
**Performance Goals**: < 2 s end-to-end for repositories with up to 10,000 commits  
**Constraints**: Zero npm runtime dependencies; single `git log` invocation per execution; `any` type forbidden  
**Scale/Scope**: Single-user, single-repo standup generation; history file grows by ~1 entry/day indefinitely

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Zero External Dependencies | ✅ PASS | `package.json` declares zero `dependencies`; all runtime functionality uses Node.js built-in modules (`node:child_process`, `node:fs`, `node:path`, `node:os`, `node:util`) + git CLI |
| II | TypeScript Strict Mode | ✅ PASS | `tsconfig.json` sets `"strict": true`; `any` banned via `@typescript-eslint/no-explicit-any` lint rule |
| III | Performance Envelope < 2s / 10k commits | ✅ PASS | Single `git log` invocation with all filters as native git flags (`--author`, `--since`, `--until`, `--no-merges`); all grouping and formatting operate in-memory on the parsed array; no additional subprocess calls after git-reader |
| IV | Cross-Platform (macOS, Linux, WSL2) | ✅ PASS | All file paths use `node:path`; `child_process.spawn` called with `shell: false`; no platform-specific shell syntax in any module |
| V | Single Responsibility — Pure Functions | ✅ PASS | Seven modules with enforced I/O boundary: `git-reader`, `history-store`, and `cli` perform I/O; `commit-parser`, `commit-filter`, `commit-grouper`, and `report-formatter` are pure (same input → same output, no side effects) |
| VI | Unit + Integration Tests | ✅ PASS | Unit tests for all four pure business-logic modules; at least one integration test creates a temporary git repository with a known fixture commit set, invokes the full pipeline, and asserts the output |

**Post-design re-check**: No new violations introduced in Phase 1. All constraints satisfied by the chosen module split, single git call design, and data pipeline structure.

## Project Structure

### Documentation (this feature)

```text
spec/001-git-standup-cli/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── cli.md           #   CLI flags contract + output format schemas
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── types.ts             # Shared type definitions: GitCommit, StandupEntry, StandupReport, CliOptions
├── git-reader.ts        # I/O — spawn git log, collect stdout, return raw output string
├── commit-parser.ts     # Pure — raw git output string → GitCommit[]
├── commit-filter.ts     # Pure — GitCommit[] + exclusion patterns → GitCommit[]
├── commit-grouper.ts    # Pure — GitCommit[] + GroupBy strategy → Map<string, StandupEntry[]>
├── report-formatter.ts  # Pure — grouped entries + report meta → StandupReport + formatted string
├── history-store.ts     # I/O — read/write/append ~/.git-standup/history.json
└── cli.ts               # I/O — entry point: parseArgs → validate → orchestrate pipeline → output

tests/
├── unit/
│   ├── commit-parser.test.ts
│   ├── commit-filter.test.ts
│   ├── commit-grouper.test.ts
│   └── report-formatter.test.ts
└── integration/
    └── pipeline.test.ts  # git init fixture repo → run full pipeline → assert output shape
```

**Structure Decision**: Option 1 (single project). The CLI tool has a linear, pipeline-oriented architecture. Seven named modules map directly to the seven responsibilities from constitution principle V. `types.ts` is a shared type-only module with no business logic. No web layer, no backend/frontend split.
