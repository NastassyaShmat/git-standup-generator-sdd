import type { GitCommit } from './types.js';

/**
 * Filter commits according to exclusion rules:
 * - Merge commits (isMerge === true) are always dropped.
 * - Commits whose message (case-insensitive) contains any exclusion pattern are dropped.
 * - Input order is preserved.
 */
export function filterCommits(commits: GitCommit[], exclude: string[]): GitCommit[] {
  const lowerPatterns = exclude.map((p) => p.toLowerCase());

  return commits.filter((commit) => {
    if (commit.isMerge) return false;

    const lowerMessage = commit.message.toLowerCase();
    for (const pattern of lowerPatterns) {
      if (lowerMessage.includes(pattern)) return false;
    }

    return true;
  });
}
