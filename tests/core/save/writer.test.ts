import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { applyEdit } from "@/core/save/writer";
import { restoreLastBackup } from "@/core/save/undo";

let tmp: string;
let src: string;
let backupsDir: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "memmgmt-w-"));
  src = path.join(tmp, "CLAUDE.md");
  await fs.writeFile(src, "old\n", "utf8");
  backupsDir = path.join(tmp, "backups");
});

describe("applyEdit", () => {
  it("backs up and writes new content", async () => {
    const mtime = (await fs.stat(src)).mtimeMs;
    const res = await applyEdit({
      sourceFile: src,
      scopeRoot: tmp,
      backupsDir,
      nextContent: "new\n",
      expectedMtimeMs: mtime,
    });
    expect(res.ok).toBe(true);
    expect(await fs.readFile(src, "utf8")).toBe("new\n");
  });

  it("refuses write when mtime mismatches", async () => {
    const res = await applyEdit({
      sourceFile: src,
      scopeRoot: tmp,
      backupsDir,
      nextContent: "new\n",
      expectedMtimeMs: 0,
    });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toBe("mtime-mismatch");
  });

  it("returns noop when next matches current", async () => {
    const mtime = (await fs.stat(src)).mtimeMs;
    const res = await applyEdit({
      sourceFile: src,
      scopeRoot: tmp,
      backupsDir,
      nextContent: "old\n",
      expectedMtimeMs: mtime,
    });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toBe("noop");
  });
});

describe("restoreLastBackup", () => {
  it("rolls back to previous contents", async () => {
    const mtime0 = (await fs.stat(src)).mtimeMs;
    await applyEdit({
      sourceFile: src,
      scopeRoot: tmp,
      backupsDir,
      nextContent: "new\n",
      expectedMtimeMs: mtime0,
    });
    const r = await restoreLastBackup({
      sourceFile: src,
      scopeRoot: tmp,
      backupsDir,
    });
    expect(r.ok).toBe(true);
    expect(await fs.readFile(src, "utf8")).toBe("old\n");
  });
});
