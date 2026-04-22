import { spawn } from 'node:child_process';
import type { CliOptions } from './types.js';

/**
 * The git log --format template.
 * %x00 = null byte  (record sentinel, written as COMMIT\x00 prefix)
 * %x1f = unit sep   (field delimiter within a record)
 * Fields: hash, subject, author name, author email, ISO date, ref-names, parents
 */
const GIT_FORMAT =
  'COMMIT%x00%H%x1f%s%x1f%an%x1f%ae%x1f%aI%x1f%D%x1f%P';

/**
 * Spawn `git log` and collect the raw stdout.
 *
 * Rejects with a human-readable Error when:
 * - git is not found in PATH (ENOENT)
 * - git exits with a non-zero code
 */
export function readGitLog(
  options: Pick<CliOptions, 'since' | 'until' | 'author' | 'repo'>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args: string[] = [
      'log',
      `--format=${GIT_FORMAT}`,
      '--name-only',
      `--since=${options.since}`,
      `--until=${options.until}`,
    ];

    if (options.author.length > 0) {
      args.push(`--author=${options.author}`);
    }

    const child = spawn('git', args, {
      cwd: options.repo,
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        reject(new Error('git not found in PATH. Please install git.'));
      } else {
        reject(err);
      }
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `git exited with code ${String(code ?? 'null')}: ${stderr.trim()}`,
          ),
        );
      } else {
        resolve(stdout);
      }
    });
  });
}
