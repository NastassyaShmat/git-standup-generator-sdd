import { spawn } from 'node:child_process';
import type { CliOptions, GitCommit } from './types.js';
import { GitReaderError } from './types.js';

/**
 * Format: hash \x1f author \x1f email \x1f ISO-date \x1f parent-hashes \x1f subject \x1e
 * \x1f = unit separator (field delimiter)
 * \x1e = record separator (record delimiter)
 */
const GIT_FORMAT = '--pretty=format:%H%x1f%an%x1f%ae%x1f%aI%x1f%P%x1f%s%x1e';

function runGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, shell: false });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        reject(new GitReaderError('git not found in PATH. Please install git and ensure it is on your PATH.'));
      } else {
        reject(new GitReaderError(`Failed to spawn git: ${err.message}`));
      }
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new GitReaderError(`git exited with code ${String(code ?? 'null')}: ${stderr.trim()}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

function resolveCurrentBranch(repo: string): Promise<string> {
  return runGit(['rev-parse', '--abbrev-ref', 'HEAD'], repo).then((out) => out.trim()).catch(() => 'unknown');
}

function parseRecord(record: string, defaultBranch: string): GitCommit | null {
  const fields = record.split('\x1f');
  if (fields.length < 6) return null;

  const [hash, author, email, dateStr, parents, ...subjectParts] = fields;
  const subject = subjectParts.join('\x1f').trimEnd();

  if (!hash || !dateStr) return null;

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  const isMerge = (parents ?? '').trim().split(' ').filter(Boolean).length > 1;

  return {
    hash: hash.trim(),
    message: subject || '(no message)',
    author: author ?? '',
    email: email ?? '',
    date,
    branch: defaultBranch,
    isMerge,
  };
}

export async function readCommits(
  options: Pick<CliOptions, 'repo' | 'since' | 'until' | 'author'>,
): Promise<GitCommit[]> {
  const { repo, since, until, author } = options;

  const defaultBranch = await resolveCurrentBranch(repo);

  const args: string[] = [
    'log',
    GIT_FORMAT,
    `--since=${since}`,
    `--until=${until}`,
  ];

  if (author) {
    args.push(`--author=${author}`);
  }

  let raw: string;
  try {
    raw = await runGit(args, repo);
  } catch (err) {
    throw err instanceof GitReaderError ? err : new GitReaderError(String(err));
  }

  if (!raw.trim()) return [];

  const records = raw.split('\x1e').filter((r) => r.trim().length > 0);
  const commits: GitCommit[] = [];

  for (const record of records) {
    const commit = parseRecord(record.trim(), defaultBranch);
    if (commit) commits.push(commit);
  }

  return commits;
}
