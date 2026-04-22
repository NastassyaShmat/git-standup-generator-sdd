import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readGitLog } from '../../src/git-reader.js';
import { parseCommits } from '../../src/commit-parser.js';
import { filterCommits } from '../../src/commit-filter.js';
import { groupCommits } from '../../src/commit-grouper.js';
import { formatReport } from '../../src/report-formatter.js';
import type { StandupReport } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

describe('Integration: full pipeline', () => {
  let tempDir = '';

  before(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'git-standup-pipeline-'));

    const git = (cmd: string): string =>
      execSync(`git ${cmd}`, {
        cwd: tempDir,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

    git('init -b main');
    git('config user.email "pipeline@example.com"');
    git('config user.name "Pipeline Test"');

    // Commit 1 (main): feat
    writeFileSync(join(tempDir, 'README.md'), '# Test repo');
    git('add .');
    git('commit -m "feat: add initial feature"');

    // Create feature branch and commit (feat)
    git('checkout -b feature-x');
    writeFileSync(join(tempDir, 'feature.ts'), 'export const x = 1;');
    git('add .');
    git('commit -m "feat: add feature component"');

    // Back to main
    git('checkout main');

    // Commit 3 (main): fix
    writeFileSync(join(tempDir, 'fix.ts'), 'export const fix = true;');
    git('add .');
    git('commit -m "fix: resolve startup bug"');

    // Merge commit (merge of feature-x into main)
    git('merge --no-ff feature-x -m "Merge branch feature-x"');

    // Commit 5 (main): WIP
    writeFileSync(join(tempDir, 'wip.ts'), 'export const wip = true;');
    git('add .');
    git('commit -m "WIP: draft implementation"');
  });

  after(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Default pipeline: exclude merge + wip, groupBy type, format text
  // -------------------------------------------------------------------------

  it('default run: 3 entries, merge and WIP absent, feat and fix groups present', async () => {
    const raw = await readGitLog({
      since: '1970-01-01',
      until: 'now',
      author: 'pipeline@example.com',
      repo: tempDir,
    });

    const commits = parseCommits(raw);
    const filtered = filterCommits(commits, ['merge', 'wip']);
    const grouped = groupCommits(filtered, 'type');
    const { report, formatted } = formatReport(grouped, {
      date: '2026-04-20',
      author: 'pipeline@example.com',
      period: '1970-01-01 → now',
      format: 'text',
    });

    assert.equal(report.summary.commitCount, 3, 'exactly 3 commits after filtering');
    assert.ok(report.entries['feat'] !== undefined, 'feat group must exist');
    assert.ok(report.entries['fix'] !== undefined, 'fix group must exist');
    assert.ok(formatted.includes('3 commit(s)'), `footer must show 3 commit(s); got:\n${formatted}`);

    // Verify no merge or WIP entries leaked through
    const allMessages = Object.values(report.entries)
      .flat()
      .map((e) => e.message.toLowerCase());
    assert.ok(!allMessages.some((m) => m.startsWith('merge')), 'no merge entries');
    assert.ok(!allMessages.some((m) => m.startsWith('wip')), 'no WIP entries');
  });

  // -------------------------------------------------------------------------
  // JSON format
  // -------------------------------------------------------------------------

  it('JSON format: commitCount === 3, entries keys match types, branchesTouched non-empty', async () => {
    const raw = await readGitLog({
      since: '1970-01-01',
      until: 'now',
      author: 'pipeline@example.com',
      repo: tempDir,
    });

    const commits = parseCommits(raw);
    const filtered = filterCommits(commits, ['merge', 'wip']);
    const grouped = groupCommits(filtered, 'type');
    const { formatted } = formatReport(grouped, {
      date: '2026-04-20',
      author: 'pipeline@example.com',
      period: '1970-01-01 → now',
      format: 'json',
    });

    const parsed = JSON.parse(formatted) as StandupReport;

    assert.equal(parsed.summary.commitCount, 3);
    assert.ok(Object.keys(parsed.entries).length > 0, 'entries must have at least one group');
    assert.ok(parsed.summary.branchesTouched.length > 0, 'branchesTouched must be non-empty');

    // entry keys should be CommitType values (feat, fix, etc.)
    const knownTypes = new Set(['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert', 'other']);
    for (const key of Object.keys(parsed.entries)) {
      assert.ok(knownTypes.has(key), `unexpected entry key: ${key}`);
    }
  });
});
