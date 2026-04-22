import type { StandupEntry, StandupReport } from './types.js';

// ---------------------------------------------------------------------------
// ReportMeta — input metadata for formatReport
// ---------------------------------------------------------------------------

export interface ReportMeta {
  /** ISO 8601 date string (YYYY-MM-DD) for the report */
  date: string;
  /** Author display name or email */
  author: string;
  /** Human-readable time window description, e.g. "yesterday → now" */
  period: string;
  /** Desired output format */
  format: 'text' | 'markdown' | 'json';
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildReport(
  grouped: Map<string, StandupEntry[]>,
  meta: ReportMeta,
): StandupReport {
  const entries: Record<string, StandupEntry[]> = {};
  for (const [key, values] of grouped) {
    entries[key] = values;
  }

  const allEntries = [...grouped.values()].flat();
  const commitCount = allEntries.length;
  const branchesTouched = [...new Set(allEntries.map((e) => e.branch))];

  const typeDistribution: Record<string, number> = {};
  for (const entry of allEntries) {
    typeDistribution[entry.type] = (typeDistribution[entry.type] ?? 0) + 1;
  }

  return {
    date: meta.date,
    author: meta.author,
    period: meta.period,
    entries,
    summary: { commitCount, branchesTouched, typeDistribution },
  };
}

function renderText(report: StandupReport): string {
  const allEntries = Object.values(report.entries).flat();
  if (allEntries.length === 0) {
    return `No commits found for ${report.author} in ${report.period}.`;
  }

  const lines: string[] = ['What I did:', ''];

  for (const [label, entries] of Object.entries(report.entries)) {
    if (entries.length === 0) continue;
    lines.push(label);
    for (const entry of entries) {
      lines.push(`  • ${entry.hash} ${entry.message}`);
    }
    lines.push('');
  }

  const branchCount = report.summary.branchesTouched.length;
  lines.push('---');
  lines.push(
    `${report.summary.commitCount} commit(s) across ${branchCount} branch(es) | ${report.period}`,
  );

  return lines.join('\n');
}

function renderMarkdown(report: StandupReport): string {
  const allEntries = Object.values(report.entries).flat();
  if (allEntries.length === 0) {
    return `_No commits found for ${report.author} in ${report.period}._`;
  }

  const lines: string[] = ['## What I did', ''];

  for (const [label, entries] of Object.entries(report.entries)) {
    if (entries.length === 0) continue;
    lines.push(`### ${label}`);
    lines.push('');
    for (const entry of entries) {
      lines.push(`- **${entry.hash}** ${entry.message}`);
    }
    lines.push('');
  }

  const branchCount = report.summary.branchesTouched.length;
  lines.push('---');
  lines.push('');
  lines.push(
    `> ${report.summary.commitCount} commit(s) across ${branchCount} branch(es) | ${report.period}`,
  );

  return lines.join('\n');
}

function renderJson(report: StandupReport): string {
  return JSON.stringify(report, null, 2);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a `StandupReport` from grouped entries and render it to a string in
 * the requested format.
 */
export function formatReport(
  grouped: Map<string, StandupEntry[]>,
  meta: ReportMeta,
): { report: StandupReport; formatted: string } {
  const report = buildReport(grouped, meta);

  let formatted: string;
  switch (meta.format) {
    case 'text':
      formatted = renderText(report);
      break;
    case 'markdown':
      formatted = renderMarkdown(report);
      break;
    case 'json':
      formatted = renderJson(report);
      break;
  }

  return { report, formatted };
}
