import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { StandupReport } from './types';

/**
 * Resolves a leading `~` in `filePath` to the user's home directory.
 * Returns the path unchanged if it does not start with `~`.
 */
function resolvePath(filePath: string): string {
  return filePath.startsWith('~')
    ? path.join(os.homedir(), filePath.slice(1))
    : filePath;
}

/**
 * Appends `report` as a single JSON line to `historyFilePath` (NDJSON format).
 *
 * - Expands a leading `~` to the user's home directory (Requirement 5.7, 8.2).
 * - Creates the file if it does not yet exist (Requirement 5.6).
 * - Uses `fs.appendFileSync` so existing entries are never overwritten (Requirement 5.4).
 */
export function saveReport(report: StandupReport, historyFilePath: string): void {
  const resolvedPath = resolvePath(historyFilePath);
  fs.appendFileSync(resolvedPath, JSON.stringify(report) + '\n', 'utf8');
}

/**
 * Reads all saved `StandupReport` entries from `historyFilePath`.
 *
 * - Expands a leading `~` to the user's home directory (Requirement 5.7, 8.2).
 * - Returns an empty array when the file does not yet exist (Requirement 5.5).
 * - Parses each non-empty line as JSON; throws a descriptive error on parse
 *   failure that identifies the line number and raw content (Requirement 6.3).
 */
export function getReports(historyFilePath: string): StandupReport[] {
  const resolvedPath = resolvePath(historyFilePath);

  if (!fs.existsSync(resolvedPath)) {
    return [];
  }

  const raw = fs.readFileSync(resolvedPath, 'utf8');
  const lines = raw.split('\n').filter((line) => line.trim() !== '');

  const reports: StandupReport[] = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    try {
      reports.push(JSON.parse(line) as StandupReport);
    } catch {
      throw new Error(
        `Error: History file line ${lineNumber} contains invalid JSON: ${line}`
      );
    }
  });

  return reports;
}
