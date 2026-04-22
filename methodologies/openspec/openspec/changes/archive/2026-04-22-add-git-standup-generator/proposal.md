# Proposal: Add git-standup-generator

## Intent

Writing daily standup reports is repetitive work. Developers already document
what they did through git commits, but translating that history into a concise,
shareable standup takes manual effort every morning. This change introduces a
zero-dependency Node.js CLI — `git-standup` — that reads local git history,
filters out noise, groups meaningful work, and emits a formatted standup report
in text, markdown, or JSON.

Source of truth: [`FEATURE_SPEC.md`](../../../../../FEATURE_SPEC.md).

## Scope

In scope:

- Read git log from a local repository for a given time window and author.
- Exclude merge commits and configurable noise patterns (e.g. `WIP`, `fixup!`).
- Group commits by conventional-commit type, branch, or first path segment.
  Non-conventional commits fall back to an `other` group when grouping by type.
- Render grouped commits in three output formats: `text`, `markdown`, `json`.
- Write the report to stdout or a file via `--output`.
- Persist generated reports to a local history file when `--save` is passed.
- Parse CLI flags with `node:util.parseArgs` — no third-party argument parsers.

Out of scope (deferred):

- Multi-repo aggregation across several working copies.
- Slack, Teams, or other chat integrations.
- AI-powered commit summarization or rewriting.
- Web UI or React frontend.

## Approach

Implement a linear pipeline composed of six single-purpose modules that map
directly to verbs in the data flow:

```
CLI args → git-reader → commit-filter → commit-grouper → report-formatter → output
                                                                           ↘ history-store
```

Each module is a small, testable TypeScript unit with an explicit input and
output type. The CLI module owns argument parsing and orchestration; the other
modules have no knowledge of CLI flags and operate purely on structured data.
Runtime dependencies are restricted to Node.js built-ins (`node:child_process`,
`node:fs`, `node:path`, `node:os`, `node:util`) and the `git` executable on
`PATH`. This keeps install size negligible and supports the <2s execution
target for repositories up to 10,000 commits.

## Impact

- **New capabilities (system-level specs added on archive):**
  - `standup-report` — the core commit-to-report pipeline behavior.
  - `cli` — the `git-standup` command-line interface.
  - `history` — local persistence of generated reports.
- **New source tree:** `src/` under `methodologies/openspec/` holding module
  sources, types, and the CLI entry point wired to the `git-standup` bin.
- **No migrations:** greenfield addition; no existing specs, code, or consumers
  are modified.
