import fs from "node:fs/promises";
import { createBackup } from "./backup";
import { computeDiff, type DiffResult } from "./diff";

export interface ApplyEditInput {
  sourceFile: string;
  scopeRoot: string;
  backupsDir: string;
  nextContent: string;
  expectedMtimeMs: number;
}

export type ApplyEditResult =
  | {
      ok: true;
      diff: DiffResult;
      backupPath: string;
      newMtimeMs: number;
    }
  | {
      ok: false;
      reason: "mtime-mismatch" | "noop" | "io-error";
      message?: string;
    };

const MTIME_TOLERANCE_MS = 1;

export async function applyEdit(
  inp: ApplyEditInput,
): Promise<ApplyEditResult> {
  try {
    const stat = await fs.stat(inp.sourceFile);
    if (Math.abs(stat.mtimeMs - inp.expectedMtimeMs) > MTIME_TOLERANCE_MS) {
      return { ok: false, reason: "mtime-mismatch" };
    }
    const before = await fs.readFile(inp.sourceFile, "utf8");
    if (before === inp.nextContent) return { ok: false, reason: "noop" };
    const backup = await createBackup({
      sourceFile: inp.sourceFile,
      scopeRoot: inp.scopeRoot,
      backupsDir: inp.backupsDir,
    });
    await fs.writeFile(inp.sourceFile, inp.nextContent, "utf8");
    const newStat = await fs.stat(inp.sourceFile);
    return {
      ok: true,
      diff: computeDiff(before, inp.nextContent),
      backupPath: backup.backupPath,
      newMtimeMs: newStat.mtimeMs,
    };
  } catch (e) {
    return { ok: false, reason: "io-error", message: (e as Error).message };
  }
}
