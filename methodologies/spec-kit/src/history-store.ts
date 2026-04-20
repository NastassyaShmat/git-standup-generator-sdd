import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';

import type { StandupReport } from './types.js';

// ---------------------------------------------------------------------------
// T028 — history-store: append standup reports to a persistent JSON history
// ---------------------------------------------------------------------------

export interface HistoryEntry extends StandupReport {
  savedAt: string;
}

/**
 * Appends `report` to the JSON array at `historyPath`.
 *
 * Behaviour:
 * - If the file (and its parent directories) do not exist, they are created.
 * - If the file exists and contains a valid JSON array, the new entry is appended.
 * - If the file contains invalid JSON, it is renamed to `<name>.bak.<timestamp>`
 *   and a fresh `[]` is written before appending.
 *
 * Returns a resolved Promise so callers may `await` it without type errors.
 */
export function appendToHistory(
  report: StandupReport,
  historyPath: string,
): Promise<void> {
  const dir = dirname(historyPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  let existing: HistoryEntry[] = [];

  if (existsSync(historyPath)) {
    const raw = readFileSync(historyPath, 'utf8');
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        existing = parsed as HistoryEntry[];
      }
    } catch {
      const backupPath = `${historyPath}.bak.${Date.now()}`;
      renameSync(historyPath, backupPath);
      existing = [];
    }
  }

  const entry: HistoryEntry = {
    ...report,
    savedAt: new Date().toISOString(),
  };

  existing.push(entry);
  writeFileSync(historyPath, JSON.stringify(existing, null, 2), 'utf8');

  return Promise.resolve();
}
