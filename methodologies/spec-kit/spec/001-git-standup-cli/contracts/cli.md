# CLI Contract: git-standup

**Branch**: `001-git-standup-cli` | **Phase**: 1 — Design & Contracts  
**Generated**: 2026-04-20

This document is the authoritative contract for the `git-standup` command. It covers the command-line interface (flags, defaults, validation rules), output format schemas, and exit codes.

---

## Command Synopsis

```
git-standup [options]

# Also invocable as a git subcommand when installed in PATH:
git standup [options]
```

---

## Flags

### Filtering

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--since=<value>` | string | `"yesterday"` | Start of the commit time window. Passed verbatim to `git log --since`. Accepts any git date expression: `"3 days ago"`, `"2026-04-18"`, `"last Monday"`. |
| `--until=<value>` | string | `"now"` | End of the commit time window. Passed verbatim to `git log --until`. |
| `--author=<pattern>` | string | `git config user.email` | Author filter. Passed verbatim to `git log --author`. Accepts email or partial name (git regex match). |
| `--exclude=<patterns>` | string | `"merge,wip"` | Comma-separated exclusion patterns. **Replaces** the default set entirely — e.g. `--exclude="wip"` removes merge filtering. The special token `"merge"` matches merge commits (by parent count). All other tokens are case-insensitive prefix matches against the commit subject. |
| `--repo=<path>` | string | `process.cwd()` | Absolute or relative path to the target git repository. If the path is not a valid git repository, the tool exits with error code 1. |

### Grouping & Output

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--group-by=<strategy>` | `type\|branch\|path` | `"type"` | How to group commits. `type` = conventional commit type; `branch` = branch name; `path` = top-level directory of touched files. |
| `--format=<format>` | `text\|markdown\|json` | `"text"` | Output format. |
| `--output=<filepath>` | string | *(stdout)* | Write the report to this file path instead of stdout. The file is created or overwritten. Parent directory must exist. |
| `--save` | boolean | `false` | Append the report as a new entry to `~/.git-standup/history.json`. Creates the directory and file if they do not exist. |

### Meta

| Flag | Short | Description |
|------|-------|-------------|
| `--help` | `-h` | Print usage information and exit with code 0. |
| `--version` | `-v` | Print the semantic version number (from `package.json`) and exit with code 0. |

### Validation Rules

- `--format` must be one of `text`, `markdown`, `json`. Any other value → exit 1 with message: `"Invalid --format value '<value>'. Expected: text, markdown, json."`.
- `--group-by` must be one of `type`, `branch`, `path`. Any other value → exit 1.
- `--repo` path must exist and contain a `.git` directory (or be a bare repo). Otherwise → exit 1.
- Unknown flags → exit 1 with `util.parseArgs` error message.

---

## Output Format Schemas

### `--format=text` (default)

Plain text suitable for pasting into chat tools (Slack, Teams).

```
What I did:

<GroupLabel>
  • <short-hash> <message>
  • <short-hash> <message>

<GroupLabel>
  • <short-hash> <message>

---
<commitCount> commit(s) across <branchCount> branch(es) | <period>
```

**Rules**:
- Header is always `What I did:` followed by a blank line.
- Each group label is printed with no leading indent, followed by its entries indented with two spaces and `• `.
- Groups are separated by a blank line.
- Footer is a single line preceded by `---` separator.
- When no commits are found: output `No commits found for <author> in <period>.` (no header/footer).

**Example**:

```
What I did:

Features
  • a1b2c3d add OAuth login flow
  • e4f5a6b add user profile page

Bug Fixes
  • 7c8d9e0 fix token refresh race condition

---
3 commit(s) across 1 branch(es) | yesterday → now
```

---

### `--format=markdown`

Markdown suitable for PR descriptions, wikis, or GitHub comments.

```markdown
## What I did

### <GroupLabel>

- **<short-hash>** <message>
- **<short-hash>** <message>

### <GroupLabel>

- **<short-hash>** <message>

---

> <commitCount> commit(s) across <branchCount> branch(es) | <period>
```

**Rules**:
- Top-level header: `## What I did`
- Each group label: `### <label>`
- Each entry: `- **<hash>** <message>`
- Footer in a blockquote (`> ...`)
- When no commits: `_No commits found for <author> in <period>._`

---

### `--format=json`

Machine-readable JSON object conforming to `StandupReport`. Suitable for piping into other tools.

```json
{
  "date": "2026-04-20",
  "author": "alice@example.com",
  "period": "yesterday → now",
  "entries": {
    "feat": [
      {
        "hash": "a1b2c3d",
        "message": "add OAuth login flow",
        "type": "feat",
        "branch": "feature/auth",
        "timestamp": "2026-04-19T14:32:00+03:00"
      }
    ],
    "fix": [
      {
        "hash": "7c8d9e0",
        "message": "fix token refresh race condition",
        "type": "fix",
        "branch": "feature/auth",
        "timestamp": "2026-04-19T11:10:00+03:00"
      }
    ]
  },
  "summary": {
    "commitCount": 2,
    "branchesTouched": ["feature/auth"],
    "typeDistribution": {
      "feat": 1,
      "fix": 1
    }
  }
}
```

**Rules**:
- Output is a single JSON object (not an array).
- `entries` keys are group labels (commit type, branch name, or path prefix depending on `--group-by`).
- `entries` object is present but may be empty (`{}`) when no commits are found. `summary.commitCount` is `0`.
- Output is serialized with `JSON.stringify(report, null, 2)` (2-space indentation).
- No trailing newline after the closing `}`.

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success (including "no commits found" — this is a valid empty result) |
| `1` | User error: invalid flag value, unknown flag, invalid `--repo` path, unwritable `--output` file, git not found in PATH |

---

## History File Schema (`~/.git-standup/history.json`)

The history file is a JSON array of `StandupReport` objects, each with an added `savedAt` field:

```json
[
  {
    "date": "2026-04-19",
    "author": "alice@example.com",
    "period": "yesterday → now",
    "entries": { ... },
    "summary": { ... },
    "savedAt": "2026-04-19T09:45:00.000Z"
  },
  {
    "date": "2026-04-20",
    ...
    "savedAt": "2026-04-20T09:30:00.000Z"
  }
]
```

**Rules**:
- File is always a valid JSON array (even when empty: `[]`).
- New entries are appended to the end (newest last).
- `savedAt` is `new Date().toISOString()` at the time of save.
- Corrupt file: renamed to `history.json.bak.<timestamp>`, new `[]` written, save proceeds.
