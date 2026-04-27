// Unit tests for Output_Writer
// Validates: Requirements 5.1, 5.2, 5.3

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { writeOutput } from '../src/outputWriter';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a unique temp file path inside os.tmpdir() that does NOT yet exist.
 * The caller is responsible for cleaning it up.
 */
function tempFilePath(name: string): string {
  return path.join(os.tmpdir(), `outputWriter-test-${name}-${Date.now()}.txt`);
}

// ---------------------------------------------------------------------------
// Requirement 5.1 — stdout output when outputPath is null
// ---------------------------------------------------------------------------

describe('writeOutput — stdout (outputPath is null)', () => {
  it('calls process.stdout.write with content followed by a newline', () => {
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      writeOutput('hello', null);
      expect(spy).toHaveBeenCalledWith('hello\n');
    } finally {
      spy.mockRestore();
    }
  });

  it('calls process.stdout.write exactly once', () => {
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      writeOutput('test content', null);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('writes an empty string followed by a newline when content is empty', () => {
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      writeOutput('', null);
      expect(spy).toHaveBeenCalledWith('\n');
    } finally {
      spy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// Requirement 5.2 — file creation at a valid path
// ---------------------------------------------------------------------------

describe('writeOutput — file creation at a valid path', () => {
  it('creates the file when it does not yet exist', () => {
    const filePath = tempFilePath('create');
    try {
      writeOutput('file content', filePath);
      expect(fs.existsSync(filePath)).toBe(true);
    } finally {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  it('writes the exact content to the file', () => {
    const filePath = tempFilePath('content');
    const content = 'standup report line 1\nline 2\n';
    try {
      writeOutput(content, filePath);
      const written = fs.readFileSync(filePath, 'utf8');
      expect(written).toBe(content);
    } finally {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  it('overwrites an existing file with new content', () => {
    const filePath = tempFilePath('overwrite');
    fs.writeFileSync(filePath, 'old content', 'utf8');
    try {
      writeOutput('new content', filePath);
      const written = fs.readFileSync(filePath, 'utf8');
      expect(written).toBe('new content');
    } finally {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  it('does not call process.stdout.write when outputPath is provided', () => {
    const filePath = tempFilePath('no-stdout');
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      writeOutput('content', filePath);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });
});

// ---------------------------------------------------------------------------
// Requirement 5.3 — descriptive error when the target directory does not exist
// ---------------------------------------------------------------------------

describe('writeOutput — error when target directory does not exist', () => {
  it('throws an Error when the parent directory does not exist', () => {
    expect(() => {
      writeOutput('content', '/nonexistent/dir/file.txt');
    }).toThrow(Error);
  });

  it('error message contains "Output directory"', () => {
    expect(() => {
      writeOutput('content', '/nonexistent/dir/file.txt');
    }).toThrow(/Output directory/);
  });

  it('error message contains "does not exist"', () => {
    expect(() => {
      writeOutput('content', '/nonexistent/dir/file.txt');
    }).toThrow(/does not exist/);
  });

  it('error message includes the missing directory path', () => {
    expect(() => {
      writeOutput('content', '/nonexistent/dir/file.txt');
    }).toThrow('/nonexistent/dir');
  });
});

// ---------------------------------------------------------------------------
// Requirement 8.2 — tilde (~) expansion
// ---------------------------------------------------------------------------

describe('writeOutput — tilde expansion', () => {
  it('expands ~ and includes the expanded path in the error message for a non-existent subdirectory', () => {
    // Use a path under ~ that is guaranteed not to exist
    const fakePath = '~/nonexistent-standup-test-dir-xyz/file.txt';
    const expectedExpanded = path.join(os.homedir(), 'nonexistent-standup-test-dir-xyz');

    expect(() => {
      writeOutput('content', fakePath);
    }).toThrow(expectedExpanded);
  });

  it('error message does not contain the literal ~ character after expansion', () => {
    const fakePath = '~/nonexistent-standup-test-dir-xyz/file.txt';

    let thrownMessage = '';
    try {
      writeOutput('content', fakePath);
    } catch (err) {
      thrownMessage = (err as Error).message;
    }

    // The message should contain the expanded home dir, not the raw ~
    expect(thrownMessage).not.toContain('~');
    expect(thrownMessage).toContain(os.homedir());
  });
});
