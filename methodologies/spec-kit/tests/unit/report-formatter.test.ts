import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { formatReport } from "../../src/report-formatter.js";
import type { StandupEntry, StandupReport } from "../../src/types.js";
import type { ReportMeta } from "../../src/report-formatter.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<StandupEntry> = {}): StandupEntry {
  return {
    hash: "a1b2c3d",
    message: "add feature",
    type: "feat",
    branch: "main",
    timestamp: "2026-04-20T10:00:00+00:00",
    ...overrides,
  };
}

const DEFAULT_META: ReportMeta = {
  date: "2026-04-20",
  author: "alice@example.com",
  period: "yesterday → now",
  format: "text",
};

function makeGrouped(
  entries: Record<string, StandupEntry[]>,
): Map<string, StandupEntry[]> {
  return new Map(Object.entries(entries));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("formatReport()", () => {
  it("StandupReport has date, author, period, entries, summary fields", () => {
    const grouped = makeGrouped({ feat: [makeEntry()] });
    const { report } = formatReport(grouped, DEFAULT_META);

    assert.equal(report.date, "2026-04-20");
    assert.equal(report.author, "alice@example.com");
    assert.equal(report.period, "yesterday → now");
    assert.ok("entries" in report);
    assert.ok("summary" in report);
    assert.equal(typeof report.summary.commitCount, "number");
    assert.ok(Array.isArray(report.summary.branchesTouched));
    assert.ok(typeof report.summary.typeDistribution === "object");
  });

  it("entries in report match the grouped map keys and values", () => {
    const grouped = makeGrouped({
      feat: [makeEntry({ message: "add login" })],
      fix: [makeEntry({ hash: "0000001", message: "fix bug", type: "fix" })],
    });
    const { report } = formatReport(grouped, DEFAULT_META);

    assert.ok("feat" in report.entries);
    assert.ok("fix" in report.entries);
    assert.equal((report.entries["feat"] ?? []).length, 1);
  });

  it("summary.commitCount equals total entries", () => {
    const grouped = makeGrouped({
      feat: [makeEntry(), makeEntry()],
      fix: [makeEntry({ type: "fix" })],
    });
    const { report } = formatReport(grouped, DEFAULT_META);

    assert.equal(report.summary.commitCount, 3);
  });

  it("summary.typeDistribution only includes types present in entries", () => {
    const grouped = makeGrouped({
      feat: [makeEntry({ type: "feat" }), makeEntry({ type: "feat" })],
      fix: [makeEntry({ type: "fix" })],
    });
    const { report } = formatReport(grouped, DEFAULT_META);

    assert.equal(report.summary.typeDistribution["feat"], 2);
    assert.equal(report.summary.typeDistribution["fix"], 1);
    assert.ok(!("chore" in report.summary.typeDistribution));
  });

  it("summary.branchesTouched contains unique branch names from all entries", () => {
    const grouped = makeGrouped({
      feat: [
        makeEntry({ branch: "feature/auth" }),
        makeEntry({ branch: "feature/auth" }),
      ],
      fix: [makeEntry({ branch: "main", type: "fix" })],
    });
    const { report } = formatReport(grouped, DEFAULT_META);

    assert.equal(report.summary.branchesTouched.length, 2);
    assert.ok(report.summary.branchesTouched.includes("feature/auth"));
    assert.ok(report.summary.branchesTouched.includes("main"));
  });

  // -------------------------------------------------------------------------
  // format: "text"
  // -------------------------------------------------------------------------

  it('format "text" → starts with "What I did:\\n"', () => {
    const grouped = makeGrouped({ feat: [makeEntry()] });
    const { formatted } = formatReport(grouped, {
      ...DEFAULT_META,
      format: "text",
    });

    assert.ok(
      formatted.startsWith("What I did:\n"),
      `Got: ${formatted.slice(0, 50)}`,
    );
  });

  it('format "text" → contains "• <hash> <message>" entries', () => {
    const grouped = makeGrouped({
      feat: [makeEntry({ hash: "a1b2c3d", message: "add login feature" })],
    });
    const { formatted } = formatReport(grouped, {
      ...DEFAULT_META,
      format: "text",
    });

    assert.ok(
      formatted.includes("• a1b2c3d add login feature"),
      `Got:\n${formatted}`,
    );
  });

  it('format "text" → ends with footer "N commit(s) across M branch(es) | period"', () => {
    const grouped = makeGrouped({
      feat: [makeEntry({ branch: "main" }), makeEntry({ branch: "main" })],
    });
    const { formatted } = formatReport(grouped, {
      ...DEFAULT_META,
      format: "text",
    });

    assert.ok(
      formatted.includes("2 commit(s) across 1 branch(es) | yesterday → now"),
      `Got:\n${formatted}`,
    );
  });

  it('format "text" with zero entries → "No commits found for <author> in <period>."', () => {
    const { formatted } = formatReport(new Map(), DEFAULT_META);

    assert.equal(
      formatted,
      "No commits found for alice@example.com in yesterday → now.",
    );
    assert.ok(!formatted.includes("What I did"), "must not include header");
  });

  // -------------------------------------------------------------------------
  // format: "markdown"
  // -------------------------------------------------------------------------

  it('format "markdown" → starts with "## What I did"', () => {
    const grouped = makeGrouped({ feat: [makeEntry()] });
    const { formatted } = formatReport(grouped, {
      ...DEFAULT_META,
      format: "markdown",
    });

    assert.ok(
      formatted.startsWith("## What I did"),
      `Got: ${formatted.slice(0, 50)}`,
    );
  });

  it('format "markdown" → group labels as "### <label>"', () => {
    const grouped = makeGrouped({ feat: [makeEntry()] });
    const { formatted } = formatReport(grouped, {
      ...DEFAULT_META,
      format: "markdown",
    });

    assert.ok(formatted.includes("### feat"), `Got:\n${formatted}`);
  });

  it('format "markdown" → entries as "- **<hash>** <message>"', () => {
    const grouped = makeGrouped({
      feat: [makeEntry({ hash: "a1b2c3d", message: "add OAuth login" })],
    });
    const { formatted } = formatReport(grouped, {
      ...DEFAULT_META,
      format: "markdown",
    });

    assert.ok(
      formatted.includes("- **a1b2c3d** add OAuth login"),
      `Got:\n${formatted}`,
    );
  });

  it('format "markdown" with zero entries → "_No commits found for <author> in <period>._"', () => {
    const { formatted } = formatReport(new Map(), {
      ...DEFAULT_META,
      format: "markdown",
    });

    assert.equal(
      formatted,
      "_No commits found for alice@example.com in yesterday → now._",
    );
  });

  // -------------------------------------------------------------------------
  // format: "json"
  // -------------------------------------------------------------------------

  it('format "json" → JSON.parse(output) equals the StandupReport object', () => {
    const grouped = makeGrouped({
      feat: [
        makeEntry({
          hash: "a1b2c3d",
          message: "add feature",
          type: "feat",
          branch: "main",
        }),
      ],
    });
    const { report, formatted } = formatReport(grouped, {
      ...DEFAULT_META,
      format: "json",
    });

    const parsed = JSON.parse(formatted) as StandupReport;
    assert.deepEqual(parsed, report);
  });

  it('format "json" → JSON.stringify(report, null, 2) round-trips losslessly', () => {
    const grouped = makeGrouped({ feat: [makeEntry()] });
    const { report, formatted } = formatReport(grouped, {
      ...DEFAULT_META,
      format: "json",
    });

    assert.equal(formatted, JSON.stringify(report, null, 2));
  });
});
