// Shared TypeScript interfaces and type aliases for git-standup-generator
// All other modules must import from this file — never redeclare types locally.

export type OutputFormat = 'text' | 'markdown' | 'json';
export type GroupBy = 'type' | 'branch' | 'path';

export interface GitCommit {
  readonly hash: string;
  readonly message: string;
  readonly author: string;
  readonly email: string;
  readonly date: Date;
  readonly branch: string;
  readonly isMerge: boolean;
}

export interface StandupEntry {
  readonly type: string;
  readonly message: string;
  readonly hash: string;
  readonly branch: string;
  readonly timestamp: Date;
}

export interface StandupReport {
  readonly date: string;
  readonly author: string;
  readonly period: {
    readonly since: string;
    readonly until: string;
  };
  readonly entries: StandupEntry[];
  readonly summary: {
    readonly totalCommits: number;
    readonly branches: string[];
    readonly types: Record<string, number>;
  };
}

export interface ParsedArgs {
  readonly repo: string;
  readonly since: string;
  readonly until: string;
  readonly author: string;
  readonly excludePatterns: string[];
  readonly groupBy: GroupBy;
  readonly format: OutputFormat;
  readonly outputPath: string | null;
  readonly save: boolean;
  readonly historyFile: string;
}

export interface GitReaderOptions {
  readonly repo: string;
  readonly since: string;
  readonly until: string;
  readonly author: string;
}

export interface FormatOptions {
  readonly format: OutputFormat;
  readonly author: string;
  readonly since: string;
  readonly until: string;
}
