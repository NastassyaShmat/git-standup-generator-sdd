import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseRawCliArgs } from '../../src/cli.js';

// ---------------------------------------------------------------------------
// T019 — CLI flag parsing edge cases
// ---------------------------------------------------------------------------

describe('parseRawCliArgs()', () => {
  it('--since value passed through verbatim to CliOptions.since', () => {
    const result = parseRawCliArgs(['--since=3 days ago']);
    assert.equal(result.since, '3 days ago');
  });

  it('--until value passed through verbatim to CliOptions.until', () => {
    const result = parseRawCliArgs(['--until=last friday']);
    assert.equal(result.until, 'last friday');
  });

  it('--author value passed through verbatim to CliOptions.author', () => {
    const result = parseRawCliArgs(['--author=alice@example.com']);
    assert.equal(result.author, 'alice@example.com');
  });

  it('missing --author is undefined (run() defaults to git config user.email at runtime)', () => {
    const result = parseRawCliArgs([]);
    assert.equal(result.author, undefined);
  });

  it('default --since is "yesterday" when not provided', () => {
    const result = parseRawCliArgs([]);
    assert.equal(result.since, 'yesterday');
  });

  it('default --until is "now" when not provided', () => {
    const result = parseRawCliArgs([]);
    assert.equal(result.until, 'now');
  });

  it('multiple flags combined are all parsed correctly', () => {
    const result = parseRawCliArgs([
      '--since=2 weeks ago',
      '--until=yesterday',
      '--author=bob@example.com',
    ]);
    assert.equal(result.since, '2 weeks ago');
    assert.equal(result.until, 'yesterday');
    assert.equal(result.author, 'bob@example.com');
  });
});
