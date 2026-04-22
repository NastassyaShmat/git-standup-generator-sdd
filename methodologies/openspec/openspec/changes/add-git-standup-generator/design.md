# Design: git-standup-generator

## Overview

`git-standup` is a Node.js CLI organised as a strictly linear pipeline. The CLI
module parses arguments and orchestrates five data modules. Each data module is
a pure function over explicit input/output types; there is no shared mutable
state, no global configuration, and no cross-module back-talk. This makes every
stage independently unit-testable and keeps the data flow trivial to reason
about.

## Data Flow

```
CLI args ──► git-reader ──► commit-filter ──► commit-grouper ──► report-formatter ──► output (stdout | file)
                                                                                     ╲
                                                                                      ──► history-store (when --save)
```

Contract between stages:

| Stage              | Input                                   | Output                                   |
| ------------------ | --------------------------------------- | ---------------------------------------- |
| `cli`              | `process.argv`                          | `CliOptions`                             |
| `git-reader`       | `CliOptions` (repo, since, until, …)    | `GitCommit[]`                            |
| `commit-filter`    | `GitCommit[]`, `exclude` patterns       | `GitCommit[]` (filtered)                 |
| `commit-grouper`   | `GitCommit[]`, `GroupBy`                | `Record<string, StandupEntry[]>`         |
| `report-formatter` | grouped entries, `OutputFormat`, meta   | `string` (text / markdown / JSON)        |
| `history-store`    | `StandupReport`                         | write to `~/.git-standup/history.json`   |

## Module Design

### `cli` (`src/cli.ts`)

- Uses `node:util.parseArgs` exclusively for argument parsing. No runtime deps.
- Normalizes inputs into a `CliOptions` object with all defaults resolved:
  - `repo` defaults to `process.cwd()`.
  - `author` defaults to the output of `git config user.email` (executed in
    `repo`). If that fails, the value is omitted and git-reader does not pass
    `--author`.
  - `since` / `until` default to `"yesterday"` / `"now"`.
  - `format` defaults to `"text"`, `group-by` to `"type"`.
  - `exclude` defaults to `["merge", "wip"]`, parsed as a comma-separated list
    when supplied. Matching is case-insensitive substring match on the full
    commit subject.
- Validates enum flags (`format`, `group-by`) and prints a usage string on
  invalid input, exiting with code `2`.
- Exports a `run(argv: string[])` function so the pipeline can be exercised
  from tests without spawning a subprocess. `bin/git-standup` only calls `run`.

### `git-reader` (`src/git-reader.ts`)

- Spawns `git log` via `node:child_process.spawn` inside `repo` with a stable,
  parseable format string using a unit-separator record delimiter:
  `--pretty=format:%H%x1f%an%x1f%ae%x1f%aI%x1f%P%x1f%s` and a record
  terminator of `%x1e`. This avoids any ambiguity from commit messages that
  contain newlines or pipes.
- Adds `--since`, `--until`, and (when set) `--author` flags. `--no-merges` is
  **not** applied here — merge classification happens in the filter so that
  downstream code can report the count of excluded merges if needed.
- Resolves the branch for each commit by a single batched call to
  `git branch --contains <hash> --format=%(refname:short)` performed only when
  `groupBy === "branch"` or a branch label is required for display. For other
  paths the current `HEAD` branch name is used as a fallback to keep the
  common case to a single `git log` invocation.
- `isMerge` is derived from the number of parent hashes (`%P`) being > 1.
- Streams stdout, parses records, and resolves to `GitCommit[]`. Non-zero exit
  or stderr output is surfaced as a typed `GitReaderError`.

### `commit-filter` (`src/commit-filter.ts`)

- Pure function `filterCommits(commits: GitCommit[], exclude: string[]): GitCommit[]`.
- Drops any commit where `isMerge === true` (always), and any commit whose
  `message` (case-insensitive) contains any of the configured `exclude`
  patterns. `"merge"` and `"wip"` are just the default pattern list — the
  function has no special-casing for them.
- Preserves commit order (newest first, as produced by `git log`).

### `commit-grouper` (`src/commit-grouper.ts`)

- Exports `groupCommits(commits: GitCommit[], strategy: GroupBy): Record<string, StandupEntry[]>`.
- `type` strategy: applies the regex `/^(\w+)(\(.+\))?!?:/` to the first line
  of the commit message. If it matches and the captured prefix is one of
  `feat, fix, docs, test, refactor, chore, style, perf, ci, build, revert`,
  that prefix becomes the group key. Otherwise the commit is grouped under
  `"other"`. The original commit message is preserved unchanged on the
  emitted `StandupEntry` — the type prefix is **not** stripped.
