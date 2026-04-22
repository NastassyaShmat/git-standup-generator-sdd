import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { groupCommits } from '../../src/commit-grouper.js';
import type { GitCommit, StandupEntry } from '../../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = resolve(__dirname, '../../src/cli.ts');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _hashSeq = 0;

function makeCommit(overrides: Partial<GitCommit> = {}): GitCommit {
  const seq = String(_hashSeq++).padStart(40, '0');
  return {
    hash: seq,
    subject: 'feat: default commit',
    author: 'Alice',
    email: 'alice@example.com',
    date: '2026-04-20T10:00:00+00:00',
    branch: 'main',
    isMerge: false,
    files: ['src/main.ts'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('groupCommits()', () => {
  it('groupBy "type" + conventional "feat: add login" → key "feat", message "add login", 7-char hash', () => {
    const hash = 'abcdef1234567890'.repeat(2) + 'abcdef12';
    const commit = makeCommit({ hash, subject: 'feat: add login' });
    const result = groupCommits([commit], 'type');

    assert.ok(result.has('feat'));
    const entries = result.get('feat') as StandupEntry[];
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.message, 'add login');
    assert.equal(entries[0]?.hash.length, 7);
    assert.equal(entries[0]?.hash, hash.slice(0, 7));
  });

  it('groupBy "type" + non-conventional subject → key "other", message verbatim', () => {
    const commit = makeCommit({ subject: 'random message without type' });
    const result = groupCommits([commit], 'type');

    assert.ok(result.has('other'));
    const entries = result.get('other') as StandupEntry[];
    assert.equal(entries[0]?.message, 'random message without type');
  });

  it('groupBy "type" with mixed types → correct keys and entry counts', () => {
    const commits = [
      makeCommit({ subject: 'feat: feature A' }),
      makeCommit({ subject: 'feat: feature B' }),
      makeCommit({ subject: 'fix: fix a bug' }),
      makeCommit({ subject: 'chore: update deps' }),
    ];
    const result = groupCommits(commits, 'type');

    assert.equal((result.get('feat') ?? []).length, 2);
    assert.equal((result.get('fix') ?? []).length, 1);
    assert.equal((result.get('chore') ?? []).length, 1);
  });

  it('groupBy "branch" → entries keyed by commit.branch', () => {
    const commits = [
      makeCommit({ branch: 'feature/auth' }),
      makeCommit({ branch: 'feature/auth' }),
      makeCommit({ branch: 'main' }),
    ];
    const result = groupCommits(commits, 'branch');

    assert.ok(result.has('feature/auth'));
    assert.ok(result.has('main'));
    assert.equal((result.get('feature/auth') ?? []).length, 2);
    assert.equal((result.get('main') ?? []).length, 1);
  });

  it('groupBy "branch" → commit with branch "unknown" → key "unknown"', () => {
    const commit = makeCommit({ branch: 'unknown' });
    const result = groupCommits([commit], 'branch');

    assert.ok(result.has('unknown'));
  });

  it('groupBy "path" + files ["src/api/routes.ts"] → key "src"', () => {
    const commit = makeCommit({ files: ['src/api/routes.ts'] });
    const result = groupCommits([commit], 'path');

    assert.ok(result.has('src'));
  });

  it('groupBy "path" + files ["README.md"] → key "root" (no slash)', () => {
    const commit = makeCommit({ files: ['README.md'] });
    const result = groupCommits([commit], 'path');

    assert.ok(result.has('root'));
  });

  it('groupBy "path" + files [] → key "root"', () => {
    const commit = makeCommit({ files: [] });
    const result = groupCommits([commit], 'path');

    assert.ok(result.has('root'));
  });

  it('groups sorted by entry count descending', () => {
    // feat has 3, fix has 1 → feat comes first
    const commits = [
      makeCommit({ subject: 'feat: A' }),
      makeCommit({ subject: 'feat: B' }),
      makeCommit({ subject: 'feat: C' }),
      makeCommit({ subject: 'fix: D' }),
    ];
    const result = groupCommits(commits, 'type');
    const keys = [...result.keys()];

    assert.equal(keys[0], 'feat');
    assert.equal(keys[1], 'fix');
  });

  it('entries within each group sorted by timestamp descending (newest first)', () => {
    const commits = [
      makeCommit({ subject: 'feat: older',  date: '2026-04-19T08:00:00+00:00' }),
      makeCommit({ subject: 'feat: newer',  date: '2026-04-20T08:00:00+00:00' }),
      makeCommit({ subject: 'feat: middle', date: '2026-04-19T18:00:00+00:00' }),
    ];
    const result = groupCommits(commits, 'type');
    const entries = result.get('feat') as StandupEntry[];

    assert.equal(entries[0]?.message, 'newer');
    assert.equal(entries[1]?.message, 'middle');
    assert.equal(entries[2]?.message, 'older');
  });

  // -------------------------------------------------------------------------
  // T023 — US4 grouping strategy selection (--group-by flag)
  // -------------------------------------------------------------------------

  it('--group-by=branch → commits keyed by branch name (explicit US4 test)', () => {
    const commits = [
      makeCommit({ branch: 'main', subject: 'feat: main commit' }),
      makeCommit({ branch: 'develop', subject: 'feat: develop commit' }),
    ];
    const result = groupCommits(commits, 'branch');

    assert.ok(result.has('main'));
    assert.ok(result.has('develop'));
    assert.equal((result.get('main') ?? []).length, 1);
    assert.equal((result.get('develop') ?? []).length, 1);
  });

  it('--group-by=path → commits keyed by top-level directory prefix (explicit US4 test)', () => {
    const commits = [
      makeCommit({ files: ['src/utils.ts'], subject: 'feat: src change' }),
      makeCommit({ files: ['tests/main.test.ts'], subject: 'test: test change' }),
    ];
    const result = groupCommits(commits, 'path');

    assert.ok(result.has('src'));
    assert.ok(result.has('tests'));
  });

  it('invalid --group-by=author → cli exits 1 with error message', () => {
    const result = spawnSync('node', ['--import', 'tsx', CLI_PATH, '--group-by=author'], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 1, `Expected exit 1; got ${result.status}`);
    assert.ok(
      result.stderr.includes('Invalid --group-by value') || result.stderr.includes("'author'"),
      `Expected group-by error in stderr; got: ${result.stderr}`,
    );
  });
});
