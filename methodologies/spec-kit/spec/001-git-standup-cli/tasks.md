# Tasks: Git Standup CLI Tool

**Branch**: `001-git-standup-cli` | **Date**: 2026-04-20  
**Input**: Design documents from `spec/001-git-standup-cli/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/cli.md ✅  
**Tests**: Unit tests for all four pure modules + one integration test (constitution principle VI)

**Organization**: Tasks grouped by user story (P1 → P4) to enable incremental delivery. Tests are written first — each test task must be written and confirmed failing before its implementation task begins.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared state dependencies)
- **[Story]**: User story this task belongs to (US1–US7, or SETUP/FOUND)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize project scaffolding — no user story work can begin until this phase is complete.

- [x] T001 [SETUP] Create `package.json` with `name`, `version`, `type: "module"`, `bin: { "git-standup": "dist/cli.js" }`, `scripts` (`build`, `typecheck`, `test`, `lint`), `devDependencies` (`typescript`, `@types/node`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint`)
- [x] T002 [P] [SETUP] Create `tsconfig.json` with `strict: true`, `target: "ES2022"`, `module: "Node16"`, `moduleResolution: "Node16"`, `outDir: "dist"`, `rootDir: "src"`, `declaration: true`
- [x] T003 [P] [SETUP] Create `tsconfig.test.json` extending `tsconfig.json` with `rootDir: "."` (covers both `src/` and `tests/`) for running tests without a separate build step
- [x] T004 [P] [SETUP] Create `.eslintrc.json` with `@typescript-eslint` plugin, `no-explicit-any` set to `error`, `strict` parserOptions
- [x] T005 [P] [SETUP] Create `src/` and `tests/unit/` and `tests/integration/` directory stubs (`.gitkeep` files)

**Checkpoint**: `npm install` succeeds; `npm run typecheck`, `npm run build`, and `npm test` are runnable (may fail on missing source — that is expected)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared type definitions that every module imports. Must be complete before any module is implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 [FOUND] Create `src/types.ts` — export `GitCommit`, `StandupEntry`, `CommitType`, `StandupReport`, `CliOptions` interfaces exactly as defined in `data-model.md`; no business logic, no imports beyond types

**Checkpoint**: `npm run typecheck` passes with `src/types.ts` as the only source file

---

## Phase 3: User Story 1 — Generate a Quick Daily Standup (Priority: P1) 🎯 MVP

**Goal**: `git-standup` with no arguments reads yesterday's commits by the current git user, filters merge/WIP noise, groups by conventional commit type, and prints a clean text report to stdout.

**Independent Test**: Run `git-standup` in any git repository with recent commits — a readable text report appears.

### Tests for User Story 1 — Write First, Confirm Failing ⚠️

> All five test tasks below MUST be written and confirmed failing (`npm test` shows the test file but all cases red) before any implementation task in this phase begins.

- [x] T007 [P] [US1] Write `tests/unit/commit-parser.test.ts` — unit tests for `parseCommits(raw: string): GitCommit[]`:
  - Empty string → `[]`
  - Single well-formed record → one `GitCommit` with all fields populated correctly
  - Record with branch backfill: second commit has no ref decoration → inherits branch from prior commit
  - Record with `isMerge: true` when parent count > 1 (simulate via parser logic)
  - Record with empty subject → `subject` set to `"(no message)"`
  - Record with invalid date → commit is skipped; stderr warning emitted
  - Record with hash that is not 40 hex chars → commit is skipped
  - Multi-commit raw string → correct `GitCommit[]` length and field values

- [x] T008 [P] [US1] Write `tests/unit/commit-filter.test.ts` — unit tests for `filterCommits(commits: GitCommit[], patterns: string[]): GitCommit[]`:
  - `patterns: []` → all commits pass through unchanged
  - `patterns: ["merge"]` + a commit with `isMerge: true` → commit excluded
  - `patterns: ["merge"]` + a commit with `isMerge: false` → commit included
  - `patterns: ["wip"]` + a commit with subject `"WIP: something"` (case-insensitive) → excluded
  - `patterns: ["wip"]` + a commit with subject `"feat: add wip counter"` → included (not a prefix match)
  - `patterns: ["merge", "wip", "fixup!"]` → all three patterns applied; only clean commits remain
  - Default patterns `["merge", "wip"]` applied to a five-commit fixture → correct subset returned

