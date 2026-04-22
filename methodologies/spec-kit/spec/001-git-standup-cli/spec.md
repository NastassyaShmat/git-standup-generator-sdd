# Feature Specification: Git Standup CLI Tool

**Feature Branch**: `001-git-standup-cli`
**Created**: 2026-04-07
**Status**: Draft
**Input**: User description: "Build a CLI tool that reads a local git repository's commit history and generates a daily standup report. The tool filters out noise (merge commits, WIP prefixes), groups meaningful commits by their conventional commit type (feat/fix/docs/etc.), branch, or file path prefix, and outputs a human-readable summary."

## Clarifications

### Session 2026-04-08

- Q: Should merge commit filtering be always-on (hardcoded), or configurable via `--exclude`? → A: Configurable default — merge filtering is part of `--exclude` defaults; users can override to keep merges.
- Q: Should FR-001, FR-004, and SC-007 be rephrased to remove implementation details (git log, git config, npm)? → A: Yes — rephrase all three to describe observable behavior, not mechanism.
- Q: Should spec.md get a dedicated Scope section, pulling out-of-scope items from Assumptions? → A: Yes — add In Scope / Out of Scope subsections; remove scope items from Assumptions.
- Q: Should `--help` and `--version` be added as functional requirements? → A: Yes — add both as FR-016 and FR-017.
- Q: Should `--save` append each report to the history file, or overwrite it? → A: Append — each invocation adds a new entry, preserving all prior reports.

## Scope

### In Scope

- Read git log from a local repository
- Filter commits by author and time range
- Exclude merge commits and configurable patterns (e.g., "WIP", "fixup!")
- Group commits by conventional commit type, branch, or file path prefix
- Generate formatted output in text, markdown, and JSON
- Save reports to local history file
- External repository path support via `--repo`

### Out of Scope

- Multi-repo aggregation
- Slack/Teams integration
- AI-powered commit summarization
- Web UI or frontend
- Native Windows (PowerShell / cmd.exe) support — only macOS, Linux, and WSL2 are targeted

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate a Quick Daily Standup (Priority: P1)

A developer opens their terminal in a project repository first thing in the morning and runs `git-standup` with no arguments. The tool reads yesterday's commits by the current git user, filters out merge commits and WIP messages, groups the remaining commits by conventional commit type, and prints a clean bullet-list summary to the terminal.

**Why this priority**: This is the core value proposition — zero-friction standup generation from the command line. If this story works, the tool is immediately useful.

**Independent Test**: Can be fully tested by running `git-standup` in any git repository with recent commits. Delivers a readable standup report to stdout.

**Acceptance Scenarios**:

1. **Given** a git repository with 5 commits from the current user in the last 24 hours (including 1 merge commit and 1 "WIP" commit), **When** the developer runs `git-standup`, **Then** the tool outputs a text report listing 3 meaningful commits grouped by type, with a footer showing the commit count and branches touched.
2. **Given** a git repository with no commits from the current user in the last 24 hours, **When** the developer runs `git-standup`, **Then** the tool outputs a message indicating no commits were found for the given period.
3. **Given** a git repository with commits that do not follow conventional commit format, **When** the developer runs `git-standup`, **Then** those commits appear under an "other" group with their full message preserved.

---

### User Story 2 - Custom Time Range and Author Filter (Priority: P2)

A developer wants to generate a standup for a specific date range (e.g., after a long weekend) or review a teammate's recent work. They use `--since`, `--until`, and `--author` flags to customize the query.

**Why this priority**: Time range and author filtering make the tool flexible beyond the default "yesterday" use case, covering common real-world scenarios like Monday standups or team reviews.

**Independent Test**: Can be tested by running `git-standup --since="3 days ago" --author="colleague@example.com"` and verifying only matching commits appear.

**Acceptance Scenarios**:

1. **Given** a repository with commits spanning a week, **When** the developer runs `git-standup --since="3 days ago"`, **Then** only commits from the last 3 days are included in the report.
2. **Given** a repository with commits from multiple authors, **When** the developer runs `git-standup --author="alice@example.com"`, **Then** only commits by that author are included.
3. **Given** the developer specifies `--since` and `--until` together, **When** the tool runs, **Then** only commits within that exact window are returned.

