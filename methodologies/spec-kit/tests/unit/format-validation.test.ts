import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatReport } from '../../src/report-formatter.js';
import type { StandupEntry, StandupReport } from '../../src/types.js';

// ---------------------------------------------------------------------------
// T021 — Format selection and validation
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = resolve(__dirname, '../../src/cli.ts');

function makeEntry(overrides: Partial<StandupEntry> = {}): StandupEntry {
  return {
    hash: 'a1b2c3d',
    message: 'add feature',
    type: 'feat',
    branch: 'main',
    timestamp: '2026-04-20T10:00:00+00:00',
    ...overrides,
  };
}

describe('Format validation', () => {
  // -------------------------------------------------------------------------
  // Pure formatReport unit checks (no CLI spawn needed)
  // -------------------------------------------------------------------------

  it('--format=text → output starts with "What I did:" (matches schema)', () => {
    const grouped = new Map<string, StandupEntry[]>([['feat', [makeEntry()]]]);
    const { formatted } = formatReport(grouped, {
      date: '2026-04-20',
      author: 'test@example.com',
      period: 'yesterday → now',
      format: 'text',
    });
    assert.ok(formatted.startsWith('What I did:'), `Got: ${formatted.slice(0, 60)}`);
  });

  it('--format=markdown → output starts with "## What I did" (matches schema)', () => {
    const grouped = new Map<string, StandupEntry[]>([['feat', [makeEntry()]]]);
    const { formatted } = formatReport(grouped, {
      date: '2026-04-20',
      author: 'test@example.com',
      period: 'yesterday → now',
      format: 'markdown',
    });
    assert.ok(formatted.startsWith('## What I did'), `Got: ${formatted.slice(0, 60)}`);
  });

  it('--format=json → output is valid JSON conforming to StandupReport', () => {
    const grouped = new Map<string, StandupEntry[]>([['feat', [makeEntry()]]]);
    const { formatted } = formatReport(grouped, {
      date: '2026-04-20',
      author: 'test@example.com',
      period: 'yesterday → now',
      format: 'json',
    });
    const parsed = JSON.parse(formatted) as StandupReport;
    assert.ok('date' in parsed, 'report must have date');
    assert.ok('author' in parsed, 'report must have author');
    assert.ok('entries' in parsed, 'report must have entries');
    assert.ok('summary' in parsed, 'report must have summary');
    assert.ok(typeof parsed.summary.commitCount === 'number');
    assert.ok(Array.isArray(parsed.summary.branchesTouched));
    assert.ok(typeof parsed.summary.typeDistribution === 'object');
  });

  // -------------------------------------------------------------------------
  // CLI-level: invalid format exits 1 with message (spawned process)
  // -------------------------------------------------------------------------

  it("invalid --format=csv → cli exits 1 with message \"Invalid --format value 'csv'\"", () => {
    const result = spawnSync('node', ['--import', 'tsx', CLI_PATH, '--format=csv'], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 1, `Expected exit 1; got ${result.status}`);
    assert.ok(
      result.stderr.includes("Invalid --format value 'csv'"),
      `Expected error in stderr; got: ${result.stderr}`,
    );
    assert.ok(
      result.stderr.includes('Expected: text, markdown, json'),
      `Expected suggestion in stderr; got: ${result.stderr}`,
    );
  });
});
