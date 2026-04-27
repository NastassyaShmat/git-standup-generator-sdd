// Report_Formatter module for git-standup-generator
// Converts grouped StandupEntry maps into formatted report strings and StandupReport objects.

import { StandupEntry, StandupReport, FormatOptions } from './types';

/**
 * Format today's date as YYYY-MM-DD.
 */
function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Collect all entries from the groups map into a flat array.
 */
function flattenEntries(groups: Map<string, StandupEntry[]>): StandupEntry[] {
  const all: StandupEntry[] = [];
  for (const entries of groups.values()) {
    for (const entry of entries) {
      all.push(entry);
    }
  }
  return all;
}

/**
 * Build the summary fields from a flat list of entries.
 */
function buildSummary(entries: StandupEntry[]): StandupReport['summary'] {
  const branchSet = new Set<string>();
  const types: Record<string, number> = {};

  for (const entry of entries) {
    branchSet.add(entry.branch);
    types[entry.type] = (types[entry.type] ?? 0) + 1;
  }

  const branches = Array.from(branchSet).sort();

  return {
    totalCommits: entries.length,
    branches,
    types,
  };
}

/**
 * Build the StandupReport object.
 */
function buildReport(
  entries: StandupEntry[],
  options: FormatOptions,
  date: string
): StandupReport {
  return {
    date,
    author: options.author,
    period: {
      since: options.since,
      until: options.until,
    },
    entries,
    summary: buildSummary(entries),
  };
}

/**
 * Render the report as plain text.
 */
function renderText(report: StandupReport, options: FormatOptions): string {
  const lines: string[] = [];

  lines.push(`Standup Report — ${report.date}`);
  lines.push(`Author: ${options.author} | Period: ${options.since} → ${options.until}`);
  lines.push('');

  if (report.entries.length === 0) {
    lines.push('No commits found for the given period and author.');
  } else {
    lines.push('What I did:');
    for (const entry of report.entries) {
      lines.push(`  [${entry.type}] ${entry.message}`);
    }
    lines.push('');
    const branchList = report.summary.branches.join(', ');
    lines.push(`Summary: ${report.summary.totalCommits} commits across branches: ${branchList}`);
  }

  return lines.join('\n');
}

/**
 * Render the report as Markdown.
 */
function renderMarkdown(report: StandupReport, options: FormatOptions): string {
  const lines: string[] = [];

  lines.push(`## Standup Report — ${report.date}`);
  lines.push('');
  lines.push(`**Author:** ${options.author} | **Period:** ${options.since} → ${options.until}`);
  lines.push('');

  if (report.entries.length === 0) {
    lines.push('No commits found for the given period and author.');
  } else {
    lines.push('### What I did');
    lines.push('');
    for (const entry of report.entries) {
      lines.push(`- **${entry.type}**: ${entry.message}`);
    }
    lines.push('');
    const branchList = report.summary.branches.join(', ');
    lines.push(`> ${report.summary.totalCommits} commits across branches: ${branchList}`);
  }

  return lines.join('\n');
}

/**
 * Render the report as a JSON string.
 */
function renderJson(report: StandupReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Format grouped StandupEntry objects into a formatted string and a StandupReport.
 *
 * @param groups - Map of group key → StandupEntry[] produced by commitGrouper
 * @param options - Formatting options including format, author, since, until
 * @returns An object with `text` (the formatted string) and `report` (the structured StandupReport)
 */
export function formatReport(
  groups: Map<string, StandupEntry[]>,
  options: FormatOptions
): { text: string; report: StandupReport } {
  const date = formatDate(new Date());
  const entries = flattenEntries(groups);
  const report = buildReport(entries, options, date);

  let text: string;

  switch (options.format) {
    case 'text':
      text = renderText(report, options);
      break;
    case 'markdown':
      text = renderMarkdown(report, options);
      break;
    case 'json':
      text = renderJson(report);
      break;
    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = options.format;
      throw new Error(`Unknown format: ${String(_exhaustive)}`);
    }
  }

  return { text, report };
}
