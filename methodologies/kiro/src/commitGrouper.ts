// Commit_Grouper module — groups filtered GitCommit objects into StandupEntry groups
// by type (conventional commit prefix), branch, or file path.

import { execSync } from 'child_process';
import { GitCommit, GroupBy, StandupEntry } from './types';

/**
 * Recognized conventional commit type prefixes.
 * Exported for use in property-based tests.
 */
export const RECOGNIZED_TYPES: readonly string[] = [
  'feat',
  'fix',
  'docs',
  'test',
  'refactor',
  'chore',
  'style',
  'perf',
  'ci',
  'build',
  'revert',
];

/**
 * Extract the conventional commit type prefix from a commit message.
 * Returns the prefix if it matches the conventional commit pattern and is in
 * RECOGNIZED_TYPES; otherwise returns "other".
 *
 * Exported for use in property-based tests.
 */
export function extractCommitType(message: string): string {
  const match = /^(\w+)(\(.+\))?!?:/.exec(message);
  if (match) {
    const prefix = match[1];
    if (RECOGNIZED_TYPES.includes(prefix)) {
      return prefix;
    }
  }
  return 'other';
}

/**
 * Convert a GitCommit to a StandupEntry with the given type key.
 */
function toStandupEntry(commit: GitCommit, type: string): StandupEntry {
  return {
    type,
    message: commit.message,
    hash: commit.hash,
    branch: commit.branch,
    timestamp: commit.date,
  };
}

/**
 * Determine the path-based group key for a commit by running
 * `git diff-tree --no-commit-id -r --name-only <hash>` in the repo directory.
 * Uses the first path segment of the first changed file.
 * Falls back to "root" for root-level files (no path separator).
 */
function getPathKey(hash: string, repoPath: string): string {
  try {
    const output = execSync(
      `git diff-tree --no-commit-id -r --name-only ${hash}`,
      { cwd: repoPath, encoding: 'utf8' }
    );
    const firstLine = output.trim().split('\n')[0];
    if (!firstLine) {
      return 'root';
    }
    const slashIndex = firstLine.indexOf('/');
    if (slashIndex === -1) {
      return 'root';
    }
    return firstLine.substring(0, slashIndex);
  } catch {
    return 'root';
  }
}

/**
 * Group an array of GitCommit objects into a Map<string, StandupEntry[]>
 * using the specified grouping strategy.
 *
 * The Map preserves insertion order — commits are added in the order they
 * appear in the input array.
 *
 * @param commits   Filtered list of commits to group.
 * @param groupBy   Grouping strategy: "type", "branch", or "path".
 * @param repoPath  Repository path used by the "path" strategy (defaults to cwd).
 */
export function groupCommits(
  commits: GitCommit[],
  groupBy: GroupBy,
  repoPath: string = process.cwd()
): Map<string, StandupEntry[]> {
  const result = new Map<string, StandupEntry[]>();

  for (const commit of commits) {
    let key: string;

    switch (groupBy) {
      case 'type':
        key = extractCommitType(commit.message);
        break;
      case 'branch':
        key = commit.branch;
        break;
      case 'path':
        key = getPathKey(commit.hash, repoPath);
        break;
      default: {
        // TypeScript exhaustiveness guard
        const _exhaustive: never = groupBy;
        throw new Error(`Unknown groupBy value: ${_exhaustive}`);
      }
    }

    const entry = toStandupEntry(commit, key);
    const existing = result.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      result.set(key, [entry]);
    }
  }

  return result;
}
