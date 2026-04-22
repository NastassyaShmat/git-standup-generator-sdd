import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { StandupReport } from './types.js';

function historyPath(): string {
  return join(homedir(), '.git-standup', 'history.json');
}

function historyDir(): string {
  return join(homedir(), '.git-standup');
}

async function readHistory(filePath: string): Promise<StandupReport[]> {
  try {
    const content = await readFile(filePath, 'utf8');
    const parsed: unknown = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed as StandupReport[];
    return [];
  } catch {
    return [];
  }
}

export async function appendReport(report: StandupReport): Promise<void> {
  const dir = historyDir();
  const file = historyPath();
  const tmp = file + '.tmp';

  await mkdir(dir, { recursive: true });

  const existing = await readHistory(file);
  existing.push(report);

  await writeFile(tmp, JSON.stringify(existing, null, 2), 'utf8');
  await rename(tmp, file);
}

export async function listReports(): Promise<StandupReport[]> {
  return readHistory(historyPath());
}

export async function findByDate(date: string): Promise<StandupReport | undefined> {
  const reports = await listReports();
  return reports.find((r) => r.date === date);
}
