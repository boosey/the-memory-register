import fs from "node:fs/promises";
import { listBackups } from "./backup";

export interface UndoInput {
  sourceFile: string;
  scopeRoot: string;
  backupsDir: string;
}

export type UndoResult =
  | { ok: true; restoredFrom: string; newMtimeMs: number }
  | { ok: false; reason: "no-backup" | "io-error"; message?: string };

export async function restoreLastBackup(inp: UndoInput): Promise<UndoResult> {
  try {
    const list = await listBackups(
      inp.backupsDir,
      inp.sourceFile,
      inp.scopeRoot,
    );
    if (list.length === 0) return { ok: false, reason: "no-backup" };
    const last = list[list.length - 1]!;
    const content = await fs.readFile(last, "utf8");
    await fs.writeFile(inp.sourceFile, content, "utf8");
    const stat = await fs.stat(inp.sourceFile);
    return {
      ok: true,
      restoredFrom: last,
      newMtimeMs: stat.mtimeMs,
    };
  } catch (e) {
    return { ok: false, reason: "io-error", message: (e as Error).message };
  }
}
