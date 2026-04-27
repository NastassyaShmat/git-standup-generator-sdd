// Feature: git-standup-generator, Property 1: GitCommit parsing completeness
// Validates: Requirements 1.9, 1.10

import * as fc from 'fast-check';
import { parseGitLogRecord } from '../src/gitReader';

const FIELD_SEP = '\x1F';
const RECORD_SEP = '\x1E';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Hex string of exactly 40 characters (simulates a git SHA-1 hash). */
const hexHash = fc.hexaString({ minLength: 40, maxLength: 40 });

/**
 * Arbitrary commit message: printable ASCII excluding the field/record
 * separator characters so the raw record stays parseable.
 * No leading/trailing whitespace — the parser trims fields, so we match that.
 */
const commitMessage = fc
  .string({ minLength: 1, maxLength: 120 })
  .filter(
    (s) =>
      !s.includes(FIELD_SEP) &&
      !s.includes(RECORD_SEP) &&
      s === s.trim() &&
      s.trim().length > 0
  );

/** Author name: non-empty string without separator characters, no leading/trailing whitespace. */
const authorName = fc
  .string({ minLength: 1, maxLength: 60 })
  .filter(
    (s) =>
      !s.includes(FIELD_SEP) &&
      !s.includes(RECORD_SEP) &&
      s === s.trim() &&
      s.trim().length > 0
  );

/** Email address: simple pattern without separator characters. */
const emailAddress = fc
  .tuple(
    fc.stringMatching(/^[a-z]{1,10}$/),
    fc.stringMatching(/^[a-z]{1,10}$/),
    fc.stringMatching(/^[a-z]{2,4}$/)
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

/** ISO 8601 date string (UTC). */
const isoDate = fc
  .date({ min: new Date('2000-01-01T00:00:00Z'), max: new Date('2030-12-31T23:59:59Z') })
  .map((d) => d.toISOString());

/** Branch name: alphanumeric with slashes and hyphens. */
const branchName = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9/_-]{0,39}$/);

/**
 * Decorations field that encodes a branch name in "HEAD -> branchname" format
 * so that extractBranch() can reliably extract it.
 */
const decorationsWithBranch = (branch: string): string => `HEAD -> ${branch}`;

/** 0, 1, or 2+ parent hashes (space-separated). */
const parentHashes = fc.oneof(
  // 0 parents (initial commit)
  fc.constant(''),
  // 1 parent (regular commit)
  hexHash,
  // 2 parents (merge commit)
  fc.tuple(hexHash, hexHash).map(([a, b]) => `${a} ${b}`),
  // 3 parents (octopus merge)
  fc.tuple(hexHash, hexHash, hexHash).map(([a, b, c]) => `${a} ${b} ${c}`)
);

// ---------------------------------------------------------------------------
// Helper: build a raw git log record string
// ---------------------------------------------------------------------------

function buildRawRecord(
  hash: string,
  message: string,
  author: string,
  email: string,
  date: string,
  decorations: string,
  parents: string
): string {
  return [hash, message, author, email, date, decorations, parents].join(FIELD_SEP) + RECORD_SEP;
}

// ---------------------------------------------------------------------------
// Property 1: GitCommit parsing completeness
// ---------------------------------------------------------------------------

