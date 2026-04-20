#!/usr/bin/env node
import { parseArgs } from "node:util";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { readGitLog } from "./git-reader.js";
import { parseCommits } from "./commit-parser.js";
import { filterCommits } from "./commit-filter.js";
import { groupCommits } from "./commit-grouper.js";
import { formatReport } from "./report-formatter.js";
import { appendToHistory } from "./history-store.js";
import type { CliOptions } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getVersion(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const pkgPath = join(__dirname, "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
  return pkg.version;
}

function resolveAuthor(): string {
  try {
    return execSync("git config user.email", {
      encoding: "utf8",
      stdio: "pipe",
    }).trim();
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Exported raw arg parser (testable without side effects)
// ---------------------------------------------------------------------------

/** Raw parsed values from argv — no validation, no git calls, no defaults applied. */
export interface RawCliArgs {
  since: string;
  until: string;
  author: string | undefined;
  format: string;
  "group-by": string;
  exclude: string | undefined;
  output: string | undefined;
  repo: string | undefined;
  save: boolean;
  help: boolean;
  version: boolean;
}

export function parseRawCliArgs(argv: string[]): RawCliArgs {
  const { values } = parseArgs({
    args: argv,
    options: {
      since: { type: "string", default: "yesterday" },
      until: { type: "string", default: "now" },
      author: { type: "string" },
      format: { type: "string", default: "text" },
      "group-by": { type: "string", default: "type" },
      exclude: { type: "string" },
      output: { type: "string" },
      repo: { type: "string" },
      save: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
    strict: true,
    allowPositionals: false,
  });
  return values as unknown as RawCliArgs;
}

function printHelp(): void {
  process.stdout.write(
    [
      "git-standup — Generate a standup report from git history",
      "",
      "Usage: git-standup [options]",
      "",
      "Filtering:",
      '  --since=<value>       Start of time window (default: "yesterday")',
      '  --until=<value>       End of time window (default: "now")',
      "  --author=<pattern>    Author filter (default: git config user.email)",
      '  --exclude=<patterns>  Comma-separated exclusion patterns (default: "merge,wip")',
      "  --repo=<path>         Path to git repository (default: current directory)",
      "",
      "Output:",
      '  --format=<fmt>        Output format: text|markdown|json (default: "text")',
      '  --group-by=<strategy> Grouping: type|branch|path (default: "type")',
      "  --output=<filepath>   Write report to file instead of stdout",
      "  --save                Append report to ~/.git-standup/history.json",
      "",
      "Meta:",
      "  -h, --help            Print this help text and exit",
      "  -v, --version         Print version and exit",
      "",
      "Examples:",
      "  git-standup",
      '  git-standup --since="3 days ago" --format=markdown',
      '  git-standup --author="alice@example.com" --group-by=branch',
    ].join("\n") + "\n",
  );
}

// ---------------------------------------------------------------------------
// Main entry point (exported so it can be tested without spawning a process)
// ---------------------------------------------------------------------------

export async function run(argv: string[]): Promise<void> {
  let values: RawCliArgs;

  try {
    values = parseRawCliArgs(argv);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${msg}\n`);
    process.exit(1);
    return;
  }

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  if (values.version) {
    process.stdout.write(getVersion() + "\n");
    process.exit(0);
  }

  // Validate --format
  const formatValue = values.format;
  if (!["text", "markdown", "json"].includes(formatValue)) {
    process.stderr.write(
      `Error: Invalid --format value '${formatValue}'. Expected: text, markdown, json.\n`,
    );
    process.exit(1);
  }

  // Validate --group-by
  const groupByValue = values["group-by"];
  if (!["type", "branch", "path"].includes(groupByValue)) {
    process.stderr.write(
      `Error: Invalid --group-by value '${groupByValue}'. Expected: type, branch, path.\n`,
    );
    process.exit(1);
  }

  // Resolve and validate --repo
  const repoRaw = values.repo ?? process.cwd();
  const repoPath = resolve(repoRaw);

  if (!existsSync(repoPath)) {
    process.stderr.write(`Error: --repo path does not exist: ${repoPath}\n`);
    process.exit(1);
  }
  if (!existsSync(join(repoPath, ".git"))) {
    process.stderr.write(
      `Error: --repo path is not a git repository (no .git directory): ${repoPath}\n`,
    );
    process.exit(1);
  }

  // Resolve --author
  const author = values.author ?? resolveAuthor();

  // Resolve --exclude
  const exclude =
    values.exclude !== undefined
      ? values.exclude
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
      : ["merge", "wip"];

  const options: CliOptions = {
    since: values.since,
    until: values.until,
    author,
    format: formatValue as "text" | "markdown" | "json",
    groupBy: groupByValue as "type" | "branch" | "path",
    exclude,
    repo: repoPath,
    output: values.output,
    save: values.save,
    help: false,
    version: false,
  };

  const today = new Date().toISOString().slice(0, 10);
  const period = `${options.since} → ${options.until}`;

  let rawLog: string;
  try {
    rawLog = await readGitLog(options);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${msg}\n`);
    process.exit(1);
    return;
  }

  const commits = parseCommits(rawLog);
  const filtered = filterCommits(commits, options.exclude);
  const grouped = groupCommits(filtered, options.groupBy);
  const { report, formatted } = formatReport(grouped, {
    date: today,
    author: options.author,
    period,
    format: options.format,
  });

  if (options.output !== undefined) {
    try {
      writeFileSync(options.output, formatted, "utf8");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `Error: Cannot write to ${options.output}: ${msg}\n`,
      );
      process.exit(1);
    }
  } else {
    process.stdout.write(formatted + "\n");
  }

  if (options.save) {
    const historyDir = join(
      process.env["HOME"] ?? process.env["USERPROFILE"] ?? ".",
      ".git-standup",
    );
    const historyPath = join(historyDir, "history.json");
    try {
      await appendToHistory(report, historyPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Warning: Could not save to history: ${msg}\n`);
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point (only executed when run directly, not when imported by tests)
// ---------------------------------------------------------------------------

if (realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2)).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Unexpected error: ${msg}\n`);
    process.exit(1);
  });
}
