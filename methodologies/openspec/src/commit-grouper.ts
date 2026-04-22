import { spawn } from 'node:child_process';
import type { GitCommit, GroupBy, StandupEntry } from './types.js';

const CONVENTIONAL_RE = /^(\w+)(\(.+\))?!?:/;

const RECOGNISED_TYPES = new Set([
  'feat', 'fix', 'docs', 'test', 'refactor', 'chore',
  'style', 'perf', 'ci', 'build', 'revert',
]);

function extractType(message: string): string {
  const match = CONVENTIONAL_RE.exec(message);
  if (match) {
    const prefix = (match[1] ?? '').toLowerCase();
    return RECOGNISED_TYPES.has(prefix) ? prefix : 'other';
  }
  return 'other';
}

function stripTypePrefix(message: string): string {
  // Strip "type(scope)!: " prefix, returning only the description
  const match = /^\w+(?:\(.+\))?!?:\s*(.*)$/.exec(message);
  return match ? (match[1] ?? message) : message;
}

function topSegment(filePath: string): string {
  const idx = filePath.indexOf('/');
  return idx > 0 ? filePath.slice(0, idx) : 'root';
}

async function getFilesForCommit(hash: string, repo: string): Promise<string[]> {
  return new Promise((resolve) => {
    const child = spawn('git', ['show', '--name-only', '--pretty=format:', hash], {
      cwd: repo,
      shell: false,
    });

    let stdout = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
    child.on('error', () => resolve([]));
    child.on('close', () => {
      const files = stdout
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      resolve(files);
    });
  });
}

function mostCommonSegment(files: string[]): string {
  if (files.length === 0) return 'root';

  const counts = new Map<string, number>();
  for (const f of files) {
    const seg = topSegment(f);
    counts.set(seg, (counts.get(seg) ?? 0) + 1);
  }

  // Sort by count descending, ties broken alphabetically
  const sorted = [...counts.entries()].sort((a, b) => {
    const diff = b[1] - a[1];
    return diff !== 0 ? diff : a[0].localeCompare(b[0]);
  });

  return sorted[0]?.[0] ?? 'root';
}

function toEntry(commit: GitCommit, type: string, message: string): StandupEntry {
  return {
    type,
    message,
    hash: commit.hash.slice(0, 7),
    branch: commit.branch,
    timestamp: commit.date,
  };
}

function sortGroups(map: Map<string, StandupEntry[]>): Record<string, StandupEntry[]> {
  // Sort entries within each group newest first
  for (const entries of map.values()) {
    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Sort groups by entry count descending, ties alphabetically
  const sorted = [...map.entries()].sort((a, b) => {
    const diff = b[1].length - a[1].length;
    return diff !== 0 ? diff : a[0].localeCompare(b[0]);
  });

  return Object.fromEntries(sorted);
}

function addToGroup(map: Map<string, StandupEntry[]>, key: string, entry: StandupEntry): void {
  const group = map.get(key);
  if (group !== undefined) {
    group.push(entry);
  } else {
    map.set(key, [entry]);
  }
}

export async function groupCommits(
  commits: GitCommit[],
  strategy: GroupBy,
  repo = process.cwd(),
): Promise<Record<string, StandupEntry[]>> {
  const map = new Map<string, StandupEntry[]>();

  for (const commit of commits) {
    switch (strategy) {
      case 'type': {
        const type = extractType(commit.message);
        const message = RECOGNISED_TYPES.has(type)
          ? stripTypePrefix(commit.message)
          : commit.message;
        addToGroup(map, type, toEntry(commit, type, message));
        break;
      }
      case 'branch': {
        const type = extractType(commit.message);
        addToGroup(map, commit.branch, toEntry(commit, type, commit.message));
        break;
      }
      case 'path': {
        const files = await getFilesForCommit(commit.hash, repo);
        const key = mostCommonSegment(files);
        const type = extractType(commit.message);
        addToGroup(map, key, toEntry(commit, type, commit.message));
        break;
      }
    }
  }

  return sortGroups(map);
}
