import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { filterCommits } from '../../src/commit-filter.js';
import type { GitCommit } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCommit(overrides: Partial<GitCommit> = {}): GitCommit {
  return {
    hash: 'a'.repeat(40),
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

describe('filterCommits()', () => {
  it('patterns: [] → all commits pass through unchanged', () => {
    const commits = [makeCommit(), makeCommit({ isMerge: true }), makeCommit({ subject: 'WIP: draft' })];
    const result = filterCommits(commits, []);
    assert.equal(result.length, 3);
    assert.deepEqual(result, commits);
  });

  it('patterns: ["merge"] + isMerge commit → commit excluded', () => {
    const mergeCommit = makeCommit({ isMerge: true });
    const result = filterCommits([mergeCommit], ['merge']);
    assert.equal(result.length, 0);
  });

  it('patterns: ["merge"] + non-merge commit → commit included', () => {
    const normalCommit = makeCommit({ isMerge: false });
    const result = filterCommits([normalCommit], ['merge']);
    assert.equal(result.length, 1);
  });

  it('patterns: ["wip"] + subject "WIP: something" (case-insensitive) → excluded', () => {
    const commit = makeCommit({ subject: 'WIP: something important' });
    const result = filterCommits([commit], ['wip']);
    assert.equal(result.length, 0);
  });

  it('patterns: ["wip"] + subject "feat: add wip counter" → included (not a prefix match)', () => {
    const commit = makeCommit({ subject: 'feat: add wip counter' });
    const result = filterCommits([commit], ['wip']);
    assert.equal(result.length, 1);
  });

  it('patterns: ["merge", "wip", "fixup!"] → all three applied; only clean commits remain', () => {
    const commits = [
      makeCommit({ subject: 'feat: good commit' }),
      makeCommit({ isMerge: true, subject: 'Merge branch x' }),
      makeCommit({ subject: 'WIP: draft work' }),
      makeCommit({ subject: 'fixup! previous commit' }),
      makeCommit({ subject: 'fix: another good commit' }),
    ];
    const result = filterCommits(commits, ['merge', 'wip', 'fixup!']);
    assert.equal(result.length, 2);
    assert.equal((result[0]).subject, 'feat: good commit');
    assert.equal((result[1]).subject, 'fix: another good commit');
  });

  it('default patterns ["merge", "wip"] applied to a five-commit fixture → correct subset returned', () => {
    const commits = [
      makeCommit({ hash: '1'.repeat(40), subject: 'feat: feature A' }),
      makeCommit({ hash: '2'.repeat(40), subject: 'WIP: half-done' }),
      makeCommit({ hash: '3'.repeat(40), isMerge: true, subject: 'Merge pull request #5' }),
      makeCommit({ hash: '4'.repeat(40), subject: 'fix: broken thing' }),
      makeCommit({ hash: '5'.repeat(40), subject: 'docs: update README' }),
    ];
    const result = filterCommits(commits, ['merge', 'wip']);
    assert.equal(result.length, 3);
    assert.equal((result[0]).hash, '1'.repeat(40));
    assert.equal((result[1]).hash, '4'.repeat(40));
    assert.equal((result[2]).hash, '5'.repeat(40));
  });

  // -------------------------------------------------------------------------
  // T025 — US5 custom exclusion patterns (--exclude flag)
  // -------------------------------------------------------------------------

  it('--exclude="fixup!" → only fixup!-prefix commits excluded; merge commits pass through', () => {
    const commits = [
      makeCommit({ subject: 'fixup! fix typo in auth' }),
      makeCommit({ isMerge: true, subject: 'Merge branch feature-x' }),
      makeCommit({ subject: 'feat: normal commit' }),
    ];
    const result = filterCommits(commits, ['fixup!']);

    assert.equal(result.length, 2, 'only fixup! commit should be excluded');
    assert.ok(
      (result).some((c) => c.isMerge === true),
      'merge commit should pass through when only "fixup!" is excluded',
    );
    assert.ok(
      (result).some((c) => c.subject === 'feat: normal commit'),
      'normal commit should pass through',
    );
  });

  it('--exclude="" (empty array) → all commits pass through including merges', () => {
    const commits = [
      makeCommit({ isMerge: true, subject: 'Merge branch x' }),
      makeCommit({ subject: 'WIP: draft' }),
      makeCommit({ subject: 'fixup! previous' }),
    ];
    const result = filterCommits(commits, []);

    assert.equal(result.length, 3, 'all commits should pass through with empty patterns');
    assert.ok(
      (result).some((c) => c.isMerge === true),
      'merge commit should pass through',
    );
  });

  it('--exclude="merge,wip,fixup!" → all three patterns active; each corresponding commit excluded', () => {
    const commits = [
      makeCommit({ subject: 'feat: keep this' }),
      makeCommit({ isMerge: true, subject: 'Merge branch y' }),
      makeCommit({ subject: 'WIP: draft impl' }),
      makeCommit({ subject: 'fixup! cleanup' }),
    ];
    const result = filterCommits(commits, ['merge', 'wip', 'fixup!']);

    assert.equal(result.length, 1);
    assert.equal((result[0]).subject, 'feat: keep this');
  });
});
