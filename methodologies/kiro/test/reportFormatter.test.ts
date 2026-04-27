// Feature: git-standup-generator, Property 6: Text and Markdown format structure
// Validates: Requirements 4.1, 4.2, 4.6

import * as fc from 'fast-check';
import { formatReport } from '../src/reportFormatter';
import { StandupEntry, FormatOptions } from '../src/types';

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
 * Arbitrary non-empty array of StandupEntry objects (1–10 entries).
 * Used for the non-empty case where summary lines are expected.
 */
const arbitraryNonEmptyEntries = fc.array(arbitraryStandupEntry, {
  minLength: 1,
  maxLength: 10,
});

/**
 * Arbitrary array of StandupEntry objects (0–10 entries).
 * Used for the general structural checks.
 */
const arbitraryEntries = fc.array(arbitraryStandupEntry, {
  minLength: 0,
  maxLength: 10,
});

/**
 * Arbitrary author name (non-empty string).
 */
const arbitraryAuthor = fc.string({ minLength: 1, maxLength: 60 });

/**
 * Arbitrary since/until strings (any non-empty string, like git date formats).
 */
const arbitraryDateString = fc.string({ minLength: 1, maxLength: 40 });

/**
 * Build a Map<string, StandupEntry[]> from a flat array of entries.
 * Groups entries by their type field to produce a realistic groups map.
 */