- [x] T009 [P] [US1] Write `tests/unit/commit-grouper.test.ts` — unit tests for `groupCommits(commits: GitCommit[], groupBy: 'type' | 'branch' | 'path'): Map<string, StandupEntry[]>`:
  - `groupBy: "type"` + conventional commit `"feat: add login"` → key `"feat"`, message `"add login"`, hash is 7-char short hash
  - `groupBy: "type"` + non-conventional subject `"random message"` → key `"other"`, message verbatim
  - `groupBy: "type"` with mixed types → correct keys and entry counts
  - `groupBy: "branch"` → entries keyed by `commit.branch`; commit with `branch: "unknown"` → key `"unknown"`
  - `groupBy: "path"` + commit with `files: ["src/api/routes.ts"]` → key `"src"`
  - `groupBy: "path"` + commit with `files: ["README.md"]` → key `"root"` (no slash)
  - `groupBy: "path"` + commit with `files: []` → key `"root"`
  - Result map has groups sorted by entry count descending; entries within each group sorted by timestamp descending

- [x] T010 [P] [US1] Write `tests/unit/report-formatter.test.ts` — unit tests for `formatReport(grouped: Map<string, StandupEntry[]>, meta: ReportMeta): { report: StandupReport; formatted: string }`:
  - **StandupReport shape**: `date`, `author`, `period`, `entries` (correct group keys + entries), `summary.commitCount`, `summary.branchesTouched`, `summary.typeDistribution`
  - `summary.typeDistribution` only includes types present in entries
  - `format: "text"` → output starts with `"What I did:\n"`, contains `"• <hash> <message>"` lines, ends with `"---\n<N> commit(s) across …"`
  - `format: "text"` with zero entries → `"No commits found for <author> in <period>."` (no header/footer)
  - `format: "markdown"` → starts with `"## What I did"`, group labels as `"### <label>"`, entries as `"- **<hash>** <message>"`
  - `format: "markdown"` with zero entries → `"_No commits found for <author> in <period>._"`
  - `format: "json"` → `JSON.parse(output)` equals the `StandupReport` object; `JSON.stringify(report, null, 2)` round-trips losslessly

- [x] T011 [US1] Write `tests/integration/pipeline.test.ts` — integration test covering the complete data pipeline:
  - **Setup**: Use `node:fs` + `node:child_process` to `git init` a temporary directory, set `user.email` and `user.name` locally, create files, and make 5 commits — 3 conventional feat/fix commits, 1 merge commit (via `git merge --no-ff`), 1 WIP commit
  - **Assertion — default run**: Invoke the full pipeline (`parseCommits → filterCommits → groupCommits → formatReport`) with default options (exclude `["merge","wip"]`, `groupBy: "type"`, `format: "text"`) against the fixture; assert exactly 3 entries in the result, merge and WIP commits absent, footer shows `3 commit(s)`, `feat` and `fix` groups present
  - **Assertion — JSON format**: Re-run with `format: "json"`; `JSON.parse` the output; assert `summary.commitCount === 3`, `entries` keys match expected types, `summary.branchesTouched` is non-empty
  - **Teardown**: Remove the temporary directory (`fs.rmSync(dir, { recursive: true })`)

### Implementation for User Story 1

