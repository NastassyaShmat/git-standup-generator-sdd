import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Writes `content` to stdout (when `outputPath` is null) or to a file.
 *
 * File-path rules:
 *  - A leading `~` is expanded to the user's home directory.
 *  - The parent directory must already exist; if it does not, a descriptive
 *    error is thrown (Requirement 5.3).
 *  - The file is created if it does not yet exist (Requirement 5.2).
 */
export function writeOutput(content: string, outputPath: string | null): void {
  if (outputPath === null) {
    // Requirement 5.1 — write to standard output
    process.stdout.write(content + '\n');
    return;
  }

  // Requirement 8.2 — expand `~` using os.homedir() for cross-platform support
  const resolvedPath = outputPath.startsWith('~')
    ? path.join(os.homedir(), outputPath.slice(1))
    : outputPath;

  const parentDir = path.dirname(resolvedPath);

  // Requirement 5.3 — verify the parent directory exists
  if (!fs.existsSync(parentDir)) {
    throw new Error(`Error: Output directory '${parentDir}' does not exist.`);
  }

  // Requirement 5.2 — write (or create) the file
  fs.writeFileSync(resolvedPath, content, 'utf8');
}
