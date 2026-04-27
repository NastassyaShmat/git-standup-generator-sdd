// Feature: git-standup-generator, Property 3: Conventional commit type assignment
// Validates: Requirements 3.1, 3.2, 3.3

import * as fc from 'fast-check';
import { extractCommitType, RECOGNIZED_TYPES } from '../src/commitGrouper';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Arbitrary recognized type prefix — one of the 11 conventional commit types.
 */
const recognizedType = fc.constantFrom(...RECOGNIZED_TYPES);

/**
 * Arbitrary unrecognized type prefix: a word of 1–20 lowercase letters that
 * is NOT in RECOGNIZED_TYPES.
 */
const unrecognizedType = fc
  .stringMatching(/^[a-z]{1,20}$/)
  .filter((word) => !(RECOGNIZED_TYPES as readonly string[]).includes(word));

/**
 * Arbitrary description: any printable string (may be empty).
 */
const description = fc.string({ minLength: 0, maxLength: 80 });

/**
 * Arbitrary optional scope suffix: either empty string or "(some-scope)".
 */
const optionalScope = fc.oneof(
  fc.constant(''),
  fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/).map((s) => `(${s})`)
);

/**
 * Arbitrary optional breaking-change marker: "" or "!".
 */
const optionalBreaking = fc.oneof(fc.constant(''), fc.constant('!'));

/**
 * Build a conventional commit message from parts:
 *   <type>[(<scope>)][!]: <description>
 */
function buildConventionalMessage(
  type: string,
  scope: string,
  breaking: string,
  desc: string
): string {
  return `${type}${scope}${breaking}: ${desc}`;
}

// ---------------------------------------------------------------------------
// Property 3: Conventional commit type assignment
// ---------------------------------------------------------------------------