- `branch` strategy: key is `commit.branch`. No fallback group.
- `path` strategy: spawns `git show --name-only --pretty=format: <hash>` for
  each commit to list changed files, takes the first path segment of each
  file, and emits one `StandupEntry` per commit keyed on the most-common
  segment (ties broken alphabetically). Commits that touch no files are
  grouped under `"root"`.

### `report-formatter` (`src/report-formatter.ts`)

- Exports `formatReport(report: StandupReport, format: OutputFormat): string`.
- `text`: the exact shape shown in `FEATURE_SPEC.md` — a `Standup Report —
  YYYY-MM-DD` header, a `What I did:` block with bullet items, and a trailing
  summary line (`N commits across M branches (…)`).
- `markdown`: `## Standup Report — …` header, `### What I did` section with
  `**type:**` bold prefixes, and a `>` blockquote summary.
- `json`: the full `StandupReport` object serialised with `JSON.stringify(..., null, 2)`.
- The formatter is the only module that knows about per-format presentation;
  grouping logic lives exclusively in `commit-grouper`.

### `history-store` (`src/history-store.ts`)

- Resolves the history file to `path.join(os.homedir(), ".git-standup", "history.json")`.
- Lazily creates the directory with `fs.mkdir({ recursive: true })`.
- Stores an array of `StandupReport` objects. `appendReport` reads the existing
  file (empty array if missing or unreadable), pushes the new report, and
  writes atomically via a `.tmp` sibling + `rename`.
- Exports `listReports()` and `findByDate(date)` for future retrieval, even
  though the CLI does not yet expose a `--list` flag. Keeping the read API
  present avoids a breaking change when retrieval lands.

### `src/types.ts`

Single source of truth for shared interfaces — `GitCommit`, `StandupEntry`,
`StandupReport`, `OutputFormat`, `GroupBy`, `CliOptions` — exactly as defined
in `FEATURE_SPEC.md`. All other modules import from here.

## Key Decisions

1. **Zero runtime dependencies.** Stick to Node built-ins + the `git` binary.
   This rules out `commander`/`yargs` (replaced by `node:util.parseArgs`),
   `simple-git` (replaced by direct `spawn`), and `chalk` (plain text output).
   Justified by the non-functional requirement and by keeping install friction
   near zero.
2. **Record separators instead of JSON in `git log`.** Using `%x1f` / `%x1e`
   byte separators sidesteps the need to escape commit messages. `git log
   --pretty=format:...json...` is available but adds brittle escaping for
   arbitrary commit content.
3. **Branch resolution is deferred to the `branch` grouping path.** For the
   default `type` grouping, we only need branch metadata for the summary line;
   HEAD's short name is sufficient there. This keeps the common case to one
   git invocation and respects the <2s budget.
4. **`"other"` is a first-class group.** Commits that don't match the
   conventional format are always included, not dropped. This is explicit in
   `FEATURE_SPEC.md` success criterion 4 and is reinforced by a scenario in
   the `standup-report` delta spec.
5. **Filter is merge-aware by construction.** `isMerge` is a property on the
   commit, not a pattern. This keeps the filter signature simple
   (`(commits, patterns) => commits`) and ensures merges are excluded even if
   a user clears the default exclude list.
6. **Atomic history writes.** Writing via temp file + rename avoids a partial
   `history.json` if the process is interrupted. Cheap and important because
   reports are cheap to regenerate only if the file is not corrupted.
7. **Pipeline modules are pure and synchronous where possible.** Only
   `git-reader` and `history-store` touch I/O. `commit-filter`,
   `commit-grouper`, and `report-formatter` are synchronous pure functions,
   which makes them trivially testable without fixtures.

## Risks & Mitigations

| Risk                                                                 | Mitigation                                                              |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Commit messages contain the separator bytes we chose.                | `%x1f`/`%x1e` are ASCII control chars; extremely rare in practice. Add a parser test with pathological input. |
| `git` not on PATH (Windows non-WSL, sandboxes).                      | `git-reader` catches ENOENT and raises a `GitReaderError` with a clear remediation message. |
| Very large repos overflow child-process stdout buffers.              | Stream parse line-by-line from the `spawn` stdout rather than buffering with `execSync`. |
| Path grouping cost scales per-commit.                                | Only invoked when `--group-by path` is explicitly requested; acceptable. |

## Out of Scope for This Design

- Network fetches, remote branch resolution, and multi-repo aggregation are
  deliberately excluded — see `proposal.md` scope.
- Retrieval commands for the history store (`--list`, `--show <date>`) are
  left as a later change; the module API is designed to accommodate them
  without a breaking change.
