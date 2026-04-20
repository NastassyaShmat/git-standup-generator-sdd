import type { GitCommit } from './types.js';

// ---------------------------------------------------------------------------
// Branch extraction from git %D ref-names string
// ---------------------------------------------------------------------------

/**
 * Extract a local branch name from a git %D decoration string.
 * Returns null when no recognisable local branch is found.
 */
function extractBranch(refs: string): string | null {
  if (!refs.trim()) return null;

  // Prefer the explicit HEAD -> <branch> form (most common on tip commits)
  const headMatch = refs.match(/HEAD -> ([^,\s]+)/);
  if (headMatch?.[1] !== undefined) return headMatch[1];

  // Fall back to the first ref that is not a remote-tracking ref or a tag
  const parts = refs.split(',').map((r) => r.trim());
  for (const part of parts) {
    if (
      part.length > 0 &&
      !part.startsWith('origin/') &&
      !part.startsWith('tag:') &&
      part !== 'HEAD'
    ) {
      return part;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse the raw stdout produced by:
 *   git log --format="COMMIT%x00%H%x1f%s%x1f%an%x1f%ae%x1f%aI%x1f%D%x1f%P" --name-only
 *
 * Records start with the sentinel `COMMIT\x00`.
 * Fields are separated by `\x1f` (ASCII Unit Separator).
 * Non-empty lines after a sentinel line are file paths from --name-only.
 *
 * Branch backfill: walk commits in output order (newest first).
 * Each commit without a visible local branch ref inherits the most recently
 * seen branch name.
 */
export function parseCommits(raw: string): GitCommit[] {
  type RawRecord = {
    hash: string;
    subject: string;
    author: string;
    email: string;
    date: string;
    refs: string;
    parents: string;
    files: string[];
  };

  const rawRecords: RawRecord[] = [];
  let current: RawRecord | null = null;

  for (const line of raw.split('\n')) {
    if (line.startsWith('COMMIT\x00')) {
      if (current) rawRecords.push(current);

      // slice off "COMMIT\x00" (7 characters)
      const parts = line.slice(7).split('\x1f');
      const [hash = '', subject = '', author = '', email = '', date = '', refs = '', parents = ''] = parts;
      current = { hash, subject, author, email, date, refs, parents, files: [] };
    } else if (current && line.trim() !== '') {
      current.files.push(line.trim());
    }
  }
  if (current) rawRecords.push(current);

  const commits: GitCommit[] = [];
  let lastSeenBranch = 'unknown';

  for (const rec of rawRecords) {
    // Validate hash: must be exactly 40 hex characters
    if (!/^[0-9a-f]{40}$/i.test(rec.hash)) {
      process.stderr.write(
        `[git-standup] Skipping commit with invalid hash: "${rec.hash}"\n`,
      );
      continue;
    }

    // Validate date: must be parseable by Date
    if (isNaN(new Date(rec.date).getTime())) {
      process.stderr.write(
        `[git-standup] Skipping commit ${rec.hash.slice(0, 7)} with invalid date: "${rec.date}"\n`,
      );
      continue;
    }

    // Normalise empty subject
    const subject = rec.subject.trim() !== '' ? rec.subject.trim() : '(no message)';

    // Branch backfill
    const extracted = extractBranch(rec.refs);
    if (extracted !== null) lastSeenBranch = extracted;

    // Merge detection: more than one parent hash
    const isMerge = rec.parents.trim().split(/\s+/).filter(Boolean).length > 1;

    commits.push({
      hash: rec.hash,
      subject,
      author: rec.author,
      email: rec.email,
      date: rec.date,
      branch: lastSeenBranch,
      isMerge,
      files: rec.files,
    });
  }

  return commits;
}