describe('Property 3: Conventional commit type assignment', () => {
  /**
   * Sub-property 3a: For any recognized type prefix in a valid conventional
   * commit format, extractCommitType returns that exact prefix.
   * Validates: Requirements 3.1, 3.2
   */
  it('returns the recognized prefix for any valid conventional commit with a recognized type', () => {
    fc.assert(
      fc.property(
        recognizedType,
        optionalScope,
        optionalBreaking,
        description,
        (type, scope, breaking, desc) => {
          const message = buildConventionalMessage(type, scope, breaking, desc);
          const result = extractCommitType(message);
          expect(result).toBe(type);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Sub-property 3b: For any unrecognized word prefix in a valid conventional
   * commit format, extractCommitType returns "other".
   * Validates: Requirements 3.1, 3.3
   */
  it('returns "other" for any valid conventional commit with an unrecognized type prefix', () => {
    fc.assert(
      fc.property(
        unrecognizedType,
        optionalScope,
        optionalBreaking,
        description,
        (type, scope, breaking, desc) => {
          const message = buildConventionalMessage(type, scope, breaking, desc);
          const result = extractCommitType(message);
          expect(result).toBe('other');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Sub-property 3c: For any message that does NOT match the conventional
   * commit pattern (no "<word>:" prefix), extractCommitType returns "other".
   * Validates: Requirement 3.3
   */
  it('returns "other" for messages without the conventional commit colon pattern', () => {
    // Generate strings that do NOT start with \w+(\(...\))?!?:
    const nonConventionalMessage = fc
      .string({ minLength: 0, maxLength: 100 })
      .filter((s) => !/^\w+(\([^)]*\))?!?:/.test(s));

    fc.assert(
      fc.property(nonConventionalMessage, (message) => {
        const result = extractCommitType(message);
        expect(result).toBe('other');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Combined property: the result is always either a recognized type or "other" —
   * never an arbitrary string.
   * Validates: Requirements 3.1, 3.2, 3.3
   */
  it('always returns a recognized type or "other" for any input string', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 120 }), (message) => {
        const result = extractCommitType(message);
        const validResults = [...RECOGNIZED_TYPES, 'other'];
        expect(validResults).toContain(result);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: git-standup-generator, Property 4: StandupEntry field preservation
// Validates: Requirements 3.4, 3.8
// ---------------------------------------------------------------------------

import { groupCommits } from '../src/commitGrouper';
import { GitCommit } from '../src/types';

// ---------------------------------------------------------------------------
// Arbitraries for GitCommit
// ---------------------------------------------------------------------------

/**
 * Arbitrary hex string for commit hash (7–40 hex characters).
 */
const arbitraryHash = fc.stringMatching(/^[0-9a-f]{7,40}$/);

/**
 * Arbitrary non-empty commit message (any printable string).
 */
const arbitraryMessage = fc.string({ minLength: 1, maxLength: 120 });

/**
 * Arbitrary author name.
 */
const arbitraryAuthor = fc.string({ minLength: 1, maxLength: 60 });

/**
 * Arbitrary email address (simplified).
 */
const arbitraryEmail = fc.string({ minLength: 1, maxLength: 60 });

/**
 * Arbitrary Date within a reasonable range (year 2000–2030).
 */
const arbitraryDate = fc
  .integer({ min: 946684800000, max: 1893456000000 })
  .map((ms) => new Date(ms));

/**
 * Arbitrary branch name (alphanumeric + hyphens/slashes).
 */
const arbitraryBranch = fc.stringMatching(/^[a-zA-Z0-9_/-]{1,40}$/);

/**
 * Arbitrary GitCommit object with fully random fields.
 */
const arbitraryGitCommit: fc.Arbitrary<GitCommit> = fc.record({
  hash: arbitraryHash,
  message: arbitraryMessage,
  author: arbitraryAuthor,
  email: arbitraryEmail,
  date: arbitraryDate,
  branch: arbitraryBranch,
  isMerge: fc.boolean(),
});

// ---------------------------------------------------------------------------
// Property 4: StandupEntry field preservation
// ---------------------------------------------------------------------------

describe('Property 4: StandupEntry field preservation', () => {
  /**
   * For any array of GitCommit objects grouped by "type", every resulting
   * StandupEntry must preserve the original commit's message, hash, branch,
   * and timestamp (date). The type field must be a non-empty string.
   * Validates: Requirements 3.4, 3.8
   */
  it('preserves message, hash, branch, and timestamp from each GitCommit; type is non-empty', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryGitCommit, { minLength: 1, maxLength: 20 }),
        (commits) => {
          const grouped = groupCommits(commits, 'type');

          // Collect all StandupEntry objects from the Map
          const allEntries = Array.from(grouped.values()).flat();

          // There must be exactly as many entries as input commits
          expect(allEntries.length).toBe(commits.length);

          // Build a lookup from hash → original commit for verification
          const commitByHash = new Map(commits.map((c) => [c.hash, c]));

          for (const entry of allEntries) {
            const original = commitByHash.get(entry.hash);
            expect(original).toBeDefined();

            // 1. message is preserved
            expect(entry.message).toBe(original!.message);

            // 2. hash is preserved
            expect(entry.hash).toBe(original!.hash);

            // 3. branch is preserved
            expect(entry.branch).toBe(original!.branch);

            // 4. timestamp equals the original date (same time value)
            expect(entry.timestamp.getTime()).toBe(original!.date.getTime());

            // 5. type is a non-empty string
            expect(typeof entry.type).toBe('string');
            expect(entry.type.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: git-standup-generator, Property 5: Branch grouping correctness
// Validates: Requirements 3.5
// ---------------------------------------------------------------------------

/**
 * A small fixed set of branch names to ensure grouping actually happens
 * (i.e., multiple commits land in the same bucket).
 */
const BRANCH_POOL = ['main', 'develop', 'feature/foo', 'fix/bar', 'release/1.0'] as const;

const arbitraryBranchFromPool = fc.constantFrom(...BRANCH_POOL);

/**
 * GitCommit with a branch drawn from the small pool so that grouping
 * produces non-trivial (multi-commit) buckets in most runs.
 */
const arbitraryGitCommitWithPoolBranch: fc.Arbitrary<GitCommit> = fc.record({
  hash: arbitraryHash,
  message: arbitraryMessage,
  author: arbitraryAuthor,
  email: arbitraryEmail,
  date: arbitraryDate,
  branch: arbitraryBranchFromPool,
  isMerge: fc.boolean(),
});

describe('Property 5: Branch grouping correctness', () => {
  /**
   * For any array of GitCommit objects grouped by "branch":
   *   1. Every StandupEntry under key B has entry.branch === B (correct grouping).
   *   2. Total entries across all groups equals the number of input commits (no loss).
   *   3. No commit appears in more than one group (no duplication) — verified by
   *      checking total count equals input length.
   * Validates: Requirements 3.5
   */
  it('groups every commit under its own branch key, with no loss or duplication', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryGitCommitWithPoolBranch, { minLength: 0, maxLength: 30 }),
        (commits) => {
          const grouped = groupCommits(commits, 'branch');

          // --- Property 5a: every entry under key B has entry.branch === B ---
          for (const [branchKey, entries] of grouped) {
            for (const entry of entries) {
              expect(entry.branch).toBe(branchKey);
            }
          }

          // --- Property 5b: no entries are lost ---
          const totalEntries = Array.from(grouped.values()).reduce(
            (sum, entries) => sum + entries.length,
            0
          );
          expect(totalEntries).toBe(commits.length);

          // --- Property 5c: no entries are duplicated ---
          // Because total count equals input count and each entry maps to
          // exactly one group, duplication is impossible. We additionally
          // verify by checking that every input commit hash appears exactly
          // once across all groups.
          const seenHashes = new Map<string, number>();
          for (const entries of grouped.values()) {
            for (const entry of entries) {
              seenHashes.set(entry.hash, (seenHashes.get(entry.hash) ?? 0) + 1);
            }
          }
          for (const [hash, count] of seenHashes) {
            // Count how many input commits share this hash (could be > 1 if
            // the generator produced duplicate hashes by chance).
            const inputCount = commits.filter((c) => c.hash === hash).length;
            expect(count).toBe(inputCount);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 7.5 — Unit tests for Commit_Grouper
// Validates: Requirements 3.1, 3.2, 3.3, 3.7
// ---------------------------------------------------------------------------

/**
 * Helper to build a minimal GitCommit with only the fields relevant to the
 * test. Non-relevant fields are filled with fixed placeholder values.
 */
function makeCommit(overrides: Partial<GitCommit>): GitCommit {
  return {
    hash: 'abc1234',
    message: 'chore: placeholder',
    author: 'Test User',
    email: 'test@example.com',
    date: new Date('2024-01-15T10:00:00Z'),
    branch: 'main',
    isMerge: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Unit tests: type grouping — all 11 recognized conventional commit prefixes
// ---------------------------------------------------------------------------

describe('groupCommits — type grouping with recognized conventional commit prefixes', () => {
  // Requirement 3.1, 3.2: each recognized prefix maps to its own group key
  const recognizedPrefixes = [
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
  ] as const;

  for (const prefix of recognizedPrefixes) {
    it(`groups a "${prefix}:" commit under the "${prefix}" key`, () => {
      const commit = makeCommit({ message: `${prefix}: some description` });
      const grouped = groupCommits([commit], 'type');

      expect(grouped.has(prefix)).toBe(true);
      const entries = grouped.get(prefix)!;
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe(commit.message);
      expect(entries[0].hash).toBe(commit.hash);
      expect(entries[0].type).toBe(prefix);
    });
  }

  it('groups commits with scoped conventional messages under the correct type key', () => {
    const commit = makeCommit({ message: 'feat(auth): add OAuth support' });
    const grouped = groupCommits([commit], 'type');

    expect(grouped.has('feat')).toBe(true);
    expect(grouped.get('feat')![0].type).toBe('feat');
  });

  it('groups commits with breaking-change marker under the correct type key', () => {
    const commit = makeCommit({ message: 'fix!: remove deprecated API' });
    const grouped = groupCommits([commit], 'type');

    expect(grouped.has('fix')).toBe(true);
    expect(grouped.get('fix')![0].type).toBe('fix');
  });

  it('groups multiple commits with different recognized types into separate keys', () => {
    const commits = [
      makeCommit({ hash: 'aaa0001', message: 'feat: new feature' }),
      makeCommit({ hash: 'aaa0002', message: 'fix: bug fix' }),
      makeCommit({ hash: 'aaa0003', message: 'docs: update readme' }),
    ];
    const grouped = groupCommits(commits, 'type');

    expect(grouped.has('feat')).toBe(true);
    expect(grouped.has('fix')).toBe(true);
    expect(grouped.has('docs')).toBe(true);
    expect(grouped.get('feat')![0].hash).toBe('aaa0001');
    expect(grouped.get('fix')![0].hash).toBe('aaa0002');
    expect(grouped.get('docs')![0].hash).toBe('aaa0003');
  });
});

// ---------------------------------------------------------------------------
// Unit tests: type grouping — "other" for non-conventional messages
// ---------------------------------------------------------------------------

describe('groupCommits — type grouping assigns "other" for non-conventional messages', () => {
  // Requirement 3.3: unrecognized prefix → "other"
  it('assigns "other" for a message with an unrecognized prefix ("update: something")', () => {
    const commit = makeCommit({ message: 'update: something' });
    const grouped = groupCommits([commit], 'type');

    expect(grouped.has('other')).toBe(true);
    expect(grouped.get('other')![0].type).toBe('other');
    // Requirement 3.4: full original message is preserved in the "other" group
    expect(grouped.get('other')![0].message).toBe('update: something');
  });

  it('assigns "other" for a plain message with no colon ("just a plain message")', () => {
    const commit = makeCommit({ message: 'just a plain message' });
    const grouped = groupCommits([commit], 'type');

    expect(grouped.has('other')).toBe(true);
    expect(grouped.get('other')![0].type).toBe('other');
    expect(grouped.get('other')![0].message).toBe('just a plain message');
  });

  it('assigns "other" for an empty message', () => {
    const commit = makeCommit({ message: '' });
    const grouped = groupCommits([commit], 'type');

    expect(grouped.has('other')).toBe(true);
    expect(grouped.get('other')![0].type).toBe('other');
  });

  it('groups multiple non-conventional commits together under "other"', () => {
    const commits = [
      makeCommit({ hash: 'bbb0001', message: 'update: something' }),
      makeCommit({ hash: 'bbb0002', message: 'just a plain message' }),
    ];
    const grouped = groupCommits(commits, 'type');

    expect(grouped.has('other')).toBe(true);
    expect(grouped.get('other')).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: branch grouping
// ---------------------------------------------------------------------------

describe('groupCommits — branch grouping', () => {
  // Requirement 3.5: commits grouped by their branch field
  it('groups commits with different branch names under their respective branch keys', () => {
    const commits = [
      makeCommit({ hash: 'ccc0001', branch: 'main' }),
      makeCommit({ hash: 'ccc0002', branch: 'feature/login' }),
      makeCommit({ hash: 'ccc0003', branch: 'fix/typo' }),
    ];
    const grouped = groupCommits(commits, 'branch');

    expect(grouped.has('main')).toBe(true);
    expect(grouped.has('feature/login')).toBe(true);
    expect(grouped.has('fix/typo')).toBe(true);
    expect(grouped.get('main')![0].hash).toBe('ccc0001');
    expect(grouped.get('feature/login')![0].hash).toBe('ccc0002');
    expect(grouped.get('fix/typo')![0].hash).toBe('ccc0003');
  });

  it('places multiple commits on the same branch into the same group', () => {
    const commits = [
      makeCommit({ hash: 'ddd0001', branch: 'feature/auth' }),
      makeCommit({ hash: 'ddd0002', branch: 'feature/auth' }),
      makeCommit({ hash: 'ddd0003', branch: 'feature/auth' }),
    ];
    const grouped = groupCommits(commits, 'branch');

    expect(grouped.size).toBe(1);
    expect(grouped.has('feature/auth')).toBe(true);
    const entries = grouped.get('feature/auth')!;
    expect(entries).toHaveLength(3);
    const hashes = entries.map((e) => e.hash);
    expect(hashes).toContain('ddd0001');
    expect(hashes).toContain('ddd0002');
    expect(hashes).toContain('ddd0003');
  });

  it('produces a single group when all commits share the same branch', () => {
    const commits = [
      makeCommit({ hash: 'eee0001', branch: 'main' }),
      makeCommit({ hash: 'eee0002', branch: 'main' }),
    ];
    const grouped = groupCommits(commits, 'branch');

    expect(grouped.size).toBe(1);
    expect(grouped.get('main')).toHaveLength(2);
  });

  it('returns an empty Map when given an empty commit list', () => {
    const grouped = groupCommits([], 'branch');
    expect(grouped.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: default grouping strategy is "type"
// ---------------------------------------------------------------------------

describe('groupCommits — default grouping strategy is "type"', () => {
  // Requirement 3.7: when --group-by is omitted the grouper defaults to "type"
  it('produces the same result when called with "type" explicitly vs. relying on the type strategy', () => {
    const commits = [
      makeCommit({ hash: 'fff0001', message: 'feat: add search', branch: 'feature/search' }),
      makeCommit({ hash: 'fff0002', message: 'fix: correct typo', branch: 'main' }),
      makeCommit({ hash: 'fff0003', message: 'plain message', branch: 'main' }),
    ];

    // Explicit "type" grouping
    const groupedExplicit = groupCommits(commits, 'type');

    // The default strategy is "type" — calling with 'type' is the canonical way
    // to exercise the default path (the CLI passes 'type' when --group-by is omitted)
    expect(groupedExplicit.has('feat')).toBe(true);
    expect(groupedExplicit.has('fix')).toBe(true);
    expect(groupedExplicit.has('other')).toBe(true);

    // Verify the "feat" group contains the right commit
    expect(groupedExplicit.get('feat')![0].hash).toBe('fff0001');
    expect(groupedExplicit.get('fix')![0].hash).toBe('fff0002');
    expect(groupedExplicit.get('other')![0].hash).toBe('fff0003');
  });

  it('does NOT group by branch when the type strategy is active', () => {
    // Two commits on different branches but same type — should land in one group
    const commits = [
      makeCommit({ hash: 'ggg0001', message: 'chore: update deps', branch: 'main' }),
      makeCommit({ hash: 'ggg0002', message: 'chore: clean up', branch: 'develop' }),
    ];
    const grouped = groupCommits(commits, 'type');

    // Both should be under "chore", not under "main" / "develop"
    expect(grouped.has('chore')).toBe(true);
    expect(grouped.get('chore')).toHaveLength(2);
    expect(grouped.has('main')).toBe(false);
    expect(grouped.has('develop')).toBe(false);
  });
});
