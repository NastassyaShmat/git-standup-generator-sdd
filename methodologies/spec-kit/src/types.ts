/**
 * Shared type definitions for the git-standup CLI tool.
 * No business logic, no imports beyond types.
 */

// ---------------------------------------------------------------------------
// GitCommit
// ---------------------------------------------------------------------------

/** Represents a single parsed commit record as returned by `git log`. */
export interface GitCommit {
  /** Full 40-character SHA */
  hash: string;

  /** First line of the commit message (subject) */
  subject: string;

  /** Author full name */
  author: string;

  /** Author email address */
  email: string;

  /**
   * Author date in ISO 8601 format.
   * Sourced from git %aI — always includes timezone offset.
   * Example: "2026-04-20T09:15:00+03:00"
   */
  date: string;

  /**
   * Branch name inferred from git ref decorations (%D).
   * Set to the most recently seen local branch name by the backfill algorithm.
   * "unknown" when no local branch ref is visible in the window.
   */
  branch: string;

  /** true when the commit has more than one parent (merge commit) */
  isMerge: boolean;

  /**
   * Paths of files touched by this commit, as reported by --name-only.
   * Empty array for commits with no file changes (e.g. empty commits).
   */
  files: string[];
}

// ---------------------------------------------------------------------------
// CommitType
// ---------------------------------------------------------------------------

export type CommitType =
  | 'feat'
  | 'fix'
  | 'docs'
  | 'style'
  | 'refactor'
  | 'perf'
  | 'test'
  | 'build'
  | 'ci'
  | 'chore'
  | 'revert'
  | 'other';

// ---------------------------------------------------------------------------
// StandupEntry
// ---------------------------------------------------------------------------

/** A single commit ready for display in the standup report. */
export interface StandupEntry {
  /** Short hash (first 7 characters of GitCommit.hash) */
  hash: string;

  /**
   * Human-readable message for display.
   * - When the subject matches the conventional commit regex: the description
   *   portion only (everything after "type(scope)!: ").
   * - When it does not match: the full subject verbatim.
   */
  message: string;

  /**
   * Commit type label used as the group key.
   * One of the CommitType values.
   */
  type: CommitType;

  /** Branch name from the parent GitCommit */
  branch: string;

  /** ISO 8601 timestamp from the parent GitCommit */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// StandupReport
// ---------------------------------------------------------------------------

/** The complete output document produced by report-formatter. */
export interface StandupReport {
  /** ISO 8601 date string for the day the report was generated (YYYY-MM-DD) */
  date: string;

  /** Author display name or email used as the filter */
  author: string;

  /** Human-readable description of the time window (e.g. "yesterday → now") */
  period: string;

  /**
   * Commits grouped by the active strategy key.
   * Key = group label (commit type, branch name, or path prefix).
   * Order: groups sorted by entry count descending; entries within each
   * group sorted by timestamp descending.
   */
  entries: Record<string, StandupEntry[]>;

  summary: {
    /** Total number of commits included in the report (after filtering) */
    commitCount: number;

    /** Unique branch names present across all entries */
    branchesTouched: string[];

    /**
     * Distribution of commits by type.
     * Key = CommitType string. Only types with ≥1 entry are present.
     */
    typeDistribution: Record<string, number>;
  };
}

// ---------------------------------------------------------------------------
// CliOptions
// ---------------------------------------------------------------------------

/**
 * The full set of user-configurable inputs parsed from command-line arguments.
 * Produced by cli.ts after util.parseArgs and post-parse validation.
 */
export interface CliOptions {
  /**
   * git --since value passed verbatim to git log.
   * Default: "yesterday"
   * Accepts any value git understands: "3 days ago", "2026-04-18", "1 week ago", etc.
   */
  since: string;

  /**
   * git --until value passed verbatim to git log.
   * Default: "now"
   */
  until: string;

  /**
   * Author filter passed verbatim to git --author.
   * Default: resolved from `git config user.email` at startup.
   * Accepts email address or partial name (git regex match).
   */
  author: string;

  /** Output format. Default: "text" */
  format: 'text' | 'markdown' | 'json';

  /** Grouping strategy. Default: "type" */
  groupBy: 'type' | 'branch' | 'path';

  /**
   * Exclusion patterns as a parsed array.
   * Sourced from --exclude="pattern1,pattern2".
   * Default when --exclude is not provided: ["merge", "wip"]
   * When --exclude IS provided: the supplied list REPLACES the default entirely.
   * The special token "merge" matches isMerge === true; all others are
   * case-insensitive prefix matches against subject.
   */
  exclude: string[];

  /**
   * Absolute path to the target git repository.
   * Default: process.cwd()
   */
  repo: string;

  /**
   * File path to write the report to.
   * When undefined, report is written to stdout.
   */
  output: string | undefined;

  /** When true, append the report to ~/.git-standup/history.json */
  save: boolean;

  /** When true, print help text and exit 0 */
  help: boolean;

  /** When true, print version string and exit 0 */
  version: boolean;
}
