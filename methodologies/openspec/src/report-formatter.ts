import type { OutputFormat, StandupReport } from './types.js';

function renderText(report: StandupReport): string {
  const allEntries = Object.values(report.entries).flat();

  if (allEntries.length === 0) {
    return `Standup Report — ${report.date}\n\nNo commits found.`;
  }

  const lines: string[] = [
    `Standup Report — ${report.date}`,
    '',
    'What I did:',
  ];

  for (const [type, entries] of Object.entries(report.entries)) {
    for (const entry of entries) {
      lines.push(`  • [${type}] ${entry.message}`);
    }
  }

  const branches = report.summary.branches;
  const branchList = branches.join(', ');
  const count = report.summary.total_commits;
  lines.push('');
  lines.push(`${count} commit${count !== 1 ? 's' : ''} across ${branches.length} branch${branches.length !== 1 ? 'es' : ''} (${branchList})`);

  return lines.join('\n');
}

function renderMarkdown(report: StandupReport): string {
  const allEntries = Object.values(report.entries).flat();

  if (allEntries.length === 0) {
    return `## Standup Report — ${report.date}\n\n_No commits found._`;
  }

  const lines: string[] = [
    `## Standup Report — ${report.date}`,
    '',
    '### What I did',
    '',
  ];

  for (const [type, entries] of Object.entries(report.entries)) {
    for (const entry of entries) {
      lines.push(`- **${type}:** ${entry.message}`);
    }
  }

  const branches = report.summary.branches;
  const count = report.summary.total_commits;
  lines.push('');
  lines.push(`> ${count} commit${count !== 1 ? 's' : ''} across ${branches.length} branch${branches.length !== 1 ? 'es' : ''} (${branches.join(', ')})`);

  return lines.join('\n');
}

function renderJson(report: StandupReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatReport(report: StandupReport, format: OutputFormat): string {
  switch (format) {
    case 'text':
      return renderText(report);
    case 'markdown':
      return renderMarkdown(report);
    case 'json':
      return renderJson(report);
  }
}

export function buildReport(
  date: string,
  author: string,
  period: { since: string; until: string },
  grouped: Record<string, import('./types.js').StandupEntry[]>,
): StandupReport {
  const allEntries = Object.values(grouped).flat();
  const branches = [...new Set(allEntries.map((e) => e.branch))];
  const types: Record<string, number> = {};
  for (const entry of allEntries) {
    types[entry.type] = (types[entry.type] ?? 0) + 1;
  }

  return {
    date,
    author,
    period,
    entries: grouped,
    summary: {
      total_commits: allEntries.length,
      branches,
      types,
    },
  };
}
