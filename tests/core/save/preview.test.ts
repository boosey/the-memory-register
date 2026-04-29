import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { previewDiff } from "@/core/save/preview";

let tmp: string;
let src: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "the-memory-register-pv-"));
  src = path.join(tmp, "CLAUDE.md");
  await fs.writeFile(src, "alpha\nbeta\n", "utf8");
});

describe("previewDiff", () => {
  it("returns before + after + hunks for a real change", async () => {
    const mtime = (await fs.stat(src)).mtimeMs;
    const res = await previewDiff({
      sourceFile: src,
      scopeRoot: tmp,
      nextContent: "alpha\ngamma\n",
      expectedMtimeMs: mtime,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.before).toBe("alpha\nbeta\n");
    expect(res.after).toBe("alpha\ngamma\n");
    expect(res.noop).toBe(false);
    expect(res.hunks.length).toBeGreaterThan(0);
    const h = res.hunks[0]!;
    expect(h.beforeLines).toContain("beta");
    expect(h.afterLines).toContain("gamma");
  });

  it("reports noop when content matches", async () => {
    const mtime = (await fs.stat(src)).mtimeMs;
    const res = await previewDiff({
      sourceFile: src,
      scopeRoot: tmp,
      nextContent: "alpha\nbeta\n",
      expectedMtimeMs: mtime,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.noop).toBe(true);
    expect(res.hunks.length).toBe(0);
  });

  it("refuses when mtime drifts", async () => {
    const res = await previewDiff({
      sourceFile: src,
      scopeRoot: tmp,
      nextContent: "whatever\n",
      expectedMtimeMs: 0,
    });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toBe("mtime-drift");
  });

  it("reports file-missing when the source is absent", async () => {
    const res = await previewDiff({
      sourceFile: path.join(tmp, "nope.md"),
      scopeRoot: tmp,
      nextContent: "anything\n",
      expectedMtimeMs: 0,
    });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toBe("file-missing");
  });

  it("does not write to disk", async () => {
    const before = await fs.readFile(src, "utf8");
    const mtime = (await fs.stat(src)).mtimeMs;
    await previewDiff({
      sourceFile: src,
      scopeRoot: tmp,
      nextContent: "totally different\n",
      expectedMtimeMs: mtime,
    });
    expect(await fs.readFile(src, "utf8")).toBe(before);
  });
});
