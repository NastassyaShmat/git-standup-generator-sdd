// Feature: git-standup-generator, Property 2: Filter correctness
// Validates: Requirements 2.1, 2.2, 2.4, 2.6

import * as fc from 'fast-check';
import { filterCommits } from '../src/commitFilter';
import { GitCommit } from '../src/types';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Arbitrary commit message: printable strings that may contain any characters
 * including uppercase/lowercase to exercise case-insensitive matching.
 */
const commitMessage = fc.string({ minLength: 0, maxLength: 120 });

/**
 * Arbitrary GitCommit with random isMerge and message values.
 * Other fields are fixed to simple values since they are not relevant to filtering.
 */
const gitCommit: fc.Arbitrary<GitCommit> = fc
  .record({
    hash: fc.constant('abc1234'),
    message: commitMessage,
    author: fc.constant('Test Author'),
    email: fc.constant('test@example.com'),
    date: fc.constant(new Date('2024-01-01T00:00:00Z')),
    branch: fc.constant('main'),
    isMerge: fc.boolean(),
  });

/**
 * Arbitrary array of GitCommit objects (0–20 commits).
 */
const gitCommitArray = fc.array(gitCommit, { minLength: 0, maxLength: 20 });

/**
 * Arbitrary exclusion pattern: short strings (1–15 chars) to keep matching
 * tractable and representative of real-world patterns like "wip", "merge", etc.
 */
const exclusionPattern = fc.string({ minLength: 1, maxLength: 15 });

/**
 * Arbitrary array of exclusion patterns (0–5 patterns).
 */
const exclusionPatternArray = fc.array(exclusionPattern, { minLength: 0, maxLength: 5 });

// ---------------------------------------------------------------------------
// Helper: check if a commit message matches any pattern (case-insensitive)
// ---------------------------------------------------------------------------

