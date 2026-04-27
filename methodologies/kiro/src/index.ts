#!/usr/bin/env node
import * as os from 'os';
import * as path from 'path';
import type { ParsedArgs, OutputFormat, GroupBy } from './types';
import { readCommits } from './gitReader';
import { filterCommits } from './commitFilter';
import { groupCommits } from './commitGrouper';
import { formatReport } from './reportFormatter';
import { writeOutput } from './outputWriter';
import { saveReport } from './historyStore';

const VALID_FORMATS: OutputFormat[] = ['text', 'markdown', 'json'];
const VALID_GROUP_BY: GroupBy[] = ['type', 'branch', 'path'];

/**
 * Parse CLI arguments into a typed ParsedArgs object.
 *
 * @param argv - The argument list (typically process.argv.slice(2))
 * @returns A fully-populated ParsedArgs object with defaults applied
 * @throws Error for unknown flags, invalid --format values, or invalid --group-by values
 */
export function parseArgs(argv: string[]): ParsedArgs {
  let repo: string = process.cwd();
  let since: string = 'yesterday';
  let until: string = 'now';
  let author: string = '';
  let excludePatterns: string[] | null = null; // null means "use defaults"
  let groupBy: GroupBy = 'type';
  let format: OutputFormat = 'text';
  let outputPath: string | null = null;
  let save: boolean = false;
  let historyFile: string = path.join(os.homedir(), '.git-standup-history.json');

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === '--repo') {
      repo = requireValue(argv, i, '--repo');
      i += 2;
    } else if (arg === '--since') {
      since = requireValue(argv, i, '--since');
      i += 2;
    } else if (arg === '--until') {
      until = requireValue(argv, i, '--until');
      i += 2;
    } else if (arg === '--author') {
      author = requireValue(argv, i, '--author');
      i += 2;
    } else if (arg === '--exclude') {
      const pattern = requireValue(argv, i, '--exclude');
      if (excludePatterns === null) {
        excludePatterns = [];
      }
      excludePatterns.push(pattern);
      i += 2;
    } else if (arg === '--group-by') {
      const raw = requireValue(argv, i, '--group-by');
      if (!(VALID_GROUP_BY as string[]).includes(raw)) {
        throw new Error(
          `Error: Unknown group-by value '${raw}'. Valid options are: ${VALID_GROUP_BY.join(', ')}.`
        );
      }
      groupBy = raw as GroupBy;
      i += 2;
    } else if (arg === '--format') {
      const raw = requireValue(argv, i, '--format');
      if (!(VALID_FORMATS as string[]).includes(raw)) {
        throw new Error(
          `Error: Unknown format '${raw}'. Valid options are: ${VALID_FORMATS.join(', ')}.`
        );
      }
      format = raw as OutputFormat;
      i += 2;
    } else if (arg === '--output') {
      outputPath = requireValue(argv, i, '--output');
      i += 2;
    } else if (arg === '--save') {
      save = true;
      i += 1;
    } else if (arg === '--history-file') {
      const raw = requireValue(argv, i, '--history-file');
      // Expand leading ~ to home directory
      historyFile = raw.startsWith('~')
        ? path.join(os.homedir(), raw.slice(1))
        : raw;
      i += 2;
    } else if (arg.startsWith('--')) {
      throw new Error(
        `Error: Unknown flag '${arg}'. Run with --help for usage information.`
      );
    } else {
      throw new Error(
        `Error: Unexpected argument '${arg}'. All options must be prefixed with '--'.`
      );
    }
  }

  return {
    repo,
    since,
    until,
    author,
    excludePatterns: excludePatterns ?? ['merge', 'wip'],
    groupBy,
    format,
    outputPath,
    save,
    historyFile,
  };
}

/**
 * Retrieve the value for a flag, throwing if it is missing or looks like another flag.
 */
function requireValue(argv: string[], flagIndex: number, flagName: string): string {
  const value = argv[flagIndex + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`Error: Flag '${flagName}' requires a value.`);
  }
  return value;
}

// Main execution block — pipeline orchestration
if (require.main === module) {
  try {
    // Step 1: Parse CLI arguments
    const args = parseArgs(process.argv.slice(2));

    // Step 2: Read commits from the git repository
    const commits = readCommits({
      repo: args.repo,
      since: args.since,
      until: args.until,
      author: args.author,
    });

    // Step 3: Filter out noise (merge commits, exclusion patterns)
    const filtered = filterCommits(commits, args.excludePatterns);

    // Step 4: Group commits by the chosen strategy
    const groups = groupCommits(filtered, args.groupBy, args.repo);

    // Step 5: Format the report
    const { text, report } = formatReport(groups, {
      format: args.format,
      author: args.author,
      since: args.since,
      until: args.until,
    });

    // Step 6: Write output to stdout or file
    writeOutput(text, args.outputPath);

    // Step 7: Optionally save the report to the history file
    if (args.save) {
      saveReport(report, args.historyFile);
    }

    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(message + '\n');
    process.exit(1);
  }
}
