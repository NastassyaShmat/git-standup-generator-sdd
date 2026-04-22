# Research: Git Standup CLI Tool

**Branch**: `001-git-standup-cli` | **Phase**: 0 — Outline & Research  
**Generated**: 2026-04-20

No NEEDS CLARIFICATION items were present in the Technical Context — the technology stack is fully locked by the constitution (TypeScript/Node.js ≥ 18, zero runtime dependencies, `child_process.spawn`, `util.parseArgs`). Phase 0 research focuses on three implementation decisions with multiple valid approaches:

1. Optimal `git log --format` string to capture all needed fields in a single call
2. Conventional commit regex parsing strategy
3. Node.js built-in argument parsing via `util.parseArgs`

---

## 1. Git Log Format String

### Decision

Use a single `git log` invocation with `--format` and `--name-only`, with a `COMMIT\x00` sentinel line preceding each commit's metadata:

```
git log \
  --format="COMMIT%x00%H%x1f%s%x1f%an%x1f%ae%x1f%aI%x1f%D%x1f%P" \
  --name-only \
  [--since=<value>] [--until=<value>] [--author=<pattern>] \
  [--no-merges (when "merge" is in exclusion set)]
```

### Field Encoding

| Placeholder | Content | Notes |
|-------------|---------|-------|
| `%H` | Full commit SHA | 40 hex chars, no special chars |
| `%s` | Subject (first line of message) | Newline-free |
| `%an` | Author name | May contain spaces |
| `%ae` | Author email | |
| `%aI` | Author date, strict ISO 8601 | e.g. `2026-04-20T09:15:00+03:00` |
| `%D` | Ref names (like `--decorate=short`) | e.g. `HEAD -> main, origin/main` |
| `%P` | Parent hashes (space-separated) | Empty = root; 2+ = merge commit |

- `%x1f` = ASCII Unit Separator (0x1F) — field delimiter; never appears in the above fields
- `%x00` = NULL byte — used as the sentinel after the literal `COMMIT` prefix
- `--name-only` appends touched file paths after each commit block (blank-line delimited)

### Output Format

```
COMMIT\x00<hash>\x1f<subject>\x1f<author>\x1f<email>\x1f<date>\x1f<refs>\x1f<parents>
<blank line>
path/to/file1.ts
path/to/file2.ts
<blank line>
COMMIT\x00<hash2>...
```

### Parsing Strategy

```typescript
const lines = rawOutput.split('\n');
let current: RawCommit | null = null;
const commits: RawCommit[] = [];

for (const line of lines) {
  if (line.startsWith('COMMIT\x00')) {
    if (current) commits.push(current);
    const [, hash, subject, author, email, date, refs, parents] =
      line.slice(7).split('\x1f');  // slice off "COMMIT\x00"
    current = { hash, subject, author, email, date, refs, parents, files: [] };
  } else if (current && line.trim() !== '') {
    current.files.push(line.trim());
  }
}
if (current) commits.push(current);
```

### Branch Name Extraction from `%D`

`%D` gives ref names for commits that are at a branch tip (e.g., `HEAD -> feature/auth, origin/feature/auth`). For commits behind the tip, `%D` is empty.

**Strategy**: Walk commits in output order (newest first). Maintain a `lastSeenBranch` variable. When `%D` contains a local branch name (matches `/^(?:HEAD -> )?([^,\s]+)/`), update `lastSeenBranch`. Commits with empty `%D` inherit `lastSeenBranch`. This is accurate for single-branch standup use cases (the overwhelmingly common scenario).

**Why this is sufficient**: The standup time window is typically 24 hours. In practice, all commits in that window are on the same branch or at most 2–3 branches. The decorator backfill covers nearly all real-world cases.

### Merge Commit Detection

A commit is a merge commit if `%P` contains more than one hash (space-separated). The `"merge"` exclusion token maps to this check. When `"merge"` is in the exclusion set, we also pass `--no-merges` to git directly as a performance optimization (filters at source rather than after parsing).

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|-----------------|
| Separate `git log` call per branch for branch names | Violates constitution principle III (single git log rule) |
| `git log --all --source` | Changes output format; still doesn't give per-commit branch assignment |
| `git branch --contains <hash>` per commit | O(n) subprocess calls; violates the single-invocation rule |
| `--format=%H%x1f%s%x1f...` without `--name-only` | Cannot support `--group-by=path` without knowing touched files |

---

## 2. Conventional Commit Regex Parsing Strategy

### Decision

Parse commit subjects with a single compiled regex at module load time. Non-matching subjects are assigned to the `"other"` group with their full subject preserved.

```typescript
const CONVENTIONAL_COMMIT_RE =
  /^(?<type>feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?:\s+(?<description>.+)$/i;
```

### Matched Groups

