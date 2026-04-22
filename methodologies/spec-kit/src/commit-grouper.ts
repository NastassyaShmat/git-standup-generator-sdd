import type { GitCommit, StandupEntry, CommitType } from './types.js';

// ---------------------------------------------------------------------------
// Conventional commit regex (compiled once at module load)
// ---------------------------------------------------------------------------

const CONVENTIONAL_COMMIT_RE =
  /^(?<type>feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?:\s+(?<description>.+)$/i;

const VALID_TYPES = new Set<CommitType>([
  'feat', 'fix', 'docs', 'style', 'refactor',
  'perf', 'test', 'build', 'ci', 'chore', 'revert',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseConventional(subject: string): { type: CommitType; message: string } {
  const match = CONVENTIONAL_COMMIT_RE.exec(subject);
  if (match?.groups) {
    const raw = (match.groups['type'] ?? '').toLowerCase() as CommitType;
    const type: CommitType = VALID_TYPES.has(raw) ? raw : 'other';
    return { type, message: match.groups['description'] ?? subject };
  }
  return { type: 'other', message: subject };
}

function topLevelPath(files: string[]): string {
  if (files.length === 0) return 'root';
  const first = files[0];
  if (first === undefined || !first.includes('/')) return 'root';
  return first.split('/')[0] ?? 'root';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Group commits by the chosen strategy and return a sorted Map.
 *
 * Groups are sorted by entry count descending.
 * Entries within each group are sorted by timestamp descending (newest first).
 */
export function groupCommits(
  commits: GitCommit[],
  groupBy: 'type' | 'branch' | 'path',
): Map<string, StandupEntry[]> {
  const map = new Map<string, StandupEntry[]>();

  for (const commit of commits) {
    const shortHash = commit.hash.slice(0, 7);
    let key: string;
    let message: string;
    let type: CommitType;

    switch (groupBy) {
      case 'type': {
        const parsed = parseConventional(commit.subject);
        key = parsed.type;
        message = parsed.message;
        type = parsed.type;
        break;
      }
      case 'branch': {
        key = commit.branch;
        message = commit.subject;
        type = parseConventional(commit.subject).type;
        break;
      }
      case 'path': {
        key = topLevelPath(commit.files);
        message = commit.subject;
        type = parseConventional(commit.subject).type;
        break;
      }
    }

    const entry: StandupEntry = {
      hash: shortHash,
      message,
      type,
      branch: commit.branch,
      timestamp: commit.date,
    };

    const group = map.get(key);
    if (group !== undefined) {
      group.push(entry);
    } else {
      map.set(key, [entry]);
    }
  }

  // Sort entries within each group by timestamp descending
  for (const entries of map.values()) {
    entries.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  // Sort groups by entry count descending
  return new Map(
    [...map.entries()].sort((a, b) => b[1].length - a[1].length),
  );
}
