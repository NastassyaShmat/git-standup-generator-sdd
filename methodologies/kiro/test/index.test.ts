// Unit tests for the CLI argument parser (parseArgs)
// Feature: git-standup-generator
import * as os from 'os';
import * as path from 'path';
import { parseArgs } from '../src/index';

const DEFAULT_HISTORY_FILE = path.join(os.homedir(), '.git-standup-history.json');

describe('parseArgs — default values', () => {
  it('returns since = "yesterday" when --since is omitted', () => {
    const result = parseArgs([]);
    expect(result.since).toBe('yesterday');
  });

  it('returns until = "now" when --until is omitted', () => {
    const result = parseArgs([]);
    expect(result.until).toBe('now');
  });

  it('returns groupBy = "type" when --group-by is omitted', () => {
    const result = parseArgs([]);
    expect(result.groupBy).toBe('type');
  });

  it('returns format = "text" when --format is omitted', () => {
    const result = parseArgs([]);
    expect(result.format).toBe('text');
  });

  it('returns excludePatterns = ["merge", "wip"] when --exclude is omitted', () => {
    const result = parseArgs([]);
    expect(result.excludePatterns).toEqual(['merge', 'wip']);
  });

  it('returns save = false when --save is omitted', () => {
    const result = parseArgs([]);
    expect(result.save).toBe(false);
  });

  it('returns outputPath = null when --output is omitted', () => {
    const result = parseArgs([]);
    expect(result.outputPath).toBeNull();
  });

  it('returns repo = process.cwd() when --repo is omitted', () => {
    const result = parseArgs([]);
    expect(result.repo).toBe(process.cwd());
  });

  it('returns the default history file path when --history-file is omitted', () => {
    const result = parseArgs([]);
    expect(result.historyFile).toBe(DEFAULT_HISTORY_FILE);
  });
});

describe('parseArgs — explicit flag values', () => {
  it('parses --since correctly', () => {
    const result = parseArgs(['--since', '2 days ago']);
    expect(result.since).toBe('2 days ago');
  });

  it('parses --until correctly', () => {
    const result = parseArgs(['--until', '2024-01-01']);
    expect(result.until).toBe('2024-01-01');
  });

  it('parses --repo correctly', () => {
    const result = parseArgs(['--repo', '/some/path']);
    expect(result.repo).toBe('/some/path');
  });

  it('parses --author correctly', () => {
    const result = parseArgs(['--author', 'Jane Doe']);
    expect(result.author).toBe('Jane Doe');
  });

  it('parses --output correctly', () => {
    const result = parseArgs(['--output', '/tmp/report.txt']);
    expect(result.outputPath).toBe('/tmp/report.txt');
  });

  it('parses --save flag (boolean, no value)', () => {
    const result = parseArgs(['--save']);
    expect(result.save).toBe(true);
  });

  it('parses --format markdown', () => {
    const result = parseArgs(['--format', 'markdown']);
    expect(result.format).toBe('markdown');
  });

  it('parses --format json', () => {
    const result = parseArgs(['--format', 'json']);
    expect(result.format).toBe('json');
  });

  it('parses --group-by branch', () => {
    const result = parseArgs(['--group-by', 'branch']);
    expect(result.groupBy).toBe('branch');
  });

  it('parses --group-by path', () => {
    const result = parseArgs(['--group-by', 'path']);
    expect(result.groupBy).toBe('path');
  });
});

describe('parseArgs — --exclude accumulation', () => {
  it('single --exclude replaces the default patterns entirely', () => {
    const result = parseArgs(['--exclude', 'foo']);
    expect(result.excludePatterns).toEqual(['foo']);
  });

  it('two --exclude flags accumulate into an array', () => {
    const result = parseArgs(['--exclude', 'foo', '--exclude', 'bar']);
    expect(result.excludePatterns).toEqual(['foo', 'bar']);
  });

  it('three --exclude flags accumulate in order', () => {
    const result = parseArgs(['--exclude', 'a', '--exclude', 'b', '--exclude', 'c']);
    expect(result.excludePatterns).toEqual(['a', 'b', 'c']);
  });

  it('--exclude does not include the default patterns when explicitly set', () => {
    const result = parseArgs(['--exclude', 'custom']);
    expect(result.excludePatterns).not.toContain('merge');
    expect(result.excludePatterns).not.toContain('wip');
  });
});

describe('parseArgs — --history-file override', () => {
  it('uses the provided path when --history-file is given', () => {
    const result = parseArgs(['--history-file', '/custom/path/history.json']);
    expect(result.historyFile).toBe('/custom/path/history.json');
  });

  it('expands leading ~ to the home directory', () => {
    const result = parseArgs(['--history-file', '~/my-history.json']);
    expect(result.historyFile).toBe(path.join(os.homedir(), 'my-history.json'));
  });

  it('does not use the default history file when --history-file is provided', () => {
    const result = parseArgs(['--history-file', '/custom/history.json']);
    expect(result.historyFile).not.toBe(DEFAULT_HISTORY_FILE);
  });
});

describe('parseArgs — error cases', () => {
  it('throws an Error for an unknown flag', () => {
    expect(() => parseArgs(['--unknown-flag'])).toThrow(Error);
  });

  it('error message for unknown flag mentions the flag name', () => {
    expect(() => parseArgs(['--unknown-flag'])).toThrow('--unknown-flag');
  });

  it('throws an Error for an invalid --format value', () => {
    expect(() => parseArgs(['--format', 'xml'])).toThrow(Error);
  });

  it('error message for invalid --format lists valid options', () => {
    expect(() => parseArgs(['--format', 'xml'])).toThrow(/text.*markdown.*json|markdown.*json.*text/i);
  });

  it('error message for invalid --format includes the bad value', () => {
    expect(() => parseArgs(['--format', 'xml'])).toThrow('xml');
  });

  it('throws an Error for an invalid --group-by value', () => {
    expect(() => parseArgs(['--group-by', 'author'])).toThrow(Error);
  });

  it('error message for invalid --group-by lists valid options', () => {
    expect(() => parseArgs(['--group-by', 'author'])).toThrow(/type.*branch.*path|branch.*path.*type/i);
  });

  it('error message for invalid --group-by includes the bad value', () => {
    expect(() => parseArgs(['--group-by', 'author'])).toThrow('author');
  });

  it('throws an Error for a positional argument (no -- prefix)', () => {
    expect(() => parseArgs(['somevalue'])).toThrow(Error);
  });
});
