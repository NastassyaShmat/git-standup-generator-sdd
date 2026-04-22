import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseCommits } from '../../src/commit-parser.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the raw git log line for one commit (COMMIT\x00 sentinel format). */
function makeLine(
  hash: string,
  subject: string,
  author: string,
  email: string,
  date: string,
  refs: string,
  parents: string,
): string {
  return `COMMIT\x00${hash}\x1f${subject}\x1f${author}\x1f${email}\x1f${date}\x1f${refs}\x1f${parents}`;
}

/** Assemble multiple commit lines + file listings into a raw git output string. */
function makeRaw(
  commits: Array<{
    hash: string;
    subject?: string;
    author?: string;
    email?: string;
    date?: string;
    refs?: string;
    parents?: string;
    files?: string[];
  }>,
): string {
  return (
    commits
      .map((c) => {
        const header = makeLine(
          c.hash,
          c.subject ?? 'feat: default subject',
          c.author ?? 'Alice',
          c.email ?? 'alice@example.com',
          c.date ?? '2026-04-20T10:00:00+00:00',
          c.refs ?? '',
          c.parents ?? 'p'.repeat(40),
        );
        const fileBlock = (c.files ?? ['src/main.ts']).join('\n');
        return `${header}\n\n${fileBlock}`;
      })
      .join('\n\n') + '\n'
  );
}

const HASH_A = 'a'.repeat(40);
const HASH_B = 'b'.repeat(40);
const HASH_C = 'c'.repeat(40);
const PARENT = 'p'.repeat(40);
const PARENT2 = 'q'.repeat(40);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseCommits()', () => {
  it('empty string → []', () => {
    const result = parseCommits('');
    assert.deepEqual(result, []);
  });

  it('single well-formed record → one GitCommit with all fields populated', () => {
    const raw = makeRaw([
      {
        hash: HASH_A,
        subject: 'feat: add OAuth login',
        author: 'Alice',
        email: 'alice@example.com',
        date: '2026-04-20T09:15:00+03:00',
        refs: 'HEAD -> feature/auth, origin/feature/auth',
        parents: PARENT,
        files: ['src/auth/login.ts', 'src/auth/token.ts'],
      },
    ]);

    const result = parseCommits(raw);

    assert.equal(result.length, 1);
    const commit = result[0];
    assert.equal(commit.hash, HASH_A);
    assert.equal(commit.subject, 'feat: add OAuth login');
    assert.equal(commit.author, 'Alice');
    assert.equal(commit.email, 'alice@example.com');
    assert.equal(commit.date, '2026-04-20T09:15:00+03:00');
    assert.equal(commit.branch, 'feature/auth');
    assert.equal(commit.isMerge, false);
    assert.deepEqual(commit.files, ['src/auth/login.ts', 'src/auth/token.ts']);
  });

  it('branch backfill: second commit (no ref decoration) inherits branch from first', () => {
    const raw = makeRaw([
      { hash: HASH_A, refs: 'HEAD -> main', parents: PARENT },
      { hash: HASH_B, refs: '', parents: PARENT },
    ]);

    const result = parseCommits(raw);

    assert.equal(result.length, 2);
    assert.equal((result[0]).branch, 'main');
    assert.equal((result[1]).branch, 'main');
  });

  it('isMerge: true when parent count > 1', () => {
    const raw = makeRaw([
      { hash: HASH_A, parents: `${PARENT} ${PARENT2}` },
    ]);

    const result = parseCommits(raw);

    assert.equal(result.length, 1);
    assert.equal((result[0]).isMerge, true);
  });

  it('isMerge: false when parent count is 1', () => {
    const raw = makeRaw([
      { hash: HASH_A, parents: PARENT },
    ]);

    const result = parseCommits(raw);

    assert.equal((result[0]).isMerge, false);
  });

  it('empty subject → subject set to "(no message)"', () => {
    const raw = makeRaw([
      { hash: HASH_A, subject: '' },
    ]);

    const result = parseCommits(raw);

    assert.equal(result.length, 1);
    assert.equal((result[0]).subject, '(no message)');
  });

  it('invalid date → commit is skipped; stderr warning emitted', () => {
    const raw = makeRaw([
      { hash: HASH_A, date: 'not-a-date' },
    ]);

    const warnings: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array): boolean => {
      warnings.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return true;
    }) as typeof process.stderr.write;

    const result = parseCommits(raw);
    process.stderr.write = origWrite;

    assert.equal(result.length, 0, 'commit with invalid date must be skipped');
    assert.ok(warnings.length > 0, 'stderr warning must be emitted');
  });

  it('hash that is not 40 hex chars → commit is skipped', () => {
    const raw = makeRaw([
      { hash: 'tooshort' },
    ]);

    const warnings: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array): boolean => {
      warnings.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return true;
    }) as typeof process.stderr.write;

    const result = parseCommits(raw);
    process.stderr.write = origWrite;

    assert.equal(result.length, 0, 'commit with invalid hash must be skipped');
    assert.ok(warnings.length > 0, 'stderr warning must be emitted');
  });

  it('multi-commit raw string → correct length and field values', () => {
    const raw = makeRaw([
      { hash: HASH_A, subject: 'feat: first',  refs: 'HEAD -> main', parents: PARENT  },
      { hash: HASH_B, subject: 'fix: second',  refs: '',             parents: PARENT  },
      { hash: HASH_C, subject: 'chore: third', refs: '',             parents: PARENT  },
    ]);

    const result = parseCommits(raw);

    assert.equal(result.length, 3);
    assert.equal((result[0]).subject, 'feat: first');
    assert.equal((result[1]).subject, 'fix: second');
    assert.equal((result[2]).subject, 'chore: third');
    // all three inherit branch 'main' via backfill
    assert.equal((result[0]).branch, 'main');
    assert.equal((result[1]).branch, 'main');
    assert.equal((result[2]).branch, 'main');
  });
});
