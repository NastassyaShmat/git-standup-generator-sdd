import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";
import { promisify } from "node:util";
import { run } from "../../src/cli.js";

const execFileAsync = promisify(execFile);

async function setupGitRepo(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await execFileAsync("git", ["init"], { cwd: dir });
  await execFileAsync("git", ["config", "user.email", "test@example.com"], {
    cwd: dir,
  });
  await execFileAsync("git", ["config", "user.name", "Test User"], {
    cwd: dir,
  });

  const commits = [
    { file: "src/auth.ts", msg: "feat: add authentication module" },
    { file: "src/db.ts", msg: "fix: resolve database timeout issue" },
    { file: "docs/api.md", msg: "docs: update API documentation" },
    { file: "README.md", msg: "chore: refresh readme" },
  ];

  for (const { file, msg } of commits) {
    const parts = file.split("/");
    if (parts.length > 1) {
      await mkdir(join(dir, ...parts.slice(0, -1)), { recursive: true });
    }
    await writeFile(join(dir, file), `// ${msg}\n`, "utf8");
    await execFileAsync("git", ["add", file], { cwd: dir });
    await execFileAsync(
      "git",
      ["commit", "-m", msg, "--date", "2026-04-21T10:00:00+00:00"],
      { cwd: dir },
    );
  }
}

describe("Integration: run() against real git repo", () => {
  let repoDir: string;

  before(async () => {
    repoDir = join(tmpdir(), `git-standup-integration-${Date.now()}`);
    await setupGitRepo(repoDir);
  });

  after(async () => {
    await rm(repoDir, { recursive: true, force: true });
  });

  it("8.1 default flags → text report with well-formed output", async () => {
    const outFile = join(tmpdir(), `standup-test-text-${Date.now()}.txt`);
    const code = await run([
      "--repo",
      repoDir,
      "--author",
      "test@example.com",
      "--since",
      "2 days ago",
      "--format",
      "text",
      "--output",
      outFile,
    ]);

    assert.equal(code, 0);
    const content = await readFile(outFile, "utf8");
    assert.ok(
      content.includes("Standup Report —"),
      `Expected report header; got:\n${content}`,
    );
    assert.ok(
      content.includes("What I did:"),
      `Expected "What I did:"; got:\n${content}`,
    );
    assert.ok(
      content.includes("commits"),
      `Expected summary line; got:\n${content}`,
    );
    await rm(outFile, { force: true });
  });

  it("8.2 --format markdown → markdown report with ## heading", async () => {
    const outFile = join(tmpdir(), `standup-test-md-${Date.now()}.md`);
    const code = await run([
      "--repo",
      repoDir,
      "--author",
      "test@example.com",
      "--since",
      "2 days ago",
      "--format",
      "markdown",
      "--output",
      outFile,
    ]);

    assert.equal(code, 0);
    const content = await readFile(outFile, "utf8");
    assert.ok(
      content.startsWith("## Standup Report —"),
      `Expected ## heading; got:\n${content}`,
    );
    assert.ok(content.includes("### What I did"));
    assert.ok(content.includes("> "), "Expected blockquote summary");
    await rm(outFile, { force: true });
  });

  it("8.2 --format json → valid JSON with expected fields", async () => {
    const outFile = join(tmpdir(), `standup-test-json-${Date.now()}.json`);
    const code = await run([
      "--repo",
      repoDir,
      "--author",
      "test@example.com",
      "--since",
      "2 days ago",
      "--format",
      "json",
      "--output",
      outFile,
    ]);

    assert.equal(code, 0);
    const content = await readFile(outFile, "utf8");
    const parsed = JSON.parse(content) as {
      date: string;
      author: string;
      period: object;
      entries: object;
      summary: object;
    };
    assert.ok(parsed.date, "Expected date field");
    assert.ok(parsed.author, "Expected author field");
    assert.ok(parsed.period, "Expected period field");
    assert.ok(parsed.entries, "Expected entries field");
    assert.ok(parsed.summary, "Expected summary field");
    await rm(outFile, { force: true });
  });

  it("8.2 --group-by branch → report grouped by branch", async () => {
    const outFile = join(tmpdir(), `standup-test-branch-${Date.now()}.txt`);
    const code = await run([
      "--repo",
      repoDir,
      "--author",
      "test@example.com",
      "--since",
      "2 days ago",
      "--format",
      "text",
      "--group-by",
      "branch",
      "--output",
      outFile,
    ]);

    assert.equal(code, 0);
    const content = await readFile(outFile, "utf8");
    assert.ok(content.includes("Standup Report —"));
    await rm(outFile, { force: true });
  });

  it("8.4 --save writes to history.json and listReports reads it back", async () => {
    const fakeHome = join(tmpdir(), `git-standup-save-test-${Date.now()}`);
    await mkdir(fakeHome, { recursive: true });
    const origHome = process.env["HOME"];
    process.env["HOME"] = fakeHome;

    const outFile = join(fakeHome, "report.txt");
    try {
      const code = await run([
        "--repo",
        repoDir,
        "--author",
        "test@example.com",
        "--since",
        "2 days ago",
        "--save",
        "--output",
        outFile,
      ]);

      assert.equal(code, 0);

      const { listReports } = await import("../../src/history-store.js");
      const reports = await listReports();
      assert.ok(reports.length >= 1, "Expected at least one saved report");
    } finally {
      if (origHome !== undefined) process.env["HOME"] = origHome;
      await rm(fakeHome, { recursive: true, force: true });
    }
  });
});