- [x] T012 [US1] Implement `src/commit-parser.ts` — export `parseCommits(raw: string): GitCommit[]`; use `\x00` record separator and `\n` field separator matching the `git log --format` template from `research.md`; implement branch backfill; emit stderr warning and skip on validation failure; all unit tests in T007 must pass
- [x] T013 [US1] Implement `src/commit-filter.ts` — export `filterCommits(commits: GitCommit[], patterns: string[]): GitCommit[]`; special-case `"merge"` token; all other patterns are case-insensitive `startsWith` matches; all unit tests in T008 must pass
- [x] T014 [US1] Implement `src/commit-grouper.ts` — export `groupCommits(commits: GitCommit[], groupBy: 'type' | 'branch' | 'path'): Map<string, StandupEntry[]>`; include conventional-commit regex for type/description extraction; sort groups by entry count descending, entries by timestamp descending; all unit tests in T009 must pass
- [x] T015 [US1] Implement `src/report-formatter.ts` — export `formatReport(grouped: Map<string, StandupEntry[]>, meta: ReportMeta): { report: StandupReport; formatted: string }`; implement all three format renderers (text, markdown, JSON); all unit tests in T010 must pass
- [x] T016 [US1] Implement `src/git-reader.ts` — export `readGitLog(options: Pick<CliOptions, 'since' | 'until' | 'author' | 'repo'>): Promise<string>`; use `child_process.spawn` with `shell: false`; construct `git log` arguments with `--format`, `--name-only`, `--since`, `--until`, `--author`, `-z` separator; reject on non-zero exit or git not found
- [x] T017 [US1] Implement `src/cli.ts` — parse `process.argv` via `util.parseArgs`; resolve default `author` from `git config user.email`; orchestrate `readGitLog → parseCommits → filterCommits → groupCommits → formatReport`; print result to stdout; exit 0 on success, exit 1 with message on user error
- [x] T018 [US1] Run `npm test` and `npm run typecheck` — all unit tests (T007–T010) and the integration test (T011) must be green; zero TypeScript errors

**Checkpoint**: `git-standup` (after `npm run build && npm link`) prints a standup report when run in a repository with recent commits. `npm test` is fully green.

---

## Phase 4: User Story 2 — Custom Time Range and Author Filter (Priority: P2)

**Goal**: `--since`, `--until`, and `--author` flags are accepted, validated, and forwarded to the git query.

**Independent Test**: `git-standup --since="3 days ago" --author="alice@example.com"` — only matching commits appear.

### Tests for User Story 2 — Write First, Confirm Failing ⚠️

- [x] T019 [P] [US2] Extend `tests/unit/commit-parser.test.ts` (or add `tests/unit/cli-options.test.ts`) — unit tests for flag parsing edge cases:
  - `--since` value passed through verbatim to `CliOptions.since`
  - `--until` value passed through verbatim to `CliOptions.until`
  - `--author` value passed through verbatim to `CliOptions.author`
  - Missing `--author` defaults to `git config user.email` result (mock the git call)

### Implementation for User Story 2

- [x] T020 [US2] Update `src/cli.ts` — wire `--since`, `--until`, `--author` into `parseArgs` config; pass resolved values to `readGitLog`; all T019 tests pass

**Checkpoint**: `git-standup --since="3 days ago"` returns only commits from that window; `--author="colleague@example.com"` filters by author.

---

## Phase 5: User Story 3 — Output Format Selection (Priority: P2)

**Goal**: `--format=text|markdown|json` selects the output renderer; invalid values exit 1 with a clear message.

**Independent Test**: `git-standup --format=markdown` produces markdown-formatted output; `--format=json` produces valid JSON.

### Tests for User Story 3 — Write First, Confirm Failing ⚠️

- [x] T021 [P] [US3] Add format-validation tests to `tests/unit/report-formatter.test.ts` (or a new `tests/unit/format-validation.test.ts`):
  - `--format=text` → text output matches schema from `contracts/cli.md`
  - `--format=markdown` → markdown output matches schema
  - `--format=json` → output is valid JSON conforming to `StandupReport`
  - Invalid `--format=csv` → `cli.ts` exits 1 with message `"Invalid --format value 'csv'. Expected: text, markdown, json."`

### Implementation for User Story 3

- [x] T022 [US3] Update `src/cli.ts` — add `--format` to `parseArgs` config; validate against allowed values; pass to `formatReport`; all T021 tests pass

**Checkpoint**: All three formats produce correctly structured output per the contracts.

---

## Phase 6: User Story 4 — Grouping Strategy Selection (Priority: P3)

**Goal**: `--group-by=type|branch|path` selects the commit grouping strategy.

**Independent Test**: `git-standup --group-by=branch` shows commits organized under branch-name headings.

