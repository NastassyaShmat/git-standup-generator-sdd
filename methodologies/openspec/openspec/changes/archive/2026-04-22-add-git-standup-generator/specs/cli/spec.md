# Delta for cli

## ADDED Requirements

### Requirement: CLI Entry Point
The system SHALL expose a single executable named `git-standup` that runs the
standup pipeline and writes the rendered report to the caller's chosen
destination.

#### Scenario: Invocation with defaults
- GIVEN a git repository in the current working directory
- WHEN the caller runs `git-standup` with no arguments
- THEN the tool reads commits since `yesterday` until `now`
- AND filters the caller's own commits (from `git config user.email`)
- AND writes a `text` report grouped by conventional-commit type to stdout
- AND exits with code `0`

#### Scenario: Invocation outside a git repository
- GIVEN a working directory that is not a git repository
- WHEN the caller runs `git-standup`
- THEN an actionable error is printed to stderr
- AND the tool exits with a non-zero code

### Requirement: Supported Flags
The CLI SHALL accept the following flags and no others: `--repo`, `--since`,
`--until`, `--author`, `--format`, `--exclude`, `--group-by`, `--output`,
`--save`.

#### Scenario: Unknown flag
- GIVEN an invocation that includes a flag outside the supported set
- WHEN the CLI parses arguments
- THEN a usage message is printed to stderr
- AND the tool exits with code `2`
- AND no git invocation occurs

#### Scenario: Invalid enum value
- GIVEN `--format html` or `--group-by author`
- WHEN the CLI parses arguments
- THEN a usage message naming the offending flag is printed to stderr
- AND the tool exits with code `2`

### Requirement: Default Values
The CLI SHALL resolve unset flags to the following defaults before invoking
the pipeline: `repo=cwd`, `since=yesterday`, `until=now`,
`author=<current user's git email>`, `format=text`, `exclude=["merge", "wip"]`,
`groupBy=type`, `output=<stdout>`, `save=false`.

#### Scenario: No git user configured
- GIVEN a repository whose `git config user.email` returns nothing
- WHEN `--author` is not supplied
- THEN the pipeline runs without an author filter
- AND the tool does not fail solely because the config is missing

### Requirement: Exclusion List Parsing
The CLI SHALL accept `--exclude` as a comma-separated list of patterns. An
explicit empty value clears the default list.

#### Scenario: Comma-separated patterns
- GIVEN `--exclude "fixup!,squash!, chore"` (note the leading space)
- WHEN the CLI parses it
- THEN the pipeline receives exactly `["fixup!", "squash!", "chore"]`
  (whitespace around tokens is trimmed)

#### Scenario: Empty string clears defaults
- GIVEN `--exclude ""`
- WHEN the CLI parses it
- THEN the pipeline receives `[]`
- AND only merge commits are excluded from the report

### Requirement: Output Destination
The CLI SHALL write the rendered report to stdout unless `--output` names a
file, in which case the report is written to that file (and nothing is
written to stdout).

#### Scenario: File output
- GIVEN `--output ./standup.md --format markdown`
- WHEN the pipeline produces a report
- THEN the markdown report is written to `./standup.md`
- AND stdout contains nothing relating to the report body

### Requirement: Exit Codes
The CLI SHALL use distinct exit codes: `0` for success, `1` for runtime
failures (git execution, file I/O), and `2` for argument-parsing or
validation errors.

#### Scenario: Git execution failure
- GIVEN the repository path does not exist
- WHEN the pipeline runs
- THEN the tool prints the underlying error to stderr
- AND exits with code `1`
