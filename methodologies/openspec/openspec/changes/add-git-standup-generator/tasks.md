# Tasks

All source files live under `methodologies/openspec/src/`. Paths below are
relative to that directory unless otherwise noted.

Order: sections 1 → 7 are dependency-ordered. Within a section, subtasks can
run in parallel unless marked.

## 1. Project Scaffolding

- [x] 1.1 Create `src/` directory under `methodologies/openspec/`.
- [x] 1.2 Add `src/types.ts` with `GitCommit`, `StandupEntry`, `StandupReport`,
      `OutputFormat`, `GroupBy`, and `CliOptions` interfaces copied verbatim
      from `FEATURE_SPEC.md`.
- [x] 1.3 Confirm `tsconfig.json` at repo root already compiles
      `methodologies/*/src/**/*.ts` (it does) and that the strict flag is on.
- [x] 1.4 Add a `bin/git-standup` shim (shebang `#!/usr/bin/env node`) that
      imports `./dist/cli.js` and calls `run(process.argv.slice(2))`.
- [x] 1.5 Add `"bin": { "git-standup": "methodologies/openspec/bin/git-standup" }`
      entry to the root `package.json`.

## 2. `git-reader` module

- [x] 2.1 Implement `src/git-reader.ts` exporting
      `readCommits(options: CliOptions): Promise<GitCommit[]>`.
- [x] 2.2 Build the `git log` argv: `--pretty=format:%H%x1f%an%x1f%ae%x1f%aI%x1f%P%x1f%s%x1e`,
      plus `--since`, `--until`, and `--author` when set.
- [x] 2.3 Spawn with `node:child_process.spawn`, stream stdout, split on
      `\x1e`, and parse each record by splitting on `\x1f`.
- [x] 2.4 Derive `isMerge` from the parent-hash field (count of
      space-separated hashes > 1).
- [x] 2.5 Resolve the current branch via `git rev-parse --abbrev-ref HEAD`
      and attach it to every commit as the default `branch` value.
- [x] 2.6 Define and throw a typed `GitReaderError` when `git` is missing
      (ENOENT) or exits non-zero; include stderr in the message.
- [x] 2.7 Unit-test parsing against a fixture string with: normal commits,
      multi-line messages, a merge commit, and a commit containing the
      `|` / tab characters (sanity check for separator choice).

## 3. `commit-filter` module

- [x] 3.1 Implement `src/commit-filter.ts` exporting
      `filterCommits(commits: GitCommit[], exclude: string[]): GitCommit[]`.
- [x] 3.2 Always drop commits where `isMerge === true`.
- [x] 3.3 Drop commits whose `message` (lower-cased) contains any lower-cased
      entry in `exclude`.
- [x] 3.4 Preserve input order.
- [x] 3.5 Unit-test: default excludes drop `WIP`/`wip:` / `Merge branch`
      commits; empty exclude list still drops merges; mixed case works.

## 4. `commit-grouper` module

- [x] 4.1 Implement `src/commit-grouper.ts` exporting
      `groupCommits(commits: GitCommit[], strategy: GroupBy): Record<string, StandupEntry[]>`.
- [x] 4.2 Implement the `type` strategy using the regex
      `/^(\w+)(\(.+\))?!?:/` on the commit subject, with the recognised list
      from `config.yaml`. Unrecognised or unmatched → group key `"other"`.
- [x] 4.3 Implement the `branch` strategy — key is `commit.branch`.
- [x] 4.4 Implement the `path` strategy — run `git show --name-only
      --pretty=format: <hash>` per commit, derive the most-common first path
      segment, default to `"root"` when the commit has no file changes.
- [x] 4.5 Ensure every emitted `StandupEntry` carries the **original**
      `message` unchanged (do not strip the type prefix).
- [x] 4.6 Unit-test: conventional, non-conventional, breaking-change (`!:`)
      and scope-in-parens (`feat(api):`) commit subjects.

## 5. `report-formatter` module

- [x] 5.1 Implement `src/report-formatter.ts` exporting
      `formatReport(report: StandupReport, format: OutputFormat): string`.
- [x] 5.2 `text` format matches the layout in `FEATURE_SPEC.md` — header,
      `What I did:` block with `• [type] message` bullets, summary line.
- [x] 5.3 `markdown` format uses `## Standup Report — …`,
      `### What I did`, `**type:**` bold prefixes, and a `>` summary.
- [x] 5.4 `json` format uses `JSON.stringify(report, null, 2)` and nothing
      else (no trailing newline beyond what the CLI adds on write).
- [x] 5.5 Unit-test: snapshot test for each format against a fixed
      `StandupReport` fixture including an `"other"` group.

## 6. `history-store` module

- [x] 6.1 Implement `src/history-store.ts` exporting `appendReport`,
      `listReports`, and `findByDate`.
- [x] 6.2 Resolve the file path to
      `path.join(os.homedir(), ".git-standup", "history.json")`.
- [x] 6.3 Create the directory with `fs.mkdir({ recursive: true })` before
      any write.
- [x] 6.4 Read-modify-write `appendReport`: read existing array (empty on
      missing or malformed file), push the new report, write to a
      `.history.json.tmp` sibling, then `rename`.
- [x] 6.5 Unit-test against a temp `HOME` directory: missing-file path,
      existing-file path, and interrupted-write recovery (pre-existing
      `.tmp` file is overwritten).

## 7. `cli` module

- [x] 7.1 Implement `src/cli.ts` exporting `run(argv: string[]): Promise<number>`.
- [x] 7.2 Parse flags with `node:util.parseArgs` (`--repo`, `--since`,
      `--until`, `--author`, `--format`, `--exclude`, `--group-by`,
      `--output`, `--save`).
- [x] 7.3 Resolve defaults per the spec, including `author` from
      `git config user.email` (ignore failure).
- [x] 7.4 Validate enums: `format ∈ {text, markdown, json}`,
      `groupBy ∈ {type, branch, path}`. Invalid values print usage and exit
      with code `2`.
- [x] 7.5 Parse `--exclude` as a comma-separated list; empty string → `[]`
      (explicitly clears the default).
- [x] 7.6 Orchestrate the pipeline: `readCommits` → `filterCommits` →
      `groupCommits` → build `StandupReport` → `formatReport` → write.
- [x] 7.7 If `--output` is set, write to that file; otherwise write to
      stdout. Always end with a single trailing newline.
- [x] 7.8 If `--save` is set, call `history-store.appendReport(report)`
      **after** the primary output has been written.
- [x] 7.9 Return exit code `0` on success, `1` on git / I/O errors, `2` on
      invalid arguments. Errors print a single-line, actionable message to
      stderr.
- [x] 7.10 Unit-test `run` by stubbing `git-reader` and `history-store` and
      asserting on the formatter output and the exit code.

## 8. Integration / acceptance

- [x] 8.1 Add an integration test that runs `run` against a throwaway git
      repo (created in a temp dir with real `git init` + a handful of
      commits) and asserts a well-formed `text` report for the default
      flags.
- [x] 8.2 Add the same test for `--format markdown`, `--format json`, and
      `--group-by branch`.
- [x] 8.3 Benchmark `run` against a repo with 10,000 seeded commits;
      assert wall time < 2s on the CI runner (skippable via env var).
- [x] 8.4 Verify `--save` writes to `~/.git-standup/history.json` within a
      fake `HOME` and that `listReports()` reads it back.
- [x] 8.5 Smoke-test the `bin/git-standup` shim end-to-end via `npx`.