describe("Integration: performance benchmark", () => {
  const SKIP_BENCHMARK = process.env["SKIP_BENCHMARK"] === "1";

  it(
    "8.3 benchmark: 10,000 commits processed in < 2s",
    { skip: SKIP_BENCHMARK ? "SKIP_BENCHMARK=1" : undefined },
    async () => {
      const benchDir = join(tmpdir(), `git-standup-bench-${Date.now()}`);

      try {
        await mkdir(benchDir, { recursive: true });
        await execFileAsync("git", ["init"], { cwd: benchDir });
        await execFileAsync(
          "git",
          ["config", "user.email", "bench@example.com"],
          { cwd: benchDir },
        );
        await execFileAsync("git", ["config", "user.name", "Bench User"], {
          cwd: benchDir,
        });

        // Seed 10,000 commits using git fast-import via a temp file to avoid EPIPE
        const baseDate = Math.floor(Date.now() / 1000) - 365 * 24 * 3600; // ~1 year ago
        const fastImportFile = join(tmpdir(), `fast-import-${Date.now()}.txt`);

        const lineChunks: string[] = [];
        for (let i = 0; i < 10000; i++) {
          const commitDate = baseDate + i;
          const msg = `feat: bench commit ${i}`;
          lineChunks.push(`commit refs/heads/main\n`);
          lineChunks.push(`mark :${i + 1}\n`);
          lineChunks.push(
            `committer Bench User <bench@example.com> ${commitDate} +0000\n`,
          );
          lineChunks.push(`data ${msg.length}\n`);
          lineChunks.push(`${msg}\n`);
          if (i > 0) lineChunks.push(`from :${i}\n`);
          if (i === 0) {
            lineChunks.push(`M 100644 inline bench.txt\n`);
            lineChunks.push(`data 6\nhello\n\n`);
          }
          lineChunks.push("\n");
        }

        await writeFile(fastImportFile, lineChunks.join(""), "utf8");

        await new Promise<void>((resolve, reject) => {
          const child = spawn("git", ["fast-import", "--quiet"], {
            cwd: benchDir,
            stdio: ["pipe", "pipe", "pipe"],
          });
          let stderr = "";
          child.stderr?.on("data", (d: Buffer) => {
            stderr += d.toString();
          });
          createReadStream(fastImportFile).pipe(child.stdin);
          child.on("close", (code) => {
            if (code === 0) resolve();
            else
              reject(
                new Error(
                  `git fast-import exited with code ${code}: ${stderr}`,
                ),
              );
          });
          child.on("error", reject);
        });

        await rm(fastImportFile, { force: true });
        await execFileAsync("git", ["checkout", "main"], { cwd: benchDir });

        const outFile = join(tmpdir(), `bench-report-${Date.now()}.txt`);
        const start = Date.now();
        const code = await run([
          "--repo",
          benchDir,
          "--author",
          "bench@example.com",
          "--since",
          "2 years ago",
          "--output",
          outFile,
        ]);
        const elapsed = Date.now() - start;

        assert.equal(code, 0);
        assert.ok(elapsed < 2000, `Expected < 2s; got ${elapsed}ms`);
        await rm(outFile, { force: true });
      } finally {
        await rm(benchDir, { recursive: true, force: true }).catch(() => {});
      }
    },
  );
});
