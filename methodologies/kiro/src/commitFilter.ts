import { GitCommit } from './types';

/**
 * Filters a list of GitCommit objects by applying exclusion rules:
 * 1. Always excludes merge commits (isMerge === true)
 * 2. Excludes commits whose message contains any pattern in excludePatterns
 *    (case-insensitive substring match)
 *
 * Pure function — does not mutate the input array.
 */
export function filterCommits(commits: GitCommit[], excludePatterns: string[]): GitCommit[] {
  return commits.filter((commit) => {
    if (commit.isMerge) {
      return false;
    }

    const messageLower = commit.message.toLowerCase();
    for (const pattern of excludePatterns) {
      if (messageLower.includes(pattern.toLowerCase())) {
        return false;
      }
    }

    return true;
  });
}
