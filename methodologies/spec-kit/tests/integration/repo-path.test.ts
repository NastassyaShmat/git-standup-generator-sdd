import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// T030 — --repo flag: path validation tests
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = resolve(__dirname, '../../src/cli.ts');

function spawnCLI(args: string[]): { status: number | null; stderr: string; stdout: string } {
  const result = spawnSync('node', ['--import', 'tsx', CLI_PATH, ...args], {
    encoding: 'utf8',
  });
  return {
    status: result.status ?? null,
    stderr: result.stderr ?? '',
    stdout: result.stdout ?? '',
  };
}

describe('--repo flag: path validation', () => {
  it('non-existent path → exit 1 with "--repo path does not exist" message', () => {
    const result = spawnCLI(['--repo=/non/existent/path/xyz_standup_test_123']);

    assert.equal(result.status, 1, `Expected exit code 1; got ${result.status}`);
    assert.ok(
      result.stderr.includes('--repo path does not exist'),
      `Expected "--repo path does not exist" in stderr; got: ${result.stderr}`,
    );
  });

  it('path exists but has no .git directory → exit 1 with clear error message', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'git-standup-nongit-'));
    try {
      const result = spawnCLI([`--repo=${tempDir}`]);

      assert.equal(result.status, 1, `Expected exit code 1; got ${result.status}`);
      assert.ok(
        result.stderr.toLowerCase().includes('git') ||
          result.stderr.includes('.git') ||
          result.stderr.includes('not a git repository'),
        `Expected git repo error in stderr; got: ${result.stderr}`,
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
