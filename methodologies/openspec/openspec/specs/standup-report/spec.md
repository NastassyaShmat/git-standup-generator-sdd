# standup-report Specification

## Purpose
TBD - created by archiving change add-git-standup-generator. Update Purpose after archive.
## Requirements
### Requirement: Commit Ingestion from Local Repository
The system SHALL ingest commits from a local git repository for a caller-specified
time window and, when provided, a caller-specified author.

#### Scenario: Default time window
- GIVEN a local git repository with commits made yesterday and today
- WHEN the report pipeline runs with the default `since=yesterday, until=now` window
- THEN every yesterday-and-later commit is considered for inclusion
- AND commits older than the window are ignored

#### Scenario: Author filter
- GIVEN a repository with commits from multiple authors
- WHEN the caller specifies an author
- THEN only commits whose author email matches that value are considered

#### Scenario: Missing git binary
- GIVEN an environment without `git` on PATH
- WHEN the pipeline attempts to read commits
- THEN the pipeline surfaces a typed error whose message names `git` and
  suggests installing it
- AND no partial report is emitted

### Requirement: Noise Exclusion
The system SHALL exclude merge commits and commits whose message matches any
configured exclusion pattern.

#### Scenario: Merge commits are always excluded
- GIVEN a commit with more than one parent
- WHEN the pipeline filters ingested commits
- THEN that commit is dropped regardless of the exclusion pattern list
- AND an empty exclusion list does not re-include it

#### Scenario: Default exclusion patterns
- GIVEN the caller does not override exclusions
- WHEN a commit subject contains `WIP` or `wip` or `merge` (any case)
- THEN that commit is dropped from the report

#### Scenario: Custom exclusion patterns
- GIVEN the caller supplies `exclude=["fixup!", "squash!"]`
- WHEN a commit subject contains either pattern (case-insensitive)
- THEN that commit is dropped
- AND commits matching only the default patterns are no longer excluded

### Requirement: Commit Grouping
The system SHALL group the remaining commits by exactly one of three strategies:
conventional-commit type, branch, or first path segment.

#### Scenario: Grouping by conventional-commit type
- GIVEN a commit whose subject begins with a recognised prefix
  (`feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `style`, `perf`, `ci`,
  `build`, or `revert`) optionally followed by `(scope)` and/or `!`, then `:`
- WHEN grouping by `type`
- THEN the commit is placed in the group keyed by that prefix
- AND the commit's message is preserved unchanged

#### Scenario: Non-conventional commits fall back to "other"
- GIVEN a commit whose subject does not match the conventional prefix pattern
  OR matches with a prefix outside the recognised list
- WHEN grouping by `type`
- THEN the commit is placed in the `other` group
- AND the `other` group appears in the report whenever it is non-empty

#### Scenario: Grouping by branch
- GIVEN commits that live on different branches
- WHEN grouping by `branch`
- THEN each commit is placed in a group keyed by its branch name
- AND no fallback group is introduced

#### Scenario: Grouping by path
- GIVEN a commit that changes files under multiple top-level directories
- WHEN grouping by `path`
- THEN the commit is placed in the group keyed by its most frequently
  touched top-level path segment
- AND a commit that touches no files is placed in a group keyed by `root`

### Requirement: Report Structure
The system SHALL assemble grouped commits into a standup report that carries
the report date, author, time window, the per-commit entries, and a summary
counting total commits, distinct branches, and per-type occurrences.

#### Scenario: Summary counts reflect filtered commits
- GIVEN a pipeline run that ingested 10 commits and dropped 4 as noise
- WHEN the report is assembled
- THEN the summary reports 6 total commits
- AND the summary's type counts sum to 6

### Requirement: Output Formats
The system SHALL render the report in exactly one caller-selected format:
`text`, `markdown`, or `json`. Any other format value is rejected before the
pipeline runs.

#### Scenario: Text output
- GIVEN a report with at least one entry
- WHEN rendered as `text`
- THEN the output begins with `Standup Report — YYYY-MM-DD`
- AND contains a `What I did:` block listing each entry
- AND ends with a one-line summary of commit count and branches

#### Scenario: Markdown output
- GIVEN the same report
- WHEN rendered as `markdown`
- THEN the header is a level-two heading (`##`)
- AND each entry bullet bolds the type prefix
- AND the summary appears as a blockquote

#### Scenario: JSON output
- GIVEN the same report
- WHEN rendered as `json`
- THEN the output is a pretty-printed JSON document
- AND the document parses into the same `date`, `author`, `period`, `entries`,
  and `summary` fields defined for the internal report structure

