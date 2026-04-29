import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createBackup, listBackups } from "@/core/save/backup";

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "the-memory-register-bk-"));
});

describe("backup", () => {
  it("copies file under backupsDir/<iso>/<relative>", async () => {
    const original = path.join(tmp, "sub", "CLAUDE.md");
    await fs.mkdir(path.dirname(original), { recursive: true });
    await fs.writeFile(original, "hello", "utf8");
    const backupsDir = path.join(tmp, "backups");
    const res = await createBackup({
      sourceFile: original,
      scopeRoot: tmp,
      backupsDir,
    });
    expect(res.backupPath.startsWith(backupsDir)).toBe(true);
    expect(await fs.readFile(res.backupPath, "utf8")).toBe("hello");
  });

  it("lists backups in chronological order", async () => {
    const original = path.join(tmp, "CLAUDE.md");
    await fs.writeFile(original, "v1", "utf8");
    const backupsDir = path.join(tmp, "backups");
    await createBackup({ sourceFile: original, scopeRoot: tmp, backupsDir });
    await new Promise((r) => setTimeout(r, 10));
    await fs.writeFile(original, "v2", "utf8");
    await createBackup({ sourceFile: original, scopeRoot: tmp, backupsDir });
    const list = await listBackups(backupsDir, original, tmp);
    expect(list.length).toBe(2);
  });
});
