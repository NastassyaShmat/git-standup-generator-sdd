import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { StandupReport } from '../../src/types.js';

// We override HOME so that history-store resolves to a temp directory.
// Requires process.env.HOME to be used as fallback in os.homedir().

function makeReport(date: string): StandupReport {
  return {
    date,
    author: 'alice@example.com',
    period: { since: 'yesterday', until: 'now' },
    entries: {},
    summary: { total_commits: 1, branches: ['main'], types: { feat: 1 } },
  };
}

let fakeHome: string;
let originalHome: string | undefined;

async function loadStore() {
  // Re-import to get fresh module each time (ESM import caching works within one test process)
  return import('../../src/history-store.js');
}

describe('history-store', () => {
  before(async () => {
    fakeHome = join(tmpdir(), `git-standup-test-${Date.now()}`);
    await mkdir(fakeHome, { recursive: true });
    originalHome = process.env['HOME'];
    process.env['HOME'] = fakeHome;
  });

  after(async () => {
    if (originalHome !== undefined) {
      process.env['HOME'] = originalHome;
    }
    await rm(fakeHome, { recursive: true, force: true });
  });

  it('appendReport creates .git-standup/history.json on first save', async () => {
    const { appendReport, listReports } = await loadStore();
    const report = makeReport('2026-04-20');

    await appendReport(report);
    const all = await listReports();

    assert.equal(all.length, 1);
    assert.equal(all[0]?.date, '2026-04-20');
  });

  it('appendReport appends without mutating existing reports', async () => {
    const { appendReport, listReports } = await loadStore();

    await appendReport(makeReport('2026-04-21'));
    const all = await listReports();

    assert.equal(all.length, 2);
    assert.equal(all[0]?.date, '2026-04-20');
    assert.equal(all[1]?.date, '2026-04-21');
  });

  it('findByDate returns the matching report', async () => {
    const { findByDate } = await loadStore();
    const result = await findByDate('2026-04-20');

    assert.ok(result !== undefined);
    assert.equal(result.date, '2026-04-20');
  });

  it('findByDate returns undefined for non-existent date', async () => {
    const { findByDate } = await loadStore();
    const result = await findByDate('2026-01-01');
    assert.equal(result, undefined);
  });

  it('pre-existing .tmp file is overwritten on next save', async () => {
    const { appendReport, listReports } = await loadStore();
    const staleContent = 'not valid json at all!!!';
    const tmpPath = join(fakeHome, '.git-standup', 'history.json.tmp');
    await writeFile(tmpPath, staleContent, 'utf8');

    await appendReport(makeReport('2026-04-22'));
    const all = await listReports();

    assert.equal(all.length, 3);
  });

  it('corrupt history.json is treated as empty — new save succeeds', async () => {
    const corruptHome = join(tmpdir(), `git-standup-corrupt-${Date.now()}`);
    const origHome = process.env['HOME'];
    await mkdir(join(corruptHome, '.git-standup'), { recursive: true });
    await writeFile(join(corruptHome, '.git-standup', 'history.json'), 'not valid json', 'utf8');
    process.env['HOME'] = corruptHome;

    try {
      const { appendReport, listReports } = await loadStore();
      await appendReport(makeReport('2026-04-23'));
      const all = await listReports();
      assert.equal(all.length, 1);
      assert.equal(all[0]?.date, '2026-04-23');
    } finally {
      process.env['HOME'] = origHome;
      await rm(corruptHome, { recursive: true, force: true });
    }
  });
});