---

### User Story 3 - Output Format Selection (Priority: P2)

A developer needs their standup in a specific format: plain text for pasting into Slack, markdown for a PR description or wiki, or JSON for piping into another tool or script.

**Why this priority**: Multiple output formats make the tool composable and useful across different workflows and integrations without requiring additional tooling.

**Independent Test**: Can be tested by running `git-standup --format=markdown` and `git-standup --format=json` and verifying each produces correctly structured output.

**Acceptance Scenarios**:

1. **Given** commits exist for the period, **When** the developer runs `git-standup --format=text`, **Then** the output is a plain-text bullet list with a "What I did:" header and a summary footer.
2. **Given** commits exist for the period, **When** the developer runs `git-standup --format=markdown`, **Then** the output uses `##` headers, bold type labels, and a blockquote summary footer.
3. **Given** commits exist for the period, **When** the developer runs `git-standup --format=json`, **Then** the output is a valid JSON object containing `date`, `author`, `period`, `entries` array, and `summary` object.

---

### User Story 4 - Grouping Strategy Selection (Priority: P3)

A developer wants to organize their standup by branch (to show feature-level work) or by file path prefix (to show which areas of the codebase were touched), rather than the default type-based grouping.

**Why this priority**: Alternative grouping strategies provide deeper insight into work distribution, but type-based grouping covers the most common use case already.

**Independent Test**: Can be tested by running `git-standup --group-by=branch` and verifying commits are organized under branch-name headings.

**Acceptance Scenarios**:

1. **Given** commits exist across 3 branches, **When** the developer runs `git-standup --group-by=branch`, **Then** the report groups commits under their respective branch names.
2. **Given** commits touch files in `src/api/` and `src/ui/`, **When** the developer runs `git-standup --group-by=path`, **Then** the report groups commits under their top-level path prefixes.

---

### User Story 5 - Custom Exclusion Patterns (Priority: P3)

A developer wants to exclude specific commit patterns beyond the defaults (merge commits and WIP). For example, they want to also exclude "fixup!" or "squash!" commits.

**Why this priority**: Custom exclusion provides fine-grained control, but the built-in defaults cover the vast majority of noise.

**Independent Test**: Can be tested by running `git-standup --exclude="fixup!,squash!"` and verifying those commits are filtered out.

**Acceptance Scenarios**:

1. **Given** a repository with "fixup!" commits, **When** the developer runs `git-standup --exclude="fixup!"`, **Then** those commits are excluded from the report.
2. **Given** the developer passes multiple exclusion patterns, **When** the tool runs, **Then** all matching commits are excluded.

---

### User Story 6 - File Output and History Saving (Priority: P4)

A developer wants to save their standup to a file for archival or share it as an attachment. They also want to build a local history of past standups for later review.

**Why this priority**: Persistence is a convenience feature that adds value over time but is not essential for the core daily workflow.

**Independent Test**: Can be tested by running `git-standup --output=standup.md --save` and verifying the file is written and the history store is updated.

**Acceptance Scenarios**:

1. **Given** a valid report is generated, **When** the developer passes `--output=standup.md`, **Then** the report is written to that file path.
2. **Given** a valid report is generated, **When** the developer passes `--save`, **Then** the report is appended to the local history store at `~/.git-standup/history.json`.
3. **Given** the history file does not yet exist, **When** the developer passes `--save` for the first time, **Then** the history file and its parent directory are created automatically.

---

### User Story 7 - External Repository Path (Priority: P4)

A developer wants to generate a standup for a repository located at a different path on their filesystem, not the current working directory.

**Why this priority**: Running against a different repo is an occasional convenience; most users will run the tool from within the target repo.

**Independent Test**: Can be tested by running `git-standup --repo=/path/to/other/repo` from any directory.

**Acceptance Scenarios**:

1. **Given** a valid git repository exists at `/path/to/repo`, **When** the developer runs `git-standup --repo=/path/to/repo`, **Then** the tool generates a report from that repository's commit history.
2. **Given** the path does not contain a git repository, **When** the developer runs `git-standup --repo=/invalid/path`, **Then** the tool exits with a clear error message.

---

### Edge Cases

