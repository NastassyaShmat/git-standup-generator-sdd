import { execSync } from 'child_process';
import { GitCommit, GitReaderOptions } from './types';

// git log format: fields separated by \x1F (Unit Separator), records by \x1E (Record Separator)
// Fields: hash, subject, author name, author email, ISO date, decorations, parent hashes
const GIT_LOG_FORMAT =
  '%H\x1F%s\x1F%aN\x1F%aE\x1F%aI\x1F%(decorate:prefix=,suffix=,separator=|,tag=tag:)\x1F%P\x1E';

const FIELD_SEP = '\x1F';
const RECORD_SEP = '\x1E';

/**
 * Extracts the branch name from the git decorate field.
 * Looks for "HEAD -> branchname" first, then "origin/branchname".
 * Falls back to "unknown" for detached HEAD or missing decoration.
 */
function extractBranch(decorations: string): string {
  if (!decorations || decorations.trim() === '') {
    return 'unknown';
  }

  const refs = decorations.split('|').map((r) => r.trim());

  // Prefer HEAD -> branchname (local branch pointer)
  for (const ref of refs) {
    const headMatch = ref.match(/^HEAD\s*->\s*(.+)$/);
    if (headMatch) {
      return headMatch[1].trim();
    }
  }

  // Fall back to origin/branchname
  for (const ref of refs) {
    const originMatch = ref.match(/^origin\/(.+)$/);
    if (originMatch) {
      return originMatch[1].trim();
    }
  }

  return 'unknown';
}

/**
 * Parses a single raw git log record string (the content between \x1E separators)
 * into a GitCommit object.
 *
 * Exported for use in property-based tests (Task 4.2).
 */
export function parseGitLogRecord(record: string): GitCommit | null {
  const trimmed = record.trim();
  if (trimmed === '') {
    return null;
  }

  const fields = trimmed.split(FIELD_SEP);
  // Expect exactly 7 fields: hash, message, author, email, date, decorations, parents
  if (fields.length < 7) {
    return null;
  }

  const [hash, message, author, email, isoDate, decorations, parentsRaw] = fields;

  // isMerge: true when there are two or more parent hashes (space-separated)
  const parentHashes = parentsRaw.trim().split(/\s+/).filter((h) => h.length > 0);
  const isMerge = parentHashes.length >= 2;

  const branch = extractBranch(decorations);

  return {
    hash: hash.trim(),
    message: message.trim(),
    author: author.trim(),
    email: email.trim(),
    date: new Date(isoDate.trim()),
    branch,
    isMerge,
  };
}

/**
 * Resolves the default author from `git config user.name` in the given repo.
 */
function resolveDefaultAuthor(repo: string): string {
  try {
    const name = execSync('git config user.name', {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return name.trim();
  } catch {
    // If git config user.name is not set, return empty string (no author filter)
    return '';
  }
}

/**
 * Reads git commits from the given repository using the provided options.
 * Returns an array of GitCommit objects.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.6, 1.7, 1.8, 1.9, 1.10, 8.3, 8.4
 */
export function readCommits(options: GitReaderOptions): GitCommit[] {
  const { repo, since, until } = options;
  let { author } = options;

  // Requirement 1.7: when --author is omitted (empty string), resolve from git config
  if (!author) {
    author = resolveDefaultAuthor(repo);
  }

  // Build the git log command
  const formatArg = `--format=${GIT_LOG_FORMAT}`;
  const args: string[] = [
    'log',
    formatArg,
    `--since=${since}`,
    `--until=${until}`,
    '--decorate=full',
  ];

  if (author) {
    args.push(`--author=${author}`);
  }

  const command = `git ${args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`;

  let rawOutput: string;
  try {
    rawOutput = execSync(command, {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException & { stderr?: string; message?: string };

    // Requirement 8.4: git binary not found
    if (error.code === 'ENOENT') {
      throw new Error(
        "Error: 'git' executable not found. Please install git and ensure it is on your PATH."
      );
    }

    // Requirement 1.8: not a git repository
    const stderr = error.stderr ?? '';
    const message = error.message ?? '';
    if (stderr.includes('not a git repository') || message.includes('not a git repository')) {
      throw new Error(`Error: '${repo}' is not a valid git repository.`);
    }

    // Re-throw other errors with their original message
    throw new Error(message || String(err));
  }

  // Parse the raw output: split on record separator, parse each record
  const records = rawOutput.split(RECORD_SEP);
  const commits: GitCommit[] = [];

  for (const record of records) {
    const commit = parseGitLogRecord(record);
    if (commit !== null) {
      commits.push(commit);
    }
  }

  return commits;
}