| Group | Example | Notes |
|-------|---------|-------|
| `type` | `feat` | Lowercased after match (regex is case-insensitive) |
| `scope` | `auth` | Optional; present only when `(scope)` is used |
| `breaking` | `!` | Optional; `!` before `:` signals a breaking change |
| `description` | `add OAuth login` | Everything after `type(scope)!: ` |

### Type Set

The 11 conventional commit types recognized:

| Type | Standup Group Label |
|------|---------------------|
| `feat` | Features |
| `fix` | Bug Fixes |
| `docs` | Documentation |
| `style` | Style |
| `refactor` | Refactoring |
| `perf` | Performance |
| `test` | Tests |
| `build` | Build |
| `ci` | CI |
| `chore` | Chores |
| `revert` | Reverts |

Any subject not matching the regex → group label `"other"`.

### Rationale

- Single regex is O(n) over subjects with negligible constant — well within the performance envelope.
- Case-insensitive flag handles real-world variations (`Feat:`, `FIX:`).
- `breaking` capture enables future BREAKING CHANGE highlighting without a second pass.
- Named capture groups make the intent self-documenting and avoid positional index fragility.

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|-----------------|
| Multi-step string split on `:` | Misparses scoped commits like `fix(api): ...` (colon in scope) |
| Separate regex per type | 11× the regex objects; negligible performance gain; harder to maintain |
| Full conventional commit spec parser (npm package) | External runtime dependency; violates constitution principle I |

---

## 3. Node.js Built-in Argument Parsing (`util.parseArgs`)

### Decision

Use `util.parseArgs` from `node:util`, available since Node.js 18.3.0 (covered by the ≥18 LTS requirement with no additional package needed).

```typescript
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    since:      { type: 'string',  default: 'yesterday' },
    until:      { type: 'string',  default: 'now' },
    author:     { type: 'string' },           // default: resolved from git config at runtime
    format:     { type: 'string',  default: 'text' },
    'group-by': { type: 'string',  default: 'type' },
    exclude:    { type: 'string' },           // default: 'merge,wip' (applied in code, not here)
    output:     { type: 'string' },           // default: stdout
    repo:       { type: 'string' },           // default: process.cwd()
    save:       { type: 'boolean', default: false },
    help:       { type: 'boolean', short: 'h', default: false },
    version:    { type: 'boolean', short: 'v', default: false },
  },
  strict: true,          // throw on unknown flags
  allowPositionals: false,
});
```

### Key Behaviors

- **`strict: true`**: Unknown flags cause a thrown `TypeError` with a clear message, which `cli.ts` catches and re-formats as a user-friendly error.
- **`--exclude` default not in `parseArgs`**: The default exclusion list `["merge", "wip"]` is applied in the pipeline layer (not as a `parseArgs` default) because the `--exclude` value replaces the default entirely per FR-005 — the code needs to distinguish "user did not pass --exclude" from "user passed --exclude=merge,wip".
- **`--author` default**: Cannot be a static `parseArgs` default since it requires a `git config user.email` lookup. Resolved in `cli.ts` after parsing.
- **`-h` / `-v` aliases**: The `short` field provides single-dash short forms. Note: `util.parseArgs` with short options requires Node ≥ 18.11.0, which is within the ≥18 LTS envelope.

### Rationale

- Zero additional package; ships with Node.js 18.
- Typed values (`type: 'string' | 'boolean'`) align directly with `CliOptions` type definition.
- `strict: true` gives automatic unknown-flag rejection without manual validation.
- Simpler than `process.argv` manual parsing; safer than `yargs`/`commander` (runtime dependency).

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|-----------------|
| Manual `process.argv.slice(2)` parsing | Error-prone; requires custom `--key=value` / `--key value` handling |
| `minimist` / `yargs` / `commander` | Runtime npm dependencies; violates constitution principle I |
| `getopts` | Runtime npm dependency |
| Custom recursive descent parser | Unnecessary complexity when `util.parseArgs` covers all flag types needed |

---

## Summary of Decisions

| Area | Decision |
|------|----------|
| Git log format | `--format="COMMIT%x00%H%x1f%s%x1f%an%x1f%ae%x1f%aI%x1f%D%x1f%P" --name-only` |
| Field delimiter | `%x1f` (ASCII Unit Separator) |
| Record sentinel | `COMMIT\x00` prefix line |
| Branch backfill | Walk newest-first, inherit last seen `%D` local branch ref |
| Merge detection | `%P` parent count > 1 (+ pass `--no-merges` to git when `"merge"` in exclusion set) |
| Conventional commit regex | Named-group regex, case-insensitive, 11 types + `"other"` fallback |
| CLI argument parsing | `util.parseArgs` from `node:util`, `strict: true` |
| Test runner | `node:test` + `node:assert` (built-in, zero devDependency) |
