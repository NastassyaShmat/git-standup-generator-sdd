import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatReport, buildReport } from '../../src/report-formatter.js';
import type { StandupEntry, StandupReport } from '../../src/types.js';

function makeEntry(overrides: Partial<StandupEntry> = {}): StandupEntry {
  return {
    type: 'feat',
    message: 'add user authentication endpoint',
    hash: 'abc1234',
    branch: 'feature/auth',
    timestamp: new Date('2026-04-20T14:30:00Z'),
    ...overrides,
  };
}

const FIXED_REPORT: StandupReport = {
  date: '2026-04-20',
  author: 'alice@example.com',
  period: { since: 'yesterday', until: 'now' },
  entries: {
    feat: [
      makeEntry({ message: 'add user authentication endpoint', branch: 'feature/auth' }),
    ],
    fix: [
      makeEntry({ type: 'fix', message: 'resolve database connection timeout', branch: 'main' }),
    ],
    other: [
      makeEntry({ type: 'other', message: 'update third-party library manually', branch: 'main' }),
    ],
  },
  summary: {
    total_commits: 3,
    branches: ['feature/auth', 'main'],
    types: { feat: 1, fix: 1, other: 1 },
  },
};

describe('formatReport() — text format', () => {
  it('starts with "Standup Report — YYYY-MM-DD"', () => {
    const output = formatReport(FIXED_REPORT, 'text');
    assert.ok(output.startsWith('Standup Report — 2026-04-20'));
  });

  it('contains "What I did:" block', () => {
    const output = formatReport(FIXED_REPORT, 'text');
    assert.ok(output.includes('What I did:'));
  });

  it('contains bullet entries with [type] prefix', () => {
    const output = formatReport(FIXED_REPORT, 'text');
    assert.ok(output.includes('• [feat] add user authentication endpoint'));
    assert.ok(output.includes('• [fix] resolve database connection timeout'));
    assert.ok(output.includes('• [other] update third-party library manually'));
  });

  it('ends with summary line containing commit count and branches', () => {
    const output = formatReport(FIXED_REPORT, 'text');
    const lines = output.split('\n');
    const lastLine = lines[lines.length - 1] ?? '';
    assert.ok(lastLine.includes('3 commits'));
    assert.ok(lastLine.includes('2 branches'));
  });
});

describe('formatReport() — markdown format', () => {
  it('starts with "## Standup Report — YYYY-MM-DD"', () => {
    const output = formatReport(FIXED_REPORT, 'markdown');
    assert.ok(output.startsWith('## Standup Report — 2026-04-20'));
  });

  it('contains ### What I did section', () => {
    const output = formatReport(FIXED_REPORT, 'markdown');
    assert.ok(output.includes('### What I did'));
  });

  it('uses **type:** bold prefix for entries', () => {
    const output = formatReport(FIXED_REPORT, 'markdown');
    assert.ok(output.includes('- **feat:** add user authentication endpoint'));
    assert.ok(output.includes('- **fix:** resolve database connection timeout'));
    assert.ok(output.includes('- **other:** update third-party library manually'));
  });

  it('summary appears as blockquote (> prefix)', () => {
    const output = formatReport(FIXED_REPORT, 'markdown');
    assert.ok(output.includes('> 3 commits'));
  });
});

describe('formatReport() — json format', () => {
  it('output is valid JSON', () => {
    const output = formatReport(FIXED_REPORT, 'json');
    assert.doesNotThrow(() => JSON.parse(output));
  });

  it('parsed JSON has expected top-level fields', () => {
    const output = formatReport(FIXED_REPORT, 'json');
    const parsed = JSON.parse(output) as StandupReport;

    assert.equal(parsed.date, '2026-04-20');
    assert.equal(parsed.author, 'alice@example.com');
    assert.deepEqual(parsed.period, { since: 'yesterday', until: 'now' });
    assert.ok(parsed.entries !== undefined);
    assert.ok(parsed.summary !== undefined);
  });

  it('summary total_commits is correct', () => {
    const output = formatReport(FIXED_REPORT, 'json');
    const parsed = JSON.parse(output) as StandupReport;
    assert.equal(parsed.summary.total_commits, 3);
  });
});

describe('buildReport()', () => {
  it('correctly aggregates summary from grouped entries', () => {
    const grouped = {
      feat: [makeEntry({ type: 'feat', branch: 'main' }), makeEntry({ type: 'feat', branch: 'dev' })],
      fix: [makeEntry({ type: 'fix', branch: 'main' })],
    };
    const report = buildReport('2026-04-20', 'alice@example.com', { since: 'yesterday', until: 'now' }, grouped);

    assert.equal(report.summary.total_commits, 3);
    assert.equal(report.summary.branches.length, 2);
    assert.equal(report.summary.types['feat'], 2);
    assert.equal(report.summary.types['fix'], 1);
  });
});