function matchesAnyPattern(message: string, patterns: string[]): boolean {
  const messageLower = message.toLowerCase();
  return patterns.some((p) => messageLower.includes(p.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Property 2: Filter correctness
// ---------------------------------------------------------------------------

describe('Property 2: Filter correctness', () => {
  it('no merge commits remain in the output', () => {
    fc.assert(
      fc.property(gitCommitArray, exclusionPatternArray, (commits, patterns) => {
        const result = filterCommits(commits, patterns);

        // Requirement 2.1: all merge commits must be excluded
        for (const commit of result) {
          expect(commit.isMerge).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('no commits matching any exclusion pattern remain in the output', () => {
    fc.assert(
      fc.property(gitCommitArray, exclusionPatternArray, (commits, patterns) => {
        const result = filterCommits(commits, patterns);

        // Requirements 2.2, 2.4: commits matching any pattern must be excluded
        for (const commit of result) {
          expect(matchesAnyPattern(commit.message, patterns)).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('every non-merge, non-matching commit is present in the output (completeness)', () => {
    fc.assert(
      fc.property(gitCommitArray, exclusionPatternArray, (commits, patterns) => {
        const result = filterCommits(commits, patterns);

        // Requirement 2.6: all commits that should pass the filter ARE in the output
        const expectedToPass = commits.filter(
          (c) => !c.isMerge && !matchesAnyPattern(c.message, patterns)
        );

        expect(result).toHaveLength(expectedToPass.length);

        // Verify each expected commit is present (by reference identity since
        // filterCommits returns the same objects, not copies)
        for (const expected of expectedToPass) {
          expect(result).toContain(expected);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('all three invariants hold simultaneously for the same inputs', () => {
    fc.assert(
      fc.property(gitCommitArray, exclusionPatternArray, (commits, patterns) => {
        const result = filterCommits(commits, patterns);

        // Invariant 1 (Req 2.1): no merge commits
        const noMerges = result.every((c) => !c.isMerge);

        // Invariant 2 (Req 2.2, 2.4): no pattern-matching commits
        const noPatternMatches = result.every(
          (c) => !matchesAnyPattern(c.message, patterns)
        );

        // Invariant 3 (Req 2.6): completeness — nothing valid was dropped
        const expectedToPass = commits.filter(
          (c) => !c.isMerge && !matchesAnyPattern(c.message, patterns)
        );
        const complete = result.length === expectedToPass.length;

        expect(noMerges).toBe(true);
        expect(noPatternMatches).toBe(true);
        expect(complete).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests for Commit_Filter (Task 5.3)
// Validates: Requirements 2.2, 2.3, 2.5, 2.7
// ---------------------------------------------------------------------------

/**
 * Helper to build a minimal GitCommit for testing.
 * Only `message` and `isMerge` are varied; other fields use fixed values.
 */
function makeCommit(message: string, isMerge = false): GitCommit {
  return {
    hash: 'abc1234',
    message,
    author: 'Test Author',
    email: 'test@example.com',
    date: new Date('2024-01-01T00:00:00Z'),
    branch: 'main',
    isMerge,
  };
}

describe('Commit_Filter unit tests', () => {
  // -------------------------------------------------------------------------
  // Default patterns ["merge", "wip"]
  // -------------------------------------------------------------------------

  describe('default patterns ["merge", "wip"]', () => {
    const defaultPatterns = ['merge', 'wip'];

    it('excludes a commit whose message contains "Merge branch"', () => {
      const commits = [makeCommit("Merge branch 'main'")];
      expect(filterCommits(commits, defaultPatterns)).toHaveLength(0);
    });

    it('excludes a commit whose message contains "WIP: work in progress"', () => {
      const commits = [makeCommit('WIP: work in progress')];
      expect(filterCommits(commits, defaultPatterns)).toHaveLength(0);
    });

    it('includes a commit whose message is "feat: add feature"', () => {
      const commits = [makeCommit('feat: add feature')];
      const result = filterCommits(commits, defaultPatterns);
      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('feat: add feature');
    });

    it('correctly separates excluded and included commits in a mixed list', () => {
      const commits = [
        makeCommit("Merge branch 'main'"),
        makeCommit('WIP: work in progress'),
        makeCommit('feat: add feature'),
        makeCommit('fix: correct typo'),
      ];
      const result = filterCommits(commits, defaultPatterns);
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.message)).toEqual([
        'feat: add feature',
        'fix: correct typo',
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // Case-insensitive matching (Requirement 2.2, 2.3)
  // -------------------------------------------------------------------------

  describe('case-insensitive matching', () => {
    it('excludes "WIP fix" (uppercase) when pattern is "wip"', () => {
      expect(filterCommits([makeCommit('WIP fix')], ['wip'])).toHaveLength(0);
    });

    it('excludes "wip fix" (lowercase) when pattern is "wip"', () => {
      expect(filterCommits([makeCommit('wip fix')], ['wip'])).toHaveLength(0);
    });

    it('excludes "Wip fix" (title case) when pattern is "wip"', () => {
      expect(filterCommits([makeCommit('Wip fix')], ['wip'])).toHaveLength(0);
    });

    it('excludes "WiP fix" (mixed case) when pattern is "wip"', () => {
      expect(filterCommits([makeCommit('WiP fix')], ['wip'])).toHaveLength(0);
    });

    it('excludes a commit when the pattern itself is uppercase ("WIP") and message is lowercase', () => {
      expect(filterCommits([makeCommit('wip: something')], ['WIP'])).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Empty list returned when all commits are filtered out (Requirement 2.7)
  // -------------------------------------------------------------------------

  describe('empty list when all commits are filtered out', () => {
    it('returns empty array when all commits are merge commits', () => {
      const commits = [
        makeCommit('Merge branch A', true),
        makeCommit('Merge branch B', true),
      ];
      expect(filterCommits(commits, [])).toHaveLength(0);
    });

    it('returns empty array when all commits match exclusion patterns', () => {
      const commits = [
        makeCommit('WIP: half-done'),
        makeCommit('merge remote-tracking branch'),
        makeCommit('fixup! previous commit'),
      ];
      expect(filterCommits(commits, ['wip', 'merge', 'fixup'])).toHaveLength(0);
    });

    it('returns empty array when commits are a mix of merges and pattern matches', () => {
      const commits = [
        makeCommit('Merge pull request #42', true),
        makeCommit('WIP: still working'),
      ];
      expect(filterCommits(commits, ['wip'])).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Empty input array (edge case)
  // -------------------------------------------------------------------------

  describe('empty input array', () => {
    it('returns empty array when given an empty commits list', () => {
      expect(filterCommits([], ['wip', 'merge'])).toHaveLength(0);
    });

    it('returns empty array when given empty commits and empty patterns', () => {
      expect(filterCommits([], [])).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Empty patterns array still excludes merge commits (Requirement 2.1)
  // -------------------------------------------------------------------------

  describe('empty patterns array still excludes merge commits', () => {
    it('excludes merge commits even when excludePatterns is empty', () => {
      const commits = [
        makeCommit('Merge branch X', true),
        makeCommit('feat: real work'),
      ];
      const result = filterCommits(commits, []);
      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('feat: real work');
    });

    it('returns all non-merge commits when excludePatterns is empty', () => {
      const commits = [
        makeCommit('feat: add login'),
        makeCommit('fix: null pointer'),
        makeCommit('Merge branch Y', true),
      ];
      const result = filterCommits(commits, []);
      expect(result).toHaveLength(2);
    });
  });
});
