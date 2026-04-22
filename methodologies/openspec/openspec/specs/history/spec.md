# history Specification

## Purpose
TBD - created by archiving change add-git-standup-generator. Update Purpose after archive.
## Requirements
### Requirement: Opt-In Report Persistence
The system SHALL persist a generated report to a local history file if, and
only if, the caller opts in via `--save`.

#### Scenario: Save is disabled by default
- GIVEN an invocation without `--save`
- WHEN the pipeline completes
- THEN no history file is created
- AND no history file is modified

#### Scenario: Save after successful output
- GIVEN an invocation with `--save` that produces a report
- WHEN the pipeline writes the primary output successfully
- THEN the report is appended to the local history store
- AND the history write happens after the primary output

### Requirement: History Location
The history store SHALL live at `<user-home>/.git-standup/history.json`. The
containing directory is created on first write if it does not already exist.

#### Scenario: First-ever save
- GIVEN a home directory without a `.git-standup/` folder
- WHEN the pipeline saves a report for the first time
- THEN `.git-standup/` is created inside the user's home directory
- AND `history.json` inside it contains a JSON array with the new report as
  its only element

### Requirement: Append Semantics
Saving a report SHALL append it to the existing history without removing,
re-ordering, or mutating previously saved reports.

#### Scenario: Append to existing history
- GIVEN a `history.json` that already contains two reports
- WHEN the pipeline saves a third report
- THEN `history.json` contains exactly three reports
- AND the original two reports are byte-for-byte unchanged

### Requirement: Crash-Safe Writes
The system SHALL write the history file atomically so a crash mid-write
cannot leave the file truncated or partially updated.

#### Scenario: Interrupted write leaves history intact
- GIVEN a valid `history.json`
- WHEN a save operation is interrupted after the temporary file has been
  written but before it is swapped in
- THEN the original `history.json` is still valid JSON
- AND no partial history file is visible under the canonical path

### Requirement: Corrupt History Does Not Block New Saves
If the history file exists but cannot be parsed as JSON, a new save SHALL
succeed by treating the existing file as empty and overwriting it with a
fresh array containing only the new report.

#### Scenario: Unparseable file
- GIVEN a `history.json` whose contents are not valid JSON
- WHEN the pipeline saves a report
- THEN the save succeeds
- AND `history.json` afterwards contains a valid JSON array with the new
  report as its only element

### Requirement: Retrieval API
The history store SHALL expose read operations that list all saved reports
and look up reports by date, so future CLI features can surface history
without a breaking change.

#### Scenario: Listing all reports
- GIVEN a `history.json` with three saved reports
- WHEN `listReports()` is called
- THEN it returns all three in insertion order

#### Scenario: Finding by date
- GIVEN a `history.json` with reports for `2026-04-20` and `2026-04-21`
- WHEN `findByDate("2026-04-20")` is called
- THEN it returns only the matching report

