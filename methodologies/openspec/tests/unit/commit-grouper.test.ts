import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { groupCommits } from '../../src/commit-grouper.js';
import type { GitCommit } from '../../src/types.js';

function makeCommit(overrides: Partial<GitCommit> = {}): GitCommit {
  return {
    hash: 'a'.repeat(40),
    message: 'feat: default commit',
    author: 'Alice',
    email: 'alice@example.com',
    date: new Date('2026-04-20T10:00:00Z'),
    branch: 'main',
    isMerge: false,
    ...overrides,
  };
}

describe('groupCommits() — type strategy', () => {
  it('conventional feat commit → key "feat", message stripped of prefix', async () => {
    const commit = makeCommit({ hash: 'a'.repeat(40), message: 'feat: add login' });
    const result = await groupCommits([commit], 'type');

    assert.ok('feat' in result);
    const entries = result['feat'] ?? [];
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.message, 'add login');
    assert.equal(entries[0]?.hash.length, 7);
  });

  it('non-conventional commit → key "other", message preserved verbatim', async () => {
    const commit = makeCommit({ message: 'random commit without type' });
    const result = await groupCommits([commit], 'type');

    assert.ok('other' in result);
    assert.equal(result['other']?.[0]?.message, 'random commit without type');
  });

  it('breaking-change "feat(auth)!: redesign login" → key "feat"', async () => {
    const commit = makeCommit({ message: 'feat(auth)!: redesign login' });
    const result = await groupCommits([commit], 'type');

    assert.ok('feat' in result);
    assert.equal(result['feat']?.[0]?.message, 'redesign login');
  });

  it('scope in parens "fix(api): timeout fix" → key "fix"', async () => {
    const commit = makeCommit({ message: 'fix(api): timeout fix' });
    const result = await groupCommits([commit], 'type');

    assert.ok('fix' in result);
    assert.equal(result['fix']?.[0]?.message, 'timeout fix');
  });

  it('unrecognised prefix "hotfix: something" → key "other"', async () => {
    const commit = makeCommit({ message: 'hotfix: something urgent' });
    const result = await groupCommits([commit], 'type');

    assert.ok('other' in result);
  });

  it('multiple commits with mixed types → correct group keys', async () => {
    const commits = [
      makeCommit({ hash: '1'.repeat(40), message: 'feat: feature A' }),
      makeCommit({ hash: '2'.repeat(40), message: 'feat: feature B' }),
      makeCommit({ hash: '3'.repeat(40), message: 'fix: fix a bug' }),
      makeCommit({ hash: '4'.repeat(40), message: 'chore: update deps' }),
    ];
    const result = await groupCommits(commits, 'type');

    assert.equal(result['feat']?.length, 2);
    assert.equal(result['fix']?.length, 1);
    assert.equal(result['chore']?.length, 1);
  });
});

describe('groupCommits() — branch strategy', () => {
  it('commits on different branches → keyed by branch', async () => {
    const commits = [
      makeCommit({ hash: '1'.repeat(40), branch: 'feature/auth', message: 'feat: auth work' }),
      makeCommit({ hash: '2'.repeat(40), branch: 'main', message: 'fix: hotfix' }),
    ];
    const result = await groupCommits(commits, 'branch');

    assert.ok('feature/auth' in result);
    assert.ok('main' in result);
    assert.equal(result['feature/auth']?.length, 1);
    assert.equal(result['main']?.length, 1);
  });

  it('branch strategy preserves full message (not stripped)', async () => {
    const commit = makeCommit({ branch: 'main', message: 'feat: add login' });
    const result = await groupCommits([commit], 'branch');

    assert.equal(result['main']?.[0]?.message, 'feat: add login');
  });
});

describe('groupCommits() — sorting', () => {
  it('groups sorted by entry count descending', async () => {
    const commits = [
      makeCommit({ hash: '1'.repeat(40), message: 'feat: A' }),
      makeCommit({ hash: '2'.repeat(40), message: 'feat: B' }),
      makeCommit({ hash: '3'.repeat(40), message: 'feat: C' }),
      makeCommit({ hash: '4'.repeat(40), message: 'fix: D' }),
    ];
    const result = await groupCommits(commits, 'type');
    const keys = Object.keys(result);

    assert.equal(keys[0], 'feat');
    assert.equal(keys[1], 'fix');
  });

  it('entries within group sorted newest first', async () => {
    const commits = [
      makeCommit({ hash: '1'.repeat(40), message: 'feat: older', date: new Date('2026-04-19T08:00:00Z') }),
      makeCommit({ hash: '2'.repeat(40), message: 'feat: newer', date: new Date('2026-04-20T08:00:00Z') }),
    ];
    const result = await groupCommits(commits, 'type');
    const entries = result['feat'] ?? [];

    assert.equal(entries[0]?.message, 'newer');
    assert.equal(entries[1]?.message, 'older');
  });
});
