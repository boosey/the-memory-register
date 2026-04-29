import fs from "node:fs/promises";
import path from "node:path";
import { createBackup } from "./backup";
import { parseClaudeMd, serializeClaudeMd } from "../parsers/claudeMd";
import type { Entity } from "../entities";

export interface ResolveImportRequest {
  action: "remove" | "create" | "update";
  entityId: string;
  path: string; // the old/current path being resolved
  newPath?: string; // for 'update' action
}

export interface ResolveImportResponse {
  ok: boolean;
  message?: string;
}

export interface ResolveImportContext {
  backupsDir: string;
  knownEntities: Entity[];
}

export async function resolveBrokenImport(
  req: ResolveImportRequest,
  ctx: ResolveImportContext,
): Promise<ResolveImportResponse> {
  const entity = ctx.knownEntities.find((e) => e.id === req.entityId);
  if (!entity) {
    return { ok: false, message: `entity not found: ${req.entityId}` };
  }

  try {
    switch (req.action) {
      case "remove":
        return await handleRemove(entity, req.path, ctx);
      case "create":
        return await handleCreate(entity, req.path);
      case "update":
        return await handleUpdate(entity, req.path, req.newPath || "", ctx);
      default:
        return { ok: false, message: `unknown action: ${req.action}` };
    }
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

async function handleRemove(
  entity: Entity,
  targetPath: string,
  ctx: ResolveImportContext,
): Promise<ResolveImportResponse> {
  if (entity.type !== "standing-instruction") {
    return { ok: false, message: "only standing-instruction imports can be removed automatically" };
  }

  // Back up first
  await createBackup({
    sourceFile: entity.sourceFile,
    scopeRoot: entity.scopeRoot,
    backupsDir: ctx.backupsDir,
  });

  const sections = parseClaudeMd(entity.rawContent);
  const barePath = targetPath.startsWith("@") ? targetPath.slice(1) : targetPath;
  // Match @path followed by space, punctuation that terminates an import, or EOF.
  const pathRegex = new RegExp(`@${escapeRegExp(barePath)}(?=[\\s)<>]|$)`, "g");
  
  let modified = false;
  for (const s of sections) {
    const nextBody = s.body.replace(pathRegex, "");
    if (nextBody !== s.body) {
      s.body = nextBody;
      modified = true;
    }
  }

  if (!modified) {
    return { ok: false, message: "import reference not found in file body" };
  }

  await fs.writeFile(entity.sourceFile, serializeClaudeMd(sections), "utf8");
  return { ok: true };
}

async function handleCreate(
  entity: Entity,
  targetPath: string,
): Promise<ResolveImportResponse> {
  // Resolve the relative path to absolute
  const importerDir = path.dirname(entity.sourceFile);
  const barePath = targetPath.startsWith("@") ? targetPath.slice(1) : targetPath;
  const absPath = path.resolve(importerDir, barePath);

  try {
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, `# ${path.basename(absPath)}\n\nNew imported file.\n`, "utf8");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: `failed to create file: ${(e as Error).message}` };
  }
}

async function handleUpdate(
  entity: Entity,
  oldPath: string,
  newPath: string,
  ctx: ResolveImportContext,
): Promise<ResolveImportResponse> {
  if (entity.type !== "standing-instruction") {
    return { ok: false, message: "only standing-instruction imports can be updated automatically" };
  }

  if (!newPath) return { ok: false, message: "new path required" };

  await createBackup({
    sourceFile: entity.sourceFile,
    scopeRoot: entity.scopeRoot,
    backupsDir: ctx.backupsDir,
  });

  const sections = parseClaudeMd(entity.rawContent);
  const bareOld = oldPath.startsWith("@") ? oldPath.slice(1) : oldPath;
  const oldRegex = new RegExp(`@${escapeRegExp(bareOld)}(?=[\\s)<>]|$)`, "g");
  const replacement = newPath.startsWith("@") ? newPath : `@${newPath}`;

  let modified = false;
  for (const s of sections) {
    const nextBody = s.body.replace(oldRegex, replacement);
    if (nextBody !== s.body) {
      s.body = nextBody;
      modified = true;
    }
  }

  if (!modified) {
    return { ok: false, message: "import reference not found in file body" };
  }

  await fs.writeFile(entity.sourceFile, serializeClaudeMd(sections), "utf8");
  return { ok: true };
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