### Tests for User Story 4 — Write First, Confirm Failing ⚠️

- [x] T023 [P] [US4] Add grouping-strategy tests to `tests/unit/commit-grouper.test.ts` (branch and path strategies are already covered in T009; add invalid value validation):
  - `--group-by=branch` → commits keyed by branch name
  - `--group-by=path` → commits keyed by top-level directory prefix
  - Invalid `--group-by=author` → `cli.ts` exits 1

### Implementation for User Story 4

- [x] T024 [US4] Update `src/cli.ts` — add `--group-by` to `parseArgs` config; validate against `type|branch|path`; pass to `groupCommits`; all T023 tests pass

**Checkpoint**: Each grouping strategy produces distinct, correctly organized output.

---

## Phase 7: User Story 5 — Custom Exclusion Patterns (Priority: P3)

**Goal**: `--exclude="pattern1,pattern2"` replaces the default exclusion set entirely.

**Independent Test**: `git-standup --exclude="fixup!"` removes fixup commits while keeping merge commits.

### Tests for User Story 5 — Write First, Confirm Failing ⚠️

- [x] T025 [P] [US5] Add exclusion-override tests to `tests/unit/commit-filter.test.ts` (some already covered in T008; add):
  - `--exclude="fixup!"` → only `fixup!`-prefix commits excluded; merge commits pass through
  - `--exclude=""` (empty string) → all commits pass through (no filtering)
  - `--exclude="merge,wip,fixup!"` → all three patterns active; three different commits each excluded

### Implementation for User Story 5

- [x] T026 [US5] Update `src/cli.ts` — parse `--exclude` as comma-split string array; replace default `["merge","wip"]` entirely when flag is provided; all T025 tests pass

**Checkpoint**: `--exclude` correctly replaces defaults; custom patterns work case-insensitively.

---

## Phase 8: User Story 6 — File Output and History Saving (Priority: P4)

**Goal**: `--output=<path>` writes the report to a file; `--save` appends to `~/.git-standup/history.json`.

**Independent Test**: `git-standup --output=standup.md --save` writes the file and updates history.

### Tests for User Story 6 — Write First, Confirm Failing ⚠️

- [x] T027 [P] [US6] Write `tests/unit/history-store.test.ts` — unit tests for `appendToHistory(report: StandupReport, historyPath: string): Promise<void>`:
  - History file does not exist → directory + file created; file contains `[<report>]`
  - History file exists with valid array → new report appended; prior entries preserved; `savedAt` field present
  - History file exists with invalid JSON → file renamed to `history.json.bak.<timestamp>`; new `[]` written; save proceeds
  - Written entry contains all `StandupReport` fields plus `savedAt` as ISO 8601 string

### Implementation for User Story 6

- [x] T028 [US6] Implement `src/history-store.ts` — export `appendToHistory(report: StandupReport, historyPath: string): Promise<void>`; implement create/append/corrupt-recovery logic per `data-model.md`; all T027 tests pass
- [x] T029 [US6] Update `src/cli.ts` — add `--output` and `--save` to `parseArgs` config; write report to file when `--output` provided; call `appendToHistory` when `--save` set; exit 1 with clear message on file write failure

**Checkpoint**: `--output=standup.md` writes the file; `--save` appends a new entry to history; corrupt history is recovered gracefully.

---

## Phase 9: User Story 7 — External Repository Path (Priority: P4)

**Goal**: `--repo=<path>` validates the path as a git repository and uses it as the working directory for the git call.

**Independent Test**: `git-standup --repo=/path/to/other/repo` generates a report from that repository; an invalid path exits 1.

### Tests for User Story 7 — Write First, Confirm Failing ⚠️

- [x] T030 [P] [US7] Add repo-validation tests to `tests/integration/pipeline.test.ts` (or a new `tests/integration/repo-path.test.ts`):
  - Valid external repo path → report generated correctly (use the fixture repo from T011 at a non-cwd path)
  - Non-existent path → process exits 1 with `"--repo path does not exist"` message
  - Path exists but is not a git repo (no `.git/`) → process exits 1 with clear message

### Implementation for User Story 7

