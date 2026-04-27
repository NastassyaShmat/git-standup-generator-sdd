// Feature: git-standup-generator, Property 8: History store round-trip
// Validates: Requirements 5.4, 6.1, 6.2

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { saveReport, getReports } from '../src/historyStore';
import { StandupReport, StandupEntry } from '../src/types';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Arbitrary hex string for commit hash (7–40 hex characters).
 */
const arbitraryHash = fc.stringMatching(/^[0-9a-f]{7,40}$/);

/**
 * Arbitrary non-empty commit message.
 */
const arbitraryMessage = fc.string({ minLength: 1, maxLength: 120 });

/**
 * Arbitrary branch name (alphanumeric + hyphens/slashes).
 */
const arbitraryBranch = fc.stringMatching(/^[a-zA-Z0-9_/-]{1,40}$/);

/**
 * Arbitrary Date within a reasonable range (year 2000–2030).
 */
const arbitraryDate = fc
  .integer({ min: 946684800000, max: 1893456000000 })
  .map((ms) => new Date(ms));

/**
 * Arbitrary commit type — one of the recognized types or "other".
 */
const arbitraryType = fc.constantFrom(
  'feat', 'fix', 'docs', 'test', 'refactor', 'chore',
  'style', 'perf', 'ci', 'build', 'revert', 'other'
);

/**
 * Arbitrary StandupEntry object with fully random fields.
 */
const arbitraryStandupEntry: fc.Arbitrary<StandupEntry> = fc.record({
  type: arbitraryType,
  message: arbitraryMessage,
  hash: arbitraryHash,
  branch: arbitraryBranch,
  timestamp: arbitraryDate,
});

/**
 * Arbitrary non-empty author name.
 */
const arbitraryAuthor = fc.string({ minLength: 1, maxLength: 60 });

/**
 * Arbitrary date string (YYYY-MM-DD format).
 */
const arbitraryDateString = fc
  .integer({ min: 946684800000, max: 1893456000000 })
  .map((ms) => new Date(ms).toISOString().slice(0, 10));

/**
 * Arbitrary since/until strings (any non-empty string, like git date formats).
 */
const arbitraryPeriodString = fc.string({ minLength: 1, maxLength: 40 });

/**
 * Arbitrary StandupReport object with fully random fields.
 */
const arbitraryStandupReport: fc.Arbitrary<StandupReport> = fc
  .tuple(
    arbitraryDateString,
    arbitraryAuthor,
    arbitraryPeriodString,
    arbitraryPeriodString,
    fc.array(arbitraryStandupEntry, { minLength: 0, maxLength: 10 }),
  )
  .map(([date, author, since, until, entries]) => {
    // Compute summary from entries
    const totalCommits = entries.length;
    const branches = [...new Set(entries.map((e) => e.branch))].sort();
    const types: Record<string, number> = {};
    for (const entry of entries) {
      types[entry.type] = (types[entry.type] ?? 0) + 1;
    }
    return {
      date,
      author,
      period: { since, until },
      entries,
      summary: { totalCommits, branches, types },
    };
  });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a unique temp file path (does NOT create the file itself).
 * Uses mkdtempSync to get a temp directory, then appends a filename.
 */
function makeTempFilePath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'historyStore-test-'));
  return path.join(dir, 'history.json');
}

/**
 * Cleans up a temp file and its parent directory created by makeTempFilePath.
 */
function cleanupTempFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    const dir = path.dirname(filePath);
    if (fs.existsSync(dir)) {
      fs.rmdirSync(dir);
    }
  } catch {
    // Best-effort cleanup — ignore errors
  }
}

// ---------------------------------------------------------------------------
// Property 8: History store round-trip
// Validates: Requirements 5.4, 6.1, 6.2
// ---------------------------------------------------------------------------

