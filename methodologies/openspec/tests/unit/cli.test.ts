import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../../src/cli.js';

// We stub git-reader and history-store via environment tricks;
// The simplest approach for unit-testing the CLI is to run it against
// a real (throwaway) git repo, which is covered in integration tests.
// Here we test flag validation and exit codes without a real repo.

describe('run() — argument validation', () => {
  it('unknown flag → exits with code 2', async () => {
    const code = await run(['--unknown-flag', 'value']);
    assert.equal(code, 2);
  });

  it('invalid --format value → exits with code 2', async () => {
    const code = await run(['--format', 'html']);
    assert.equal(code, 2);
  });

  it('invalid --group-by value → exits with code 2', async () => {
    // Use a non-existent repo so we don't actually run git, but validate args first
    const code = await run(['--group-by', 'author']);
    assert.equal(code, 2);
  });

  it('--format json is valid → does not exit with code 2 due to format', async () => {
    // This will likely fail with code 1 because cwd may not be a git repo in test env,
    // but it should NOT exit with code 2 (arg validation error).
    const code = await run(['--format', 'json', '--since', '1 year ago']);
    assert.notEqual(code, 2, 'Valid format should not produce exit code 2');
  });

  it('--exclude "" clears defaults → exits 0 or 1 (not 2)', async () => {
    const code = await run(['--exclude', '', '--since', '1 year ago']);
    assert.notEqual(code, 2);
  });
});
