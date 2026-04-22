import type { GitCommit } from './types.js';

/**
 * Filter commits by exclusion patterns.
 *
 * - `patterns: []` → all commits pass through unchanged.
 * - The special token `"merge"` excludes commits where `isMerge === true`.
 * - All other tokens are case-insensitive `startsWith` matches against the
 *   commit subject.
 */
export function filterCommits(commits: GitCommit[], patterns: string[]): GitCommit[] {
  if (patterns.length === 0) return commits;

  return commits.filter((commit) => {
    for (const pattern of patterns) {
      if (pattern === 'merge') {
        if (commit.isMerge) return false;
      } else {
        if (commit.subject.toLowerCase().startsWith(pattern.toLowerCase())) {
          return false;
        }
      }
    }
    return true;
  });
}
