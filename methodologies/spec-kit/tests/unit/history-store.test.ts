import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { appendToHistory } from '../../src/history-store.js';
import type { StandupReport } from '../../src/types.js';

// ---------------------------------------------------------------------------
// T027 — history-store unit tests
// ---------------------------------------------------------------------------

function makeReport(overrides: Partial<StandupReport> = {}): StandupReport {
  return {
    date: '2026-04-20',
    author: 'test@example.com',
    period: 'yesterday → now',
    entries: {
      feat: [
        {
          hash: 'a1b2c3d',
          message: 'add feature',
          type: 'feat',
          branch: 'main',
          timestamp: '2026-04-20T10:00:00+00:00',
        },
      ],
    },
    summary: {
      commitCount: 1,
      branchesTouched: ['main'],
      typeDistribution: { feat: 1 },
    },
    ...overrides,
  };
}

describe('appendToHistory()', () => {
  let tempDir = '';

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'git-standup-history-'));
  });

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it('history file does not exist → directory + file created; file contains [<report>]', async () => {
    const historyPath = join(tempDir, 'nested', 'subdir', 'history.json');
    const report = makeReport();

    await appendToHistory(report, historyPath);

    assert.ok(existsSync(historyPath), 'history file should be created');
    const content = JSON.parse(readFileSync(historyPath, 'utf8')) as unknown[];
    assert.equal(content.length, 1, 'file should contain exactly one entry');
  });

  it('history file exists with valid array → new report appended; prior entries preserved', async () => {
    const historyPath = join(tempDir, 'history.json');
    const existing = [{ ...makeReport(), savedAt: '2026-04-19T10:00:00.000Z' }];
    writeFileSync(historyPath, JSON.stringify(existing), 'utf8');

    const newReport = makeReport({ date: '2026-04-20' });
    await appendToHistory(newReport, historyPath);

    const content = JSON.parse(readFileSync(historyPath, 'utf8')) as unknown[];
    assert.equal(content.length, 2, 'file should contain two entries');
    const first = content[0] as Record<string, unknown>;
    assert.equal(first['savedAt'], '2026-04-19T10:00:00.000Z', 'prior entry should be preserved');
  });

  it('written entry contains all StandupReport fields plus savedAt as ISO 8601 string', async () => {
    const historyPath = join(tempDir, 'history.json');
    const report = makeReport();

    await appendToHistory(report, historyPath);

    const content = JSON.parse(readFileSync(historyPath, 'utf8')) as Array<Record<string, unknown>>;
    const entry = content[0];
    assert.ok(entry !== undefined, 'entry must exist');

    // StandupReport fields
    assert.ok('date' in entry, 'entry must have date');
    assert.ok('author' in entry, 'entry must have author');
    assert.ok('period' in entry, 'entry must have period');
    assert.ok('entries' in entry, 'entry must have entries');
    assert.ok('summary' in entry, 'entry must have summary');

    // savedAt as ISO 8601
    assert.ok('savedAt' in entry, 'entry must have savedAt');
    const savedAt = entry['savedAt'] as string;
    assert.match(savedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'savedAt must be ISO 8601');
  });

  it('history file exists with invalid JSON → file renamed to .bak; new history written; save proceeds', async () => {
    const historyPath = join(tempDir, 'history.json');
    writeFileSync(historyPath, '{this is: not valid json!!!}', 'utf8');

    const report = makeReport();
    await appendToHistory(report, historyPath);

    // New history file should exist with the report
    assert.ok(existsSync(historyPath), 'new history file should exist');
    const content = JSON.parse(readFileSync(historyPath, 'utf8')) as unknown[];
    assert.equal(content.length, 1, 'new history file should contain the report');

    // Corrupt file should be backed up with .bak in the name
    const files = readdirSync(tempDir);
    assert.ok(
      files.some((f) => f.includes('.bak')),
      `backup file should exist; found files: ${files.join(', ')}`,
    );
  });
});
