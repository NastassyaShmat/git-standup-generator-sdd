# Feature Spec: git-standup-generator

## Overview

A CLI tool that reads git commit history and generates a formatted daily standup report.
The tool analyzes commits for a given period, filters out noise (merge commits, WIP),
groups meaningful work, and outputs a human-readable standup summary.

## Problem Statement

Writing daily standup reports is repetitive. Developers already document their work
through git commits, but translating commit history into a concise standup format
requires manual effort. This tool automates that translation.

## Scope

### In Scope

- Read git log from a local repository
- Filter commits by author and time range
- Exclude merge commits and configurable patterns (e.g., "WIP", "fixup!")
- Group commits by logical theme (branch, path prefix, or conventional commit type)
- Generate formatted output in text, markdown, and JSON
- Configurable output template
- Save reports to local history file

### Out of Scope (for now)

- Multi-repo aggregation
- Slack/Teams integration
- AI-powered commit summarization
- Web UI or React frontend (future phase)

## Inputs

| Input        | Type     | Default            | Description                                 |
| ------------ | -------- | ------------------ | ------------------------------------------- |
| `--repo`     | string   | `.` (cwd)          | Path to the git repository                  |
| `--since`    | string   | `"yesterday"`      | Start of the time range (git log format)    |
| `--until`    | string   | `"now"`            | End of the time range                       |
| `--author`   | string   | git config user    | Filter by commit author                     |
| `--format`   | enum     | `text`             | Output format: `text`, `markdown`, `json`   |
| `--exclude`  | string[] | `["merge", "wip"]` | Patterns to exclude from results            |
| `--group-by` | enum     | `type`             | Grouping strategy: `type`, `branch`, `path` |
| `--output`   | string   | stdout             | File path to write report to                |
| `--save`     | boolean  | `false`            | Save to local history                       |

## Outputs

### Text Format (default)

```
Standup Report — 2026-04-03

What I did:
  • [feat] Add user authentication endpoint
  • [fix] Resolve database connection timeout
  • [docs] Update API documentation for v2

3 commits across 2 branches (main, feature/auth)
```

### Markdown Format

```markdown
## Standup Report — 2026-04-03

### What I did

- **feat:** Add user authentication endpoint
- **fix:** Resolve database connection timeout
- **docs:** Update API documentation for v2

> 3 commits across 2 branches (main, feature/auth)
```

### JSON Format

```json
{
  "date": "2026-04-03",
  "author": "developer@example.com",
  "period": { "since": "2026-04-02", "until": "2026-04-03" },
  "entries": [
    {
      "type": "feat",
      "message": "Add user authentication endpoint",
      "hash": "abc1234",
      "branch": "feature/auth",
      "timestamp": "2026-04-02T14:30:00Z"
    }
  ],
  "summary": {
    "total_commits": 3,
    "branches": ["main", "feature/auth"],
    "types": { "feat": 1, "fix": 1, "docs": 1 }
  }
}
```

## Core Modules

| Module             | Responsibility                                            |
| ------------------ | --------------------------------------------------------- |
| `git-reader`       | Execute git log and parse raw output into structured data |
| `commit-filter`    | Apply exclusion rules (merge, WIP, patterns)              |
| `commit-grouper`   | Group commits by type, branch, or path                    |
| `report-formatter` | Format grouped commits into text/markdown/JSON            |
| `history-store`    | Persist generated reports locally                         |
| `cli`              | Parse CLI arguments, orchestrate the pipeline             |

## Data Flow

```
CLI args → git-reader → commit-filter → commit-grouper → report-formatter → output
                                                                          ↘ history-store
```

## Key Types (TypeScript)

```typescript
interface GitCommit {
  hash: string;
  message: string;
  author: string;
  email: string;
  date: Date;
  branch: string;
  isMerge: boolean;
}

interface StandupEntry {
  type: string;
  message: string;
  hash: string;
  branch: string;
  timestamp: Date;
}

interface StandupReport {
  date: string;
  author: string;
  period: { since: string; until: string };
  entries: StandupEntry[];
  summary: {
    totalCommits: number;
    branches: string[];
    types: Record<string, number>;
  };
}

type OutputFormat = "text" | "markdown" | "json";
type GroupBy = "type" | "branch" | "path";

interface CliOptions {
  repo: string;
  since: string;
  until: string;
  author: string;
  format: OutputFormat;
  exclude: string[];
  groupBy: GroupBy;
  output: string;
  save: boolean;
}
```

## Success Criteria

1. Running `git-standup` in a repo with commits produces a readable report
2. All three output formats generate valid, well-structured output
3. Filtering correctly excludes merge commits and configured patterns
4. Grouping produces logical categories from conventional commit messages
5. `--save` persists the report and can be retrieved later

## Non-Functional Requirements

- Execution time < 2s for repos with up to 10,000 commits
- Zero runtime dependencies beyond Node.js built-ins and git CLI
- Works on macOS, Linux, and Windows (WSL)
