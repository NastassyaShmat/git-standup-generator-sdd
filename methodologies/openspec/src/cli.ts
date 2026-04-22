import { parseArgs } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { CliOptions, GroupBy, OutputFormat } from './types.js';
import { GitReaderError } from './types.js';
import { readCommits } from './git-reader.js';
import { filterCommits } from './commit-filter.js';
import { groupCommits } from './commit-grouper.js';
import { buildReport, formatReport } from './report-formatter.js';
import { appendReport } from './history-store.js';

const execFileAsync = promisify(execFile);

const VALID_FORMATS: OutputFormat[] = ['text', 'markdown', 'json'];
const VALID_GROUP_BY: GroupBy[] = ['type', 'branch', 'path'];

const USAGE = `Usage: git-standup [options]

Options:
  --repo <path>          Path to the git repository (default: cwd)
  --since <date>         Start of time range (default: "yesterday")
  --until <date>         End of time range (default: "now")
  --author <email>       Filter by author email (default: git config user.email)
  --format <fmt>         Output format: text|markdown|json (default: text)
  --exclude <patterns>   Comma-separated exclusion patterns (default: "merge,wip")
  --group-by <strategy>  Grouping: type|branch|path (default: type)
  --output <file>        Write report to file instead of stdout
  --save                 Append report to ~/.git-standup/history.json
`;

async function resolveAuthorEmail(repo: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['config', 'user.email'], { cwd: repo });
    return stdout.trim();
  } catch {
    return '';
  }
}

export async function run(argv: string[]): Promise<number> {
  let parsed: ReturnType<typeof parseArgs>;

  try {
    parsed = parseArgs({
      args: argv,
      options: {
        repo: { type: 'string' },
        since: { type: 'string' },
        until: { type: 'string' },
        author: { type: 'string' },
        format: { type: 'string' },
        exclude: { type: 'string' },
        'group-by': { type: 'string' },
        output: { type: 'string' },
        save: { type: 'boolean', default: false },
      },
      strict: true,
    });
  } catch (err) {
    process.stderr.write(`Error: ${String(err instanceof Error ? err.message : err)}\n${USAGE}`);
    return 2;
  }

  const { values } = parsed;
  const repo = (values['repo'] as string | undefined) ?? process.cwd();

  // Resolve format
  const rawFormat = (values['format'] as string | undefined) ?? 'text';
  if (!VALID_FORMATS.includes(rawFormat as OutputFormat)) {
    process.stderr.write(`Error: Invalid --format value "${rawFormat}". Must be one of: ${VALID_FORMATS.join(', ')}\n${USAGE}`);
    return 2;
  }
  const format = rawFormat as OutputFormat;

  // Resolve group-by
  const rawGroupBy = (values['group-by'] as string | undefined) ?? 'type';
  if (!VALID_GROUP_BY.includes(rawGroupBy as GroupBy)) {
    process.stderr.write(`Error: Invalid --group-by value "${rawGroupBy}". Must be one of: ${VALID_GROUP_BY.join(', ')}\n${USAGE}`);
    return 2;
  }
  const groupBy = rawGroupBy as GroupBy;

  // Resolve exclude patterns
  let exclude: string[];
  if ('exclude' in values && values['exclude'] !== undefined) {
    const raw = values['exclude'] as string;
    exclude = raw === '' ? [] : raw.split(',').map((p) => p.trim()).filter(Boolean);
  } else {
    exclude = ['merge', 'wip'];
  }

  // Resolve author
  const author = (values['author'] as string | undefined) ?? await resolveAuthorEmail(repo);
  const since = (values['since'] as string | undefined) ?? 'yesterday';
  const until = (values['until'] as string | undefined) ?? 'now';
  const output = values['output'] as string | undefined;
  const save = (values['save'] as boolean | undefined) ?? false;

  const options: CliOptions = { repo, since, until, author, format, exclude, groupBy, output: output ?? '', save };

  try {
    // Pipeline
    const commits = await readCommits(options);
    const filtered = filterCommits(commits, exclude);
    const grouped = await groupCommits(filtered, groupBy, repo);

    const today = new Date().toISOString().slice(0, 10);
    const report = buildReport(today, author, { since, until }, grouped);
    const rendered = formatReport(report, format) + '\n';

    // Write output
    if (output) {
      await writeFile(output, rendered, 'utf8');
    } else {
      process.stdout.write(rendered);
    }

    // Persist if --save
    if (save) {
      await appendReport(report);
    }

    return 0;
  } catch (err) {
    if (err instanceof GitReaderError) {
      process.stderr.write(`Error: ${err.message}\n`);
      return 1;
    }
    process.stderr.write(`Error: ${String(err instanceof Error ? err.message : err)}\n`);
    return 1;
  }
}
