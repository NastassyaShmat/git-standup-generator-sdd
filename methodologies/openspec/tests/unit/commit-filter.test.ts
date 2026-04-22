import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterCommits } from '../../src/commit-filter.js';
import type { GitCommit } from '../../src/types.js';

function makeCommit(overrides: Partial<GitCommit> = {}): GitCommit {
  return {
    hash: 'a'.repeat(40),
    message: 'feat: some work',
    author: 'Alice',
    email: 'alice@example.com',
    date: new Date('2026-04-20T09:00:00Z'),
    branch: 'main',
    isMerge: false,
    ...overrides,
  };
}

describe('filterCommits()', () => {
  it('merge commit is always dropped (even with empty exclude list)', () => {
    const commits = [makeCommit({ isMerge: true, message: 'Merge branch main' })];
    const result = filterCommits(commits, []);
    assert.equal(result.length, 0);
  });

  it('default excludes ["merge", "wip"] drop WIP and merge-prefixed commits', () => {
    const commits = [
      makeCommit({ message: 'WIP: not ready' }),
      makeCommit({ message: 'wip: also not ready' }),
      makeCommit({ message: 'Merge branch feature' }),
      makeCommit({ message: 'feat: clean commit' }),
    ];
    const result = filterCommits(commits, ['merge', 'wip']);
    assert.equal(result.length, 1);
    assert.equal(result[0]?.message, 'feat: clean commit');
  });

  it('empty exclude list only drops merge commits', () => {
    const commits = [
      makeCommit({ message: 'WIP: something', isMerge: false }),
      makeCommit({ message: 'Merge branch', isMerge: true }),
      makeCommit({ message: 'feat: real work' }),
    ];
    const result = filterCommits(commits, []);
    assert.equal(result.length, 2);
    assert.ok(result.some((c) => c.message === 'WIP: something'));
    assert.ok(result.some((c) => c.message === 'feat: real work'));
  });

  it('mixed-case exclusion patterns match case-insensitively', () => {
    const commits = [
      makeCommit({ message: 'FIXUP! cleanup' }),
      makeCommit({ message: 'fixup! another' }),
      makeCommit({ message: 'feat: keep this' }),
    ];
    const result = filterCommits(commits, ['fixup!']);
    assert.equal(result.length, 1);
    assert.equal(result[0]?.message, 'feat: keep this');
  });

  it('preserves input order', () => {
    const commits = [
      makeCommit({ message: 'feat: first', hash: '1'.repeat(40) }),
      makeCommit({ message: 'feat: second', hash: '2'.repeat(40) }),
      makeCommit({ message: 'feat: third', hash: '3'.repeat(40) }),
    ];
    const result = filterCommits(commits, []);
    assert.equal(result[0]?.message, 'feat: first');
    assert.equal(result[1]?.message, 'feat: second');
    assert.equal(result[2]?.message, 'feat: third');
  });

  it('custom patterns replace defaults — old defaults no longer filter', () => {
    const commits = [
      makeCommit({ message: 'WIP: still excluded by default?', isMerge: false }),
      makeCommit({ message: 'fixup! custom pattern', isMerge: false }),
    ];
    // Custom exclude: only "fixup!", not "wip"
    const result = filterCommits(commits, ['fixup!']);
    assert.equal(result.length, 1);
    assert.equal(result[0]?.message, 'WIP: still excluded by default?');
  });
});