function buildGroupsMap(entries: StandupEntry[]): Map<string, StandupEntry[]> {
  const groups = new Map<string, StandupEntry[]>();
  for (const entry of entries) {
    const existing = groups.get(entry.type);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(entry.type, [entry]);
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Property 6: Text and Markdown format structure
// ---------------------------------------------------------------------------

describe('Property 6: Text and Markdown format structure', () => {
  /**
   * Sub-property 6a: Text format always contains a YYYY-MM-DD date string.
   * Validates: Requirement 4.6
   */
  it('text format output always contains a YYYY-MM-DD date string', () => {
    fc.assert(
      fc.property(
        arbitraryEntries,
        arbitraryAuthor,
        arbitraryDateString,
        arbitraryDateString,
        (entries, author, since, until) => {
          const groups = buildGroupsMap(entries);
          const options: FormatOptions = { format: 'text', author, since, until };
          const { text } = formatReport(groups, options);

          // Requirement 4.6: date must be formatted as YYYY-MM-DD
          expect(text).toMatch(/\d{4}-\d{2}-\d{2}/);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Sub-property 6b: Text format always contains a "What I did" section.
   * Validates: Requirement 4.1
   */
  it('text format output always contains a "What I did" section', () => {
    fc.assert(
      fc.property(
        arbitraryNonEmptyEntries,
        arbitraryAuthor,
        arbitraryDateString,
        arbitraryDateString,
        (entries, author, since, until) => {
          const groups = buildGroupsMap(entries);
          const options: FormatOptions = { format: 'text', author, since, until };
          const { text } = formatReport(groups, options);

          // Requirement 4.1: text format must contain "What I did" section
          expect(text).toContain('What I did');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Sub-property 6c: Text format with non-empty entries contains a summary line
   * with "Summary:" and "commits across branches:".
   * Validates: Requirement 4.1
   */
  it('text format with non-empty entries contains a summary line', () => {
    fc.assert(
      fc.property(
        arbitraryNonEmptyEntries,
        arbitraryAuthor,
        arbitraryDateString,
        arbitraryDateString,
        (entries, author, since, until) => {
          const groups = buildGroupsMap(entries);
          const options: FormatOptions = { format: 'text', author, since, until };
          const { text } = formatReport(groups, options);

          // Requirement 4.1: summary line with commit count and branch names
          expect(text).toContain('Summary:');
          expect(text).toContain('commits across branches:');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Sub-property 6d: Markdown format always contains a level-2 heading with
   * the date in YYYY-MM-DD format.
   * Validates: Requirements 4.2, 4.6
   */
  it('markdown format output always contains a level-2 heading with a YYYY-MM-DD date', () => {
    fc.assert(
      fc.property(
        arbitraryEntries,
        arbitraryAuthor,
        arbitraryDateString,
        arbitraryDateString,
        (entries, author, since, until) => {
          const groups = buildGroupsMap(entries);
          const options: FormatOptions = { format: 'markdown', author, since, until };
          const { text } = formatReport(groups, options);

          // Requirement 4.2: level-2 heading with date; Requirement 4.6: YYYY-MM-DD format
          expect(text).toMatch(/^## Standup Report — \d{4}-\d{2}-\d{2}/m);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Sub-property 6e: Markdown format with non-empty entries contains a
   * level-3 "What I did" heading.
   * Validates: Requirement 4.2
   */
  it('markdown format with non-empty entries contains a level-3 "What I did" heading', () => {
    fc.assert(
      fc.property(
        arbitraryNonEmptyEntries,
        arbitraryAuthor,
        arbitraryDateString,
        arbitraryDateString,
        (entries, author, since, until) => {
          const groups = buildGroupsMap(entries);
          const options: FormatOptions = { format: 'markdown', author, since, until };
          const { text } = formatReport(groups, options);

          // Requirement 4.2: level-3 "What I did" heading
          expect(text).toContain('### What I did');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Sub-property 6f: Markdown format with non-empty entries contains a
   * blockquote summary line (starts with "> ").
   * Validates: Requirement 4.2
   */
  it('markdown format with non-empty entries contains a blockquote summary line', () => {
    fc.assert(
      fc.property(
        arbitraryNonEmptyEntries,
        arbitraryAuthor,
        arbitraryDateString,
        arbitraryDateString,
        (entries, author, since, until) => {
          const groups = buildGroupsMap(entries);
          const options: FormatOptions = { format: 'markdown', author, since, until };
          const { text } = formatReport(groups, options);

          // Requirement 4.2: blockquote summary line
          expect(text).toContain('> ');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Combined property: all structural invariants hold simultaneously for
   * both text and markdown formats with non-empty entries.
   * Validates: Requirements 4.1, 4.2, 4.6
   */
  it('all structural invariants hold simultaneously for text and markdown with non-empty entries', () => {
    fc.assert(
      fc.property(
        arbitraryNonEmptyEntries,
        arbitraryAuthor,
        arbitraryDateString,
        arbitraryDateString,
        (entries, author, since, until) => {
          const groups = buildGroupsMap(entries);

          // --- Text format ---
          const textOptions: FormatOptions = { format: 'text', author, since, until };
          const { text: textOutput } = formatReport(groups, textOptions);

          // Req 4.6: YYYY-MM-DD date present
          expect(textOutput).toMatch(/\d{4}-\d{2}-\d{2}/);
          // Req 4.1: "What I did" section
          expect(textOutput).toContain('What I did');
          // Req 4.1: summary line
          expect(textOutput).toContain('Summary:');
          expect(textOutput).toContain('commits across branches:');

          // --- Markdown format ---
          const mdOptions: FormatOptions = { format: 'markdown', author, since, until };
          const { text: mdOutput } = formatReport(groups, mdOptions);

          // Req 4.2 + 4.6: level-2 heading with YYYY-MM-DD date
          expect(mdOutput).toMatch(/^## Standup Report — \d{4}-\d{2}-\d{2}/m);
          // Req 4.2: level-3 "What I did" heading
          expect(mdOutput).toContain('### What I did');
          // Req 4.2: blockquote summary line
          expect(mdOutput).toContain('> ');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: git-standup-generator, Property 7: JSON serialization round-trip
// Validates: Requirements 4.3, 4.4
// ---------------------------------------------------------------------------

describe('Property 7: JSON serialization round-trip', () => {
  /**
   * Sub-property 7a: JSON output parses back to an object with the same
   * top-level scalar fields: date, author, period.since, period.until.
   * Validates: Requirements 4.3, 4.4
   */
  it('JSON output round-trips scalar fields: date, author, period.since, period.until', () => {
    fc.assert(
      fc.property(
        arbitraryEntries,
        arbitraryAuthor,
        arbitraryDateString,
        arbitraryDateString,
        (entries, author, since, until) => {
          const groups = buildGroupsMap(entries);
          const options: FormatOptions = { format: 'json', author, since, until };
          const { text, report } = formatReport(groups, options);

          const parsed = JSON.parse(text);

          // Requirement 4.3: valid JSON conforming to StandupReport interface
          expect(parsed.date).toBe(report.date);
          expect(parsed.author).toBe(report.author);
          expect(parsed.period.since).toBe(report.period.since);
          expect(parsed.period.until).toBe(report.period.until);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Sub-property 7b: JSON output round-trips summary fields:
   * totalCommits, branches, and types.
   * Validates: Requirement 4.4
   */
  it('JSON output round-trips summary fields: totalCommits, branches, types', () => {
    fc.assert(
      fc.property(
        arbitraryEntries,
        arbitraryAuthor,
        arbitraryDateString,
        arbitraryDateString,
        (entries, author, since, until) => {
          const groups = buildGroupsMap(entries);
          const options: FormatOptions = { format: 'json', author, since, until };
          const { text, report } = formatReport(groups, options);

          const parsed = JSON.parse(text);

          // Requirement 4.4: totalCommits, branches, types are preserved
          expect(parsed.summary.totalCommits).toBe(report.summary.totalCommits);
          expect(parsed.summary.branches).toEqual(report.summary.branches);
          expect(parsed.summary.types).toEqual(report.summary.types);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Sub-property 7c: JSON output round-trips entries length.
   * Validates: Requirement 4.3
   */
  it('JSON output round-trips entries array length', () => {
    fc.assert(
      fc.property(
        arbitraryEntries,
        arbitraryAuthor,
        arbitraryDateString,
        arbitraryDateString,
        (entries, author, since, until) => {
          const groups = buildGroupsMap(entries);
          const options: FormatOptions = { format: 'json', author, since, until };
          const { text, report } = formatReport(groups, options);

          const parsed = JSON.parse(text);

          // entries length must be preserved
          expect(parsed.entries).toHaveLength(report.entries.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Sub-property 7d: JSON output round-trips each entry's scalar fields
   * (type, message, hash, branch). The timestamp field becomes an ISO string
   * after JSON serialization, so it is compared as a string.
   * Validates: Requirements 4.3, 4.4
   */
  it('JSON output round-trips each entry scalar fields and timestamp as ISO string', () => {
    fc.assert(
      fc.property(
        arbitraryNonEmptyEntries,
        arbitraryAuthor,
        arbitraryDateString,
        arbitraryDateString,
        (entries, author, since, until) => {
          const groups = buildGroupsMap(entries);
          const options: FormatOptions = { format: 'json', author, since, until };
          const { text, report } = formatReport(groups, options);

          const parsed = JSON.parse(text);

          for (let i = 0; i < report.entries.length; i++) {
            const original = report.entries[i];
            const roundTripped = parsed.entries[i];

            expect(roundTripped.type).toBe(original.type);
            expect(roundTripped.message).toBe(original.message);
            expect(roundTripped.hash).toBe(original.hash);
            expect(roundTripped.branch).toBe(original.branch);

            // Date objects become ISO strings in JSON — compare as strings
            expect(roundTripped.timestamp).toBe(original.timestamp.toISOString());
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Combined property: all JSON round-trip invariants hold simultaneously.
   * Validates: Requirements 4.3, 4.4
   */
  it('all JSON round-trip invariants hold simultaneously', () => {
    fc.assert(
      fc.property(
        arbitraryNonEmptyEntries,
        arbitraryAuthor,
        arbitraryDateString,
        arbitraryDateString,
        (entries, author, since, until) => {
          const groups = buildGroupsMap(entries);
          const options: FormatOptions = { format: 'json', author, since, until };
          const { text, report } = formatReport(groups, options);

          // Must be valid JSON
          const parsed = JSON.parse(text);

          // Scalar fields
          expect(parsed.date).toBe(report.date);
          expect(parsed.author).toBe(report.author);
          expect(parsed.period.since).toBe(report.period.since);
          expect(parsed.period.until).toBe(report.period.until);

          // Summary fields (Requirement 4.4)
          expect(parsed.summary.totalCommits).toBe(report.summary.totalCommits);
          expect(parsed.summary.branches).toEqual(report.summary.branches);
          expect(parsed.summary.types).toEqual(report.summary.types);

          // Entries length
          expect(parsed.entries).toHaveLength(report.entries.length);

          // Per-entry fields
          for (let i = 0; i < report.entries.length; i++) {
            const original = report.entries[i];
            const rt = parsed.entries[i];

            expect(rt.type).toBe(original.type);
            expect(rt.message).toBe(original.message);
            expect(rt.hash).toBe(original.hash);
            expect(rt.branch).toBe(original.branch);
            // timestamp: Date → ISO string after JSON round-trip
            expect(rt.timestamp).toBe(original.timestamp.toISOString());
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Unit Tests: Report_Formatter (Task 8.4)
// Validates: Requirements 2.7, 4.1, 4.2, 4.3, 4.6
// ---------------------------------------------------------------------------

describe('Unit tests: Report_Formatter', () => {
  const baseOptions = (format: 'text' | 'markdown' | 'json'): FormatOptions => ({
    format,
    author: 'Alice',
    since: '2024-01-01',
    until: '2024-01-02',
  });

  // -------------------------------------------------------------------------
  // No-commits case
  // -------------------------------------------------------------------------

  describe('no-commits case', () => {
    it('text output contains the "no commits found" message', () => {
      const { text } = formatReport(new Map(), baseOptions('text'));
      expect(text).toContain('No commits found for the given period and author.');
    });

    it('report.entries is an empty array', () => {
      const { report } = formatReport(new Map(), baseOptions('text'));
      expect(report.entries).toHaveLength(0);
    });

    it('report.summary.totalCommits is 0', () => {
      const { report } = formatReport(new Map(), baseOptions('text'));
      expect(report.summary.totalCommits).toBe(0);
    });

    it('report is a valid StandupReport object with all required fields', () => {
      const { report } = formatReport(new Map(), baseOptions('text'));
      expect(typeof report.date).toBe('string');
      expect(typeof report.author).toBe('string');
      expect(report.period).toHaveProperty('since');
      expect(report.period).toHaveProperty('until');
      expect(Array.isArray(report.entries)).toBe(true);
      expect(typeof report.summary.totalCommits).toBe('number');
      expect(Array.isArray(report.summary.branches)).toBe(true);
      expect(typeof report.summary.types).toBe('object');
    });
  });

  // -------------------------------------------------------------------------
  // Date formatted as YYYY-MM-DD in all three output formats
  // -------------------------------------------------------------------------

  describe('date format YYYY-MM-DD', () => {
    const datePattern = /\d{4}-\d{2}-\d{2}/;

    it('text format includes a YYYY-MM-DD date', () => {
      const { text } = formatReport(new Map(), baseOptions('text'));
      expect(text).toMatch(datePattern);
    });

    it('markdown format includes a YYYY-MM-DD date', () => {
      const { text } = formatReport(new Map(), baseOptions('markdown'));
      expect(text).toMatch(datePattern);
    });

    it('json format includes a YYYY-MM-DD date', () => {
      const { text } = formatReport(new Map(), baseOptions('json'));
      const parsed = JSON.parse(text);
      expect(parsed.date).toMatch(datePattern);
    });
  });

  // -------------------------------------------------------------------------
  // summary.branches is deduplicated and sorted
  // -------------------------------------------------------------------------

  describe('summary.branches deduplication and sorting', () => {
    /**
     * Build a groups map with entries that have duplicate branch names.
     * Branches used: "main", "feature/auth", "main" → expect ["feature/auth", "main"]
     */
    function buildGroupsWithDuplicateBranches(): Map<string, StandupEntry[]> {
      const makeEntry = (branch: string, idx: number): StandupEntry => ({
        type: 'feat',
        message: `commit ${idx}`,
        hash: `abc123${idx}`,
        branch,
        timestamp: new Date('2024-01-01T10:00:00Z'),
      });

      const entries: StandupEntry[] = [
        makeEntry('main', 1),
        makeEntry('feature/auth', 2),
        makeEntry('main', 3),
      ];

      const groups = new Map<string, StandupEntry[]>();
      groups.set('feat', entries);
      return groups;
    }

    it('summary.branches contains no duplicates', () => {
      const { report } = formatReport(buildGroupsWithDuplicateBranches(), baseOptions('text'));
      const unique = new Set(report.summary.branches);
      expect(unique.size).toBe(report.summary.branches.length);
    });

    it('summary.branches is sorted alphabetically', () => {
      const { report } = formatReport(buildGroupsWithDuplicateBranches(), baseOptions('text'));
      const sorted = [...report.summary.branches].sort();
      expect(report.summary.branches).toEqual(sorted);
    });

    it('summary.branches equals ["feature/auth", "main"] for the given input', () => {
      const { report } = formatReport(buildGroupsWithDuplicateBranches(), baseOptions('text'));
      expect(report.summary.branches).toEqual(['feature/auth', 'main']);
    });
  });
});