- [x] T031 [US7] Update `src/cli.ts` — add `--repo` to `parseArgs` config; validate `.git` presence using `node:fs.existsSync`; pass validated path as cwd to `readGitLog`; all T030 tests pass

**Checkpoint**: `--repo` works correctly for valid repos; invalid paths produce user-friendly error messages and exit 1.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final wiring, meta flags, and validation across all user stories.

- [x] T032 [P] Add `--help` / `-h` flag to `src/cli.ts` — print usage text (synopsis, all flags with defaults, examples) and exit 0 (FR-016)
- [x] T033 [P] Add `--version` / `-v` flag to `src/cli.ts` — read `version` from `package.json` at runtime and print it, then exit 0 (FR-017)
- [x] T034 [P] Verify `package.json` `bin` field points to `dist/cli.js`; confirm `npm run build && npm link` makes `git-standup` available globally; run `git-standup --version` and `git standup --version`
- [x] T035 Run `npm test` (full suite: unit + integration) — all tests green (66/66)
- [x] T036 Run `npm run lint` — zero ESLint errors; `no-explicit-any` rule enforced
- [x] T037 Run `npm run typecheck` — zero TypeScript errors in strict mode
- [ ] T038 Run the quickstart.md validation: execute each sample invocation in `quickstart.md` against a real repository and confirm expected output shape

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 — implements the core pipeline; all 4 pure-module unit tests + integration test live here
- **US2/US3 (Phases 4–5)**: Depend on Phase 3 (US1); can be worked in parallel by different developers
- **US4/US5 (Phases 6–7)**: Depend on Phase 3; can be worked in parallel
- **US6/US7 (Phases 8–9)**: Depend on Phase 3; can be worked in parallel
- **Polish (Phase 10)**: Depends on all desired user stories being complete

### Parallel Opportunities

- T002, T003, T004, T005 in Phase 1 can all run in parallel
- T007, T008, T009, T010 (unit tests) in Phase 3 can all be written in parallel
- T012, T013, T014, T015 (pure module implementations) can all be implemented in parallel once their respective tests are written and failing
- Phases 4–9 (US2–US7) can all be worked in parallel once Phase 3 is complete

### Within Each User Story

1. Write tests → confirm they fail
2. Implement → confirm tests pass
3. Run full suite (`npm test`) before moving to next story

---

## Test Coverage Summary (Constitution Principle VI)

| Test File | Type | Module Under Test | Key Scenarios |
|-----------|------|------------------|---------------|
| `tests/unit/commit-parser.test.ts` | Unit | `commit-parser.ts` (pure) | Empty input, field parsing, branch backfill, validation errors |
| `tests/unit/commit-filter.test.ts` | Unit | `commit-filter.ts` (pure) | Merge token, prefix patterns, case-insensitivity, empty patterns |
| `tests/unit/commit-grouper.test.ts` | Unit | `commit-grouper.ts` (pure) | type/branch/path strategies, conventional regex, sort order |
| `tests/unit/report-formatter.test.ts` | Unit | `report-formatter.ts` (pure) | All three formats, zero-commit case, StandupReport shape |
| `tests/unit/history-store.test.ts` | Unit | `history-store.ts` (I/O) | Create, append, corrupt-recovery |
| `tests/integration/pipeline.test.ts` | Integration | Full pipeline | `git init` fixture → parse → filter → group → format; text + JSON assertions |

All four pure business-logic modules (`commit-parser`, `commit-filter`, `commit-grouper`, `report-formatter`) have dedicated unit test files. The integration test exercises the complete data pipeline against a real temporary git repository, satisfying constitution principle VI.

---

## Notes

- `[P]` tasks touch different files and have no shared state — safe to run in parallel
- Write tests FIRST; verify they fail before writing implementation
- Run `npm test` (full suite) after each phase checkpoint before moving on
- The integration test in `tests/integration/pipeline.test.ts` (T011) is the single required integration test for principle VI; additional integration coverage (T030) for the `--repo` flag path is a bonus
- Commit after each phase checkpoint (or each completed task if working solo)
- `any` type is banned by ESLint — use `unknown` + type guards where necessary