describe('Property 8: History store round-trip', () => {
  /**
   * Sub-property 8a: A saved report can be retrieved and the retrieved list
   * is non-empty.
   * Validates: Requirements 5.4, 6.1
   */
  it('retrieved list is non-empty after saving a report', () => {
    fc.assert(
      fc.property(arbitraryStandupReport, (report) => {
        const tempFile = makeTempFilePath();
        try {
          saveReport(report, tempFile);
          const retrieved = getReports(tempFile);
          expect(retrieved.length).toBeGreaterThanOrEqual(1);
        } finally {
          cleanupTempFile(tempFile);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Sub-property 8b: The last retrieved entry has the same scalar fields
   * (date, author, period.since, period.until) as the saved report.
   * Validates: Requirements 6.1, 6.2
   */
  it('last retrieved entry has the same scalar fields as the saved report', () => {
    fc.assert(
      fc.property(arbitraryStandupReport, (report) => {
        const tempFile = makeTempFilePath();
        try {
          saveReport(report, tempFile);
          const retrieved = getReports(tempFile);
          const last = retrieved[retrieved.length - 1];

          expect(last.date).toBe(report.date);
          expect(last.author).toBe(report.author);
          expect(last.period.since).toBe(report.period.since);
          expect(last.period.until).toBe(report.period.until);
        } finally {
          cleanupTempFile(tempFile);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Sub-property 8c: The last retrieved entry has the same summary fields
   * (totalCommits, branches, types) as the saved report.
   * Validates: Requirements 6.1, 6.2
   */
  it('last retrieved entry has the same summary fields as the saved report', () => {
    fc.assert(
      fc.property(arbitraryStandupReport, (report) => {
        const tempFile = makeTempFilePath();
        try {
          saveReport(report, tempFile);
          const retrieved = getReports(tempFile);
          const last = retrieved[retrieved.length - 1];

          expect(last.summary.totalCommits).toBe(report.summary.totalCommits);
          expect(last.summary.branches).toEqual(report.summary.branches);
          expect(last.summary.types).toEqual(report.summary.types);
        } finally {
          cleanupTempFile(tempFile);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Sub-property 8d: The last retrieved entry has the same number of entries
   * as the saved report.
   * Validates: Requirements 6.1, 6.2
   */
  it('last retrieved entry has the same entries length as the saved report', () => {
    fc.assert(
      fc.property(arbitraryStandupReport, (report) => {
        const tempFile = makeTempFilePath();
        try {
          saveReport(report, tempFile);
          const retrieved = getReports(tempFile);
          const last = retrieved[retrieved.length - 1];

          expect(last.entries).toHaveLength(report.entries.length);
        } finally {
          cleanupTempFile(tempFile);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Sub-property 8e: Each entry in the retrieved report has the same scalar
   * fields (type, message, hash, branch) as the original. The timestamp field
   * becomes an ISO string after JSON round-trip, so it is compared as a string.
   * Validates: Requirements 6.1, 6.2
   */
  it('each retrieved entry has the same scalar fields and timestamp as ISO string', () => {
    fc.assert(
      fc.property(arbitraryStandupReport, (report) => {
        // Only test reports with at least one entry for per-entry checks
        fc.pre(report.entries.length > 0);

        const tempFile = makeTempFilePath();
        try {
          saveReport(report, tempFile);
          const retrieved = getReports(tempFile);
          const last = retrieved[retrieved.length - 1];

          for (let i = 0; i < report.entries.length; i++) {
            const original = report.entries[i];
            const roundTripped = last.entries[i];

            expect(roundTripped.type).toBe(original.type);
            expect(roundTripped.message).toBe(original.message);
            expect(roundTripped.hash).toBe(original.hash);
            expect(roundTripped.branch).toBe(original.branch);
            // Date objects become ISO strings after JSON round-trip
            expect(roundTripped.timestamp).toBe(original.timestamp.toISOString());
          }
        } finally {
          cleanupTempFile(tempFile);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Combined property: all round-trip invariants hold simultaneously.
   * Saves a report, retrieves it, and verifies deep structural equivalence
   * (accounting for Date → ISO string serialization).
   * Validates: Requirements 5.4, 6.1, 6.2
   */
  it('all round-trip invariants hold simultaneously', () => {
    fc.assert(
      fc.property(arbitraryStandupReport, (report) => {
        const tempFile = makeTempFilePath();
        try {
          saveReport(report, tempFile);
          const retrieved = getReports(tempFile);

          // At least one entry must be present
          expect(retrieved.length).toBeGreaterThanOrEqual(1);

          const last = retrieved[retrieved.length - 1];

          // Scalar fields
          expect(last.date).toBe(report.date);
          expect(last.author).toBe(report.author);
          expect(last.period.since).toBe(report.period.since);
          expect(last.period.until).toBe(report.period.until);

          // Summary fields
          expect(last.summary.totalCommits).toBe(report.summary.totalCommits);
          expect(last.summary.branches).toEqual(report.summary.branches);
          expect(last.summary.types).toEqual(report.summary.types);

          // Entries length
          expect(last.entries).toHaveLength(report.entries.length);

          // Per-entry fields
          for (let i = 0; i < report.entries.length; i++) {
            const original = report.entries[i];
            const rt = last.entries[i];

            expect(rt.type).toBe(original.type);
            expect(rt.message).toBe(original.message);
            expect(rt.hash).toBe(original.hash);
            expect(rt.branch).toBe(original.branch);
            // timestamp: Date → ISO string after JSON round-trip
            expect(rt.timestamp).toBe(original.timestamp.toISOString());
          }
        } finally {
          cleanupTempFile(tempFile);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Unit Tests: History_Store (Task 11.3)
// Validates: Requirements 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3
// ---------------------------------------------------------------------------

describe('Unit tests: History_Store', () => {
  const makeReport = (overrides: Partial<StandupReport> = {}): StandupReport => ({
    date: '2024-01-15',
    author: 'Alice',
    period: { since: '2024-01-14', until: '2024-01-15' },
    entries: [],
    summary: { totalCommits: 0, branches: [], types: {} },
    ...overrides,
  });

  // -------------------------------------------------------------------------
  // File creation
  // -------------------------------------------------------------------------

  describe('file creation', () => {
    it('creates the history file when it does not yet exist', () => {
      const tempFile = makeTempFilePath();
      try {
        expect(fs.existsSync(tempFile)).toBe(false);
        saveReport(makeReport(), tempFile);
        expect(fs.existsSync(tempFile)).toBe(true);
      } finally {
        cleanupTempFile(tempFile);
      }
    });

    it('returns an empty array when the history file does not exist', () => {
      const tempFile = makeTempFilePath();
      // Do NOT create the file
      const reports = getReports(tempFile);
      expect(reports).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Append behaviour (--save)
  // -------------------------------------------------------------------------

  describe('append behaviour', () => {
    it('appends multiple reports without overwriting previous entries', () => {
      const tempFile = makeTempFilePath();
      try {
        const report1 = makeReport({ date: '2024-01-14', author: 'Alice' });
        const report2 = makeReport({ date: '2024-01-15', author: 'Bob' });

        saveReport(report1, tempFile);
        saveReport(report2, tempFile);

        const retrieved = getReports(tempFile);
        expect(retrieved).toHaveLength(2);
        expect(retrieved[0].date).toBe('2024-01-14');
        expect(retrieved[0].author).toBe('Alice');
        expect(retrieved[1].date).toBe('2024-01-15');
        expect(retrieved[1].author).toBe('Bob');
      } finally {
        cleanupTempFile(tempFile);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Custom history file path
  // -------------------------------------------------------------------------

  describe('custom history file path', () => {
    it('uses the specified path instead of the default', () => {
      const tempFile = makeTempFilePath();
      try {
        const report = makeReport({ author: 'CustomPathUser' });
        saveReport(report, tempFile);

        const retrieved = getReports(tempFile);
        expect(retrieved).toHaveLength(1);
        expect(retrieved[0].author).toBe('CustomPathUser');
      } finally {
        cleanupTempFile(tempFile);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Malformed JSON error handling
  // -------------------------------------------------------------------------

  describe('malformed JSON error handling', () => {
    it('throws a descriptive error identifying the line number and raw content', () => {
      const tempFile = makeTempFilePath();
      try {
        // Write a valid line followed by a malformed line
        fs.writeFileSync(tempFile, '{"date":"2024-01-15","author":"Alice","period":{"since":"2024-01-14","until":"2024-01-15"},"entries":[],"summary":{"totalCommits":0,"branches":[],"types":{}}}\nNOT_VALID_JSON\n', 'utf8');

        expect(() => getReports(tempFile)).toThrow(/line 2/i);
        expect(() => getReports(tempFile)).toThrow(/NOT_VALID_JSON/);
      } finally {
        cleanupTempFile(tempFile);
      }
    });

    it('error message includes the line number of the malformed entry', () => {
      const tempFile = makeTempFilePath();
      try {
        fs.writeFileSync(tempFile, '{invalid json on line 1}\n', 'utf8');

        expect(() => getReports(tempFile)).toThrow(/line 1/i);
      } finally {
        cleanupTempFile(tempFile);
      }
    });
  });
});