- What happens when the repository has zero commits? The tool displays a clear "no commits found" message and exits with code 0.
- What happens when git is not installed or not in PATH? The tool exits with a clear error message indicating git is required.
- What happens when the `--since` date is in the future? The tool returns an empty report with a "no commits found" message.
- What happens when all commits in the range match exclusion patterns? The tool displays "no commits found after filtering" and exits with code 0.
- What happens when the `--output` path is not writable? The tool exits with a clear error message about the file write failure.
- What happens when the history file (`~/.git-standup/history.json`) is corrupted or invalid JSON? The tool backs up the corrupted file, creates a new empty history, and proceeds.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST read git commit history from a local repository using a single data retrieval operation per execution.
- **FR-002**: System MUST default to the current working directory as the repository path when `--repo` is not specified.
- **FR-003**: System MUST default to "yesterday" as the `--since` value and "now" as the `--until` value when not specified.
- **FR-004**: System MUST default to the repository's configured author identity as the author filter when `--author` is not specified.
- **FR-005**: System MUST apply configurable exclusion patterns to filter commits. The default exclusion set is `["merge", "wip"]`. When `--exclude` is provided, the supplied list replaces the default set entirely (e.g., `--exclude="wip"` excludes only WIP commits, removing merge filtering; `--exclude="merge,wip,fixup!"` retains defaults and adds a pattern).
- **FR-006**: System MUST match exclusion patterns as case-insensitive prefix matches against commit messages, except the special token `"merge"` which matches commits flagged as merge commits.
- **FR-007**: System MUST support grouping commits by conventional commit type, branch name, or file path prefix, selectable via `--group-by`.
- **FR-008**: System MUST assign commits that do not match conventional commit format to an "other" group when grouping by type.
- **FR-009**: System MUST support three output formats — plain text, markdown, and JSON — selectable via `--format`.
- **FR-010**: System MUST output to stdout by default, or to a file path when `--output` is specified.
- **FR-011**: System MUST append the generated report as a new entry to the local history file (`~/.git-standup/history.json`) when `--save` is specified, preserving all prior entries.
- **FR-012**: System MUST create the history directory and file if they do not exist when `--save` is used for the first time.
- **FR-013**: System MUST display a clear, user-friendly message when no commits match the given criteria.
- **FR-014**: System MUST exit with a clear error message when git is not available, the repository path is invalid, or a file write fails.
- **FR-015**: System MUST be installable as a `git-standup` command (so it can be invoked as `git standup`).
- **FR-016**: System MUST display usage information (available flags, descriptions, and examples) when invoked with `--help` or `-h`.
- **FR-017**: System MUST display its semantic version number when invoked with `--version` or `-v`.

### Key Entities

- **GitCommit**: A single parsed commit record containing hash, message, author, email, date, branch, and merge status.
- **StandupEntry**: A processed commit ready for display, containing type, message, hash, branch, and timestamp.
- **StandupReport**: The complete output document containing date, author, period, an array of entries, and a summary with commit count, branches touched, and type distribution.
- **CliOptions**: The full set of user-configurable inputs parsed from command-line arguments.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can generate a standup report in a single command with no additional setup beyond having Node.js and git installed.
- **SC-002**: The tool completes execution in under 2 seconds for repositories with up to 10,000 commits.
- **SC-003**: All three output formats (text, markdown, JSON) produce correctly structured, parseable output as defined in the product specification.
- **SC-004**: Merge commits and WIP-prefixed commits are excluded from the report by default, reducing noise by filtering out non-substantive entries.
- **SC-005**: Non-conventional commits are preserved in the report under the "other" group, ensuring no developer work is silently dropped.
- **SC-006**: The tool works identically on macOS, Linux, and WSL2 without platform-specific configuration.
- **SC-007**: The tool operates with zero runtime dependencies beyond the language runtime and the git CLI.

## Assumptions

- The target user is an individual developer generating their own standup from a single local repository.
- Git is installed and available in the user's PATH on all target platforms.
- Node.js 18 or later (LTS) is installed on the developer's machine.
- The developer's git configuration has `user.email` set (used for default author filtering).
- Conventional commit format (`type(scope): message`) is common but not required; the tool gracefully handles non-conventional messages.
- The `~/.git-standup/` directory is writable by the current user when `--save` is used.
