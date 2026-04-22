/**
 * Shared type definitions for the git-standup CLI tool.
 * Interfaces copied verbatim from FEATURE_SPEC.md and adapted for grouped report structure.
 */

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  email: string;
  date: Date;
  branch: string;
  isMerge: boolean;
}

export interface StandupEntry {
  type: string;
  message: string;
  hash: string;
  branch: string;
  timestamp: Date;
}

export interface StandupReport {
  date: string;
  author: string;
  period: { since: string; until: string };
  /**
   * Commits grouped by the active strategy key (type, branch, or path segment).
   * Key = group label; value = entries in that group, newest first.
   */
  entries: Record<string, StandupEntry[]>;
  summary: {
    total_commits: number;
    branches: string[];
    types: Record<string, number>;
  };
}

export type OutputFormat = 'text' | 'markdown' | 'json';
export type GroupBy = 'type' | 'branch' | 'path';

export interface CliOptions {
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

export class GitReaderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitReaderError';
  }
}
