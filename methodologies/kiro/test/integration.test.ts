// Integration tests for the full git-standup-generator pipeline
// Tests run the complete Read → Filter → Group → Format → Write pipeline
// against a real git repository created in a temp directory.
//
// Validates: Requirements 1.1, 2.1, 4.1, 4.2, 4.3, 5.2, 5.6, 5.7

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { readCommits } from '../src/gitReader';
import { filterCommits } from '../src/commitFilter';
import { groupCommits } from '../src/commitGrouper';
import { formatReport } from '../src/reportFormatter';
import { writeOutput } from '../src/outputWriter';
import { saveReport, getReports } from '../src/historyStore';
import type { StandupReport } from '../src/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run a git command inside the given directory, throwing on failure.
 */
function git(cwd: string, ...args: string[]): string {
  return execSync(`git ${args.join(' ')}`, {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

/**
 * Recursively remove a directory (cross-platform, no external deps).
 */
function rmrf(dirPath: string): void {
  if (!fs.existsSync(dirPath)) return;
  fs.rmSync(dirPath, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Test repo setup
// ---------------------------------------------------------------------------

let repoDir: string;
let tempOutputDir: string;

beforeAll(() => {
  // Create a fresh temp directory for the git repo
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-standup-integration-'));
  tempOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-standup-output-'));

  // Initialise the repo
  git(repoDir, 'init');
  git(repoDir, 'config', 'user.email', '"test@example.com"');
  git(repoDir, 'config', 'user.name', '"Test User"');

  // Commit 1: feat — should appear in output
  git(repoDir, 'commit', '--allow-empty', '-m', '"feat: add login feature"');

  // Determine the default branch name after the first commit (main or master)
  const defaultBranch = git(repoDir, 'rev-parse', '--abbrev-ref', 'HEAD').trim();

  // Commit 2: fix — should appear in output
  git(repoDir, 'commit', '--allow-empty', '-m', '"fix: resolve null pointer"');

  // Commit 3: WIP — should be filtered out by default exclude patterns
  git(repoDir, 'commit', '--allow-empty', '-m', '"WIP: work in progress"');

  // Commit 4: merge commit — create a branch, commit on it, then merge with --no-ff
  git(repoDir, 'checkout', '-b', 'feature-branch');
  git(repoDir, 'commit', '--allow-empty', '-m', '"feat: feature branch commit"');
  git(repoDir, 'checkout', defaultBranch);
  git(repoDir, 'merge', 'feature-branch', '--no-ff', '-m', '"Merge branch feature-branch"');
});

afterAll(() => {
  rmrf(repoDir);
  rmrf(tempOutputDir);
});

// ---------------------------------------------------------------------------
// Pipeline helper: run the full pipeline and return text + report
// ---------------------------------------------------------------------------

interface PipelineOptions {
  format?: 'text' | 'markdown' | 'json';
  groupBy?: 'type' | 'branch' | 'path';
  excludePatterns?: string[];
  outputPath?: string | null;
  save?: boolean;
  historyFile?: string;
}

function runPipeline(opts: PipelineOptions = {}): { text: string; report: StandupReport } {
  const {
    format = 'text',
    groupBy = 'type',
    excludePatterns = ['merge', 'wip'],
    outputPath = null,
    save = false,
    historyFile,
  } = opts;

  // Step 1: Read commits — use "1 year ago" to capture all test commits
  const commits = readCommits({
    repo: repoDir,
    since: '1 year ago',
    until: 'now',
    author: 'Test User',
  });

  // Step 2: Filter
  const filtered = filterCommits(commits, excludePatterns);

  // Step 3: Group
  const groups = groupCommits(filtered, groupBy, repoDir);

  // Step 4: Format
  const { text, report } = formatReport(groups, {
    format,
    author: 'Test User',
    since: '1 year ago',
    until: 'now',
  });

  // Step 5: Write output
  writeOutput(text, outputPath);

  // Step 6: Optionally save to history
  if (save && historyFile) {
    saveReport(report, historyFile);
  }

  return { text, report };
}

// ---------------------------------------------------------------------------
// Test 1: Text format
// Validates: Requirements 1.1, 2.1, 4.1
// ---------------------------------------------------------------------------

describe('Integration — text format', () => {
  it('output contains "What I did" section', () => {
    const { text } = runPipeline({ format: 'text' });
    expect(text).toContain('What I did');
  });

  it('output contains the feat commit', () => {
    const { text } = runPipeline({ format: 'text' });
    expect(text).toContain('feat');
  });

  it('output contains the fix commit', () => {
    const { text } = runPipeline({ format: 'text' });
    expect(text).toContain('fix');
  });

  it('output does NOT contain WIP commit (filtered out)', () => {
    const { text } = runPipeline({ format: 'text' });
    expect(text).not.toContain('WIP: work in progress');
  });

  it('output does NOT contain merge commit (filtered out)', () => {
    const { text } = runPipeline({ format: 'text' });
    expect(text).not.toContain('Merge branch feature-branch');
  });

  it('report has exactly 3 entries (feat on main, fix, feat on feature-branch — WIP and merge filtered)', () => {
    const { report } = runPipeline({ format: 'text' });
    // feat: add login feature, fix: resolve null pointer, feat: feature branch commit
    // WIP and merge commit are filtered out
    expect(report.summary.totalCommits).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Test 2: Markdown format
// Validates: Requirements 1.1, 2.1, 4.2
// ---------------------------------------------------------------------------

describe('Integration — markdown format', () => {
  it('output contains level-2 "Standup Report" heading', () => {
    const { text } = runPipeline({ format: 'markdown' });
    expect(text).toContain('## Standup Report');
  });

  it('output contains level-3 "What I did" heading', () => {
    const { text } = runPipeline({ format: 'markdown' });
    expect(text).toContain('### What I did');
  });

  it('output contains bold feat entry', () => {
    const { text } = runPipeline({ format: 'markdown' });
    expect(text).toContain('**feat**');
  });

  it('output contains bold fix entry', () => {
    const { text } = runPipeline({ format: 'markdown' });
    expect(text).toContain('**fix**');
  });

  it('output does NOT contain WIP commit (filtered out)', () => {
    const { text } = runPipeline({ format: 'markdown' });
    expect(text).not.toContain('WIP: work in progress');
  });

  it('output does NOT contain merge commit (filtered out)', () => {
    const { text } = runPipeline({ format: 'markdown' });
    expect(text).not.toContain('Merge branch feature-branch');
  });
});

// ---------------------------------------------------------------------------
// Test 3: JSON format
// Validates: Requirements 1.1, 2.1, 4.3
// ---------------------------------------------------------------------------

describe('Integration — JSON format', () => {
  it('output is valid JSON', () => {
    const { text } = runPipeline({ format: 'json' });
    expect(() => JSON.parse(text)).not.toThrow();
  });

  it('parsed JSON has an "entries" array', () => {
    const { text } = runPipeline({ format: 'json' });
    const parsed = JSON.parse(text) as StandupReport;
    expect(Array.isArray(parsed.entries)).toBe(true);
  });

  it('parsed JSON summary.totalCommits equals 3 (feat + fix + feat on branch, WIP and merge filtered)', () => {
    const { text } = runPipeline({ format: 'json' });
    const parsed = JSON.parse(text) as StandupReport;
    expect(parsed.summary.totalCommits).toBe(3);
  });

  it('parsed JSON does not include WIP commit', () => {
    const { text } = runPipeline({ format: 'json' });
    const parsed = JSON.parse(text) as StandupReport;
    const messages = parsed.entries.map((e) => e.message);
    expect(messages).not.toContain('WIP: work in progress');
  });

  it('parsed JSON does not include merge commit', () => {
    const { text } = runPipeline({ format: 'json' });
    const parsed = JSON.parse(text) as StandupReport;
    const messages = parsed.entries.map((e) => e.message);
    expect(messages.some((m) => m.toLowerCase().includes('merge branch'))).toBe(false);
  });

  it('parsed JSON has required top-level fields', () => {
    const { text } = runPipeline({ format: 'json' });
    const parsed = JSON.parse(text) as StandupReport;
    expect(parsed).toHaveProperty('date');
    expect(parsed).toHaveProperty('author');
    expect(parsed).toHaveProperty('period');
    expect(parsed).toHaveProperty('entries');
    expect(parsed).toHaveProperty('summary');
  });

  it('parsed JSON summary has totalCommits, branches, and types fields', () => {
    const { text } = runPipeline({ format: 'json' });
    const parsed = JSON.parse(text) as StandupReport;
    expect(parsed.summary).toHaveProperty('totalCommits');
    expect(parsed.summary).toHaveProperty('branches');
    expect(parsed.summary).toHaveProperty('types');
  });
});

// ---------------------------------------------------------------------------
// Test 4: File output
// Validates: Requirement 5.2
// ---------------------------------------------------------------------------

describe('Integration — file output', () => {
  it('creates the output file when outputPath is provided', () => {
    const outputFile = path.join(tempOutputDir, 'report.txt');
    runPipeline({ format: 'text', outputPath: outputFile });
    expect(fs.existsSync(outputFile)).toBe(true);
  });

  it('written file contains the report content', () => {
    const outputFile = path.join(tempOutputDir, 'report-content.txt');
    runPipeline({ format: 'text', outputPath: outputFile });
    const contents = fs.readFileSync(outputFile, 'utf8');
    expect(contents).toContain('What I did');
    expect(contents).toContain('feat');
    expect(contents).toContain('fix');
  });

  it('written markdown file contains markdown headings', () => {
    const outputFile = path.join(tempOutputDir, 'report.md');
    runPipeline({ format: 'markdown', outputPath: outputFile });
    const contents = fs.readFileSync(outputFile, 'utf8');
    expect(contents).toContain('## Standup Report');
    expect(contents).toContain('### What I did');
  });

  it('written JSON file is valid JSON', () => {
    const outputFile = path.join(tempOutputDir, 'report.json');
    runPipeline({ format: 'json', outputPath: outputFile });
    const contents = fs.readFileSync(outputFile, 'utf8');
    expect(() => JSON.parse(contents)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Test 5: History file creation when it does not yet exist
// Validates: Requirements 5.6
// ---------------------------------------------------------------------------

describe('Integration — history file creation', () => {
  it('creates the history file when it does not yet exist', () => {
    const historyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-standup-history-'));
    const historyFile = path.join(historyDir, 'history.json');

    try {
      expect(fs.existsSync(historyFile)).toBe(false);
      runPipeline({ save: true, historyFile });
      expect(fs.existsSync(historyFile)).toBe(true);
    } finally {
      rmrf(historyDir);
    }
  });

  it('history file contains the report after saving', () => {
    const historyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-standup-history-'));
    const historyFile = path.join(historyDir, 'history.json');

    try {
      runPipeline({ save: true, historyFile });
      const reports = getReports(historyFile);
      expect(reports).toHaveLength(1);
      expect(reports[0].author).toBe('Test User');
    } finally {
      rmrf(historyDir);
    }
  });

  it('history file contains valid report data with correct commit count', () => {
    const historyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-standup-history-'));
    const historyFile = path.join(historyDir, 'history.json');

    try {
      runPipeline({ save: true, historyFile });
      const reports = getReports(historyFile);
      expect(reports[0].summary.totalCommits).toBe(3);
    } finally {
      rmrf(historyDir);
    }
  });

  it('appends multiple reports without overwriting', () => {
    const historyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-standup-history-'));
    const historyFile = path.join(historyDir, 'history.json');

    try {
      runPipeline({ save: true, historyFile });
      runPipeline({ save: true, historyFile });
      const reports = getReports(historyFile);
      expect(reports).toHaveLength(2);
    } finally {
      rmrf(historyDir);
    }
  });
});

// ---------------------------------------------------------------------------
// Test 6: Custom --history-file path is respected end-to-end
// Validates: Requirement 5.7
// ---------------------------------------------------------------------------

describe('Integration — custom history file path', () => {
  it('uses the custom path instead of the default', () => {
    const customDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-standup-custom-'));
    const customHistoryFile = path.join(customDir, 'custom-history.json');
    const defaultHistoryFile = path.join(os.homedir(), '.git-standup-history.json');

    try {
      runPipeline({ save: true, historyFile: customHistoryFile });

      // Custom path should have the report
      expect(fs.existsSync(customHistoryFile)).toBe(true);
      const reports = getReports(customHistoryFile);
      expect(reports).toHaveLength(1);

      // Default path should NOT have been written to (unless it already existed)
      // We verify the custom file has our report with the correct author
      expect(reports[0].author).toBe('Test User');
    } finally {
      rmrf(customDir);
      // Do not touch the default history file — it may belong to the user
      void defaultHistoryFile;
    }
  });

  it('custom history file contains the full report structure', () => {
    const customDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-standup-custom-'));
    const customHistoryFile = path.join(customDir, 'my-standup.json');

    try {
      runPipeline({ save: true, historyFile: customHistoryFile });
      const reports = getReports(customHistoryFile);

      expect(reports[0]).toHaveProperty('date');
      expect(reports[0]).toHaveProperty('author', 'Test User');
      expect(reports[0]).toHaveProperty('period');
      expect(reports[0]).toHaveProperty('entries');
      expect(reports[0]).toHaveProperty('summary');
    } finally {
      rmrf(customDir);
    }
  });
});