describe('Property 1: GitCommit parsing completeness', () => {
  it('parses every field correctly from a well-formed raw record', () => {
    fc.assert(
      fc.property(
        hexHash,
        commitMessage,
        authorName,
        emailAddress,
        isoDate,
        branchName,
        parentHashes,
        (hash, message, author, email, date, branch, parents) => {
          const decorations = decorationsWithBranch(branch);
          const raw = buildRawRecord(hash, message, author, email, date, decorations, parents);

          const commit = parseGitLogRecord(raw);

          // Must not return null for a valid record
          expect(commit).not.toBeNull();
          if (commit === null) return; // type narrowing

          // Requirement 1.10: hash, message, author, email, date, branch all parsed
          expect(commit.hash).toBe(hash);
          expect(commit.message).toBe(message);
          expect(commit.author).toBe(author);
          expect(commit.email).toBe(email);

          // Date field is a Date object — compare via ISO string
          expect(commit.date.toISOString()).toBe(new Date(date).toISOString());

          // Branch extracted from "HEAD -> branchname" decoration
          expect(commit.branch).toBe(branch);

          // Requirement 1.9: isMerge is true iff two or more parent hashes
          const parentCount = parents.trim() === '' ? 0 : parents.trim().split(/\s+/).length;
          expect(commit.isMerge).toBe(parentCount >= 2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sets isMerge = false for 0 parents (initial commit)', () => {
    fc.assert(
      fc.property(hexHash, commitMessage, authorName, emailAddress, isoDate, branchName, (hash, message, author, email, date, branch) => {
        const raw = buildRawRecord(hash, message, author, email, date, decorationsWithBranch(branch), '');
        const commit = parseGitLogRecord(raw);
        expect(commit).not.toBeNull();
        expect(commit!.isMerge).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('sets isMerge = false for exactly 1 parent (regular commit)', () => {
    fc.assert(
      fc.property(hexHash, commitMessage, authorName, emailAddress, isoDate, branchName, hexHash, (hash, message, author, email, date, branch, parent) => {
        const raw = buildRawRecord(hash, message, author, email, date, decorationsWithBranch(branch), parent);
        const commit = parseGitLogRecord(raw);
        expect(commit).not.toBeNull();
        expect(commit!.isMerge).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('sets isMerge = true for exactly 2 parents (merge commit)', () => {
    fc.assert(
      fc.property(
        hexHash, commitMessage, authorName, emailAddress, isoDate, branchName,
        hexHash, hexHash,
        (hash, message, author, email, date, branch, p1, p2) => {
          const parents = `${p1} ${p2}`;
          const raw = buildRawRecord(hash, message, author, email, date, decorationsWithBranch(branch), parents);
          const commit = parseGitLogRecord(raw);
          expect(commit).not.toBeNull();
          expect(commit!.isMerge).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sets isMerge = true for 3+ parents (octopus merge)', () => {
    fc.assert(
      fc.property(
        hexHash, commitMessage, authorName, emailAddress, isoDate, branchName,
        hexHash, hexHash, hexHash,
        (hash, message, author, email, date, branch, p1, p2, p3) => {
          const parents = `${p1} ${p2} ${p3}`;
          const raw = buildRawRecord(hash, message, author, email, date, decorationsWithBranch(branch), parents);
          const commit = parseGitLogRecord(raw);
          expect(commit).not.toBeNull();
          expect(commit!.isMerge).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('falls back to "unknown" branch when decorations field is empty', () => {
    fc.assert(
      fc.property(hexHash, commitMessage, authorName, emailAddress, isoDate, parentHashes, (hash, message, author, email, date, parents) => {
        const raw = buildRawRecord(hash, message, author, email, date, '', parents);
        const commit = parseGitLogRecord(raw);
        expect(commit).not.toBeNull();
        expect(commit!.branch).toBe('unknown');
      }),
      { numRuns: 100 }
    );
  });

  it('returns null for an empty record string', () => {
    expect(parseGitLogRecord('')).toBeNull();
    expect(parseGitLogRecord('   ')).toBeNull();
    expect(parseGitLogRecord('\n')).toBeNull();
  });

  it('returns null for a record with fewer than 7 fields', () => {
    // Only 3 fields — should return null
    const incomplete = ['hash', 'message', 'author'].join(FIELD_SEP) + RECORD_SEP;
    expect(parseGitLogRecord(incomplete)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Task 4.3: Unit tests for Git_Reader error handling
// Validates: Requirements 1.8, 8.4
// ---------------------------------------------------------------------------

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

describe('Git_Reader error handling', () => {
  describe('Requirement 1.8: not a git repository', () => {
    it('throws an error containing "is not a valid git repository" when the path is not a git repo', () => {
      // Import readCommits here so the real child_process is used (no mock active)
      const { readCommits } = require('../src/gitReader');

      // Create a fresh temp directory that is definitely not a git repository
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'not-a-git-repo-'));
      try {
        expect(() =>
          readCommits({ repo: tmpDir, since: 'yesterday', until: 'now', author: '' })
        ).toThrow(/is not a valid git repository/);
      } finally {
        fs.rmdirSync(tmpDir);
      }
    });
  });

  describe("Requirement 8.4: git binary not found on PATH", () => {
    beforeEach(() => {
      jest.resetModules();
      // Mock child_process so execSync throws an ENOENT error
      jest.mock('child_process', () => {
        const enoentError = Object.assign(new Error('spawnSync git ENOENT'), {
          code: 'ENOENT',
        });
        return {
          execSync: () => {
            throw enoentError;
          },
        };
      });
    });

    afterEach(() => {
      jest.resetModules();
      jest.unmock('child_process');
    });

    it("throws an error containing \"'git' executable not found\" and mentions PATH when git is not on PATH", () => {
      // Re-require gitReader after the mock is in place so it picks up the mocked execSync
      const { readCommits } = require('../src/gitReader');

      expect(() =>
        readCommits({ repo: process.cwd(), since: 'yesterday', until: 'now', author: 'test' })
      ).toThrow(/'git' executable not found/);
    });

    it('error message mentions PATH when git binary is not found', () => {
      const { readCommits } = require('../src/gitReader');

      expect(() =>
        readCommits({ repo: process.cwd(), since: 'yesterday', until: 'now', author: 'test' })
      ).toThrow(/PATH/);
    });
  });
});
