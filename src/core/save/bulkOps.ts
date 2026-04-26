import fs from "node:fs/promises";
import path from "node:path";
import { createBackup } from "./backup";
import type { Entity, Scope } from "../entities";
import { SCOPE_PRECEDENCE } from "../entities";
import {
  scopeAbove,
  scopeBelow,
  type BulkAffected,
  type BulkRequest,
  type BulkResponse,
} from "../apiContracts";
import { parseClaudeMd, serializeClaudeMd } from "../parsers/claudeMd";
import { parseSettings, serializeSettings } from "../parsers/settings";

export interface BulkContext {
  /** Root for persistent backups. */
  backupsDir: string;
  /** Snapshot of current entities; used for identity-group lookups + scope math. */
  knownEntities: Entity[];
  /** Resolved Claude home (~/.claude). Used to locate memmgmt-state.json. */
  claudeHome: string;
}

// ── Public dispatcher ──────────────────────────────────────────────────────

export async function dispatchBulk(
  req: BulkRequest,
  ctx: BulkContext,
): Promise<BulkResponse> {
  try {
    switch (req.action) {
      case "resolve-to-winner":
      case "delete-shadowed":
        return await runDeleteShadowed(req, ctx);
      case "promote-scope":
        return await runScopeMove(req, ctx, "up");
      case "demote-scope":
        return await runScopeMove(req, ctx, "down");
      case "dismiss-stale":
        return await runMarker(req, ctx, "dismissedStale");
      case "flag-for-review":
        return await runMarker(req, ctx, "flaggedForReview");
      case "keep-as-override":
        return await runMarker(req, ctx, "keptAsOverride");
      case "merge-into-winner":
        return await runMergeIntoWinner(req, ctx);
      case "delete-entity":
        if (req.confirm !== true) {
          return {
            ok: false,
            action: req.action,
            reason: "confirmation-required",
            message: "confirm:true required for delete-entity",
          };
        }
        return await runDeleteEntity(req, ctx);
    }
  } catch (e) {
    return {
      ok: false,
      action: req.action,
      reason: "internal",
      message: (e as Error).message,
    };
  }
}

// ── resolve-to-winner / delete-shadowed ────────────────────────────────────
// Shared implementation. Both actions keep the highest-precedence scope copy
// of each identity group; neither touches identities that aren't contested.

async function runDeleteShadowed(
  req: BulkRequest,
  ctx: BulkContext,
): Promise<BulkResponse> {
  const affected: BulkAffected[] = [];
  const processedGroups = new Set<string>();

  for (const id of req.entityIds) {
    const entity = ctx.knownEntities.find((e) => e.id === id);
    if (!entity) {
      return {
        ok: false,
        action: req.action,
        reason: "entity-missing",
        message: `entity not found: ${id}`,
        partiallyAffected: affected,
      };
    }

    const groupKey = entity.identity || `id:${entity.id}`;
    if (processedGroups.has(groupKey)) continue;
    processedGroups.add(groupKey);

    const group = groupByIdentity(entity, ctx.knownEntities);
    if (group.length < 2) continue; // not contested → no-op

    // BUG FIX: If we are resolving to a SPECIFIC winner (e.g. from the Conflict Resolver UI),
    // we should keep that copy. If multiple copies from the same group are selected
    // (e.g. from BulkActionBar), or if the action is delete-shadowed, we fall back 
    // to the natural winner.
    const selectedInGroup = group.filter((g) => req.entityIds.includes(g.id));
    const winner =
      (req.action === "resolve-to-winner" && selectedInGroup.length === 1)
        ? selectedInGroup[0]!
        : pickWinner(group);

    for (const copy of group) {
      if (copy.id === winner.id) continue;
      const res = await deleteFileEntity(copy, ctx);
      if (!res.ok) {
        return {
          ok: false,
          action: req.action,
          reason: res.reason,
          message: res.message,
          partiallyAffected: affected,
        };
      }
      affected.push(res.affected);
    }
  }
  return { ok: true, action: req.action, affected };
}

function groupByIdentity(entity: Entity, all: Entity[]): Entity[] {
  if (!entity.identity) return [entity];
  return all.filter((e) => e.identity === entity.identity);
}

function pickWinner(group: Entity[]): Entity {
  return [...group].sort(
    (a, b) => SCOPE_PRECEDENCE[b.scope] - SCOPE_PRECEDENCE[a.scope],
  )[0]!;
}

// ── merge-into-winner ──────────────────────────────────────────────────────
// Appends the content of the selected copies into their group's winner copy,
// then deletes the source copies.

async function runMergeIntoWinner(
  req: BulkRequest,
  ctx: BulkContext,
): Promise<BulkResponse> {
  const affected: BulkAffected[] = [];
  const processedGroups = new Set<string>();

  for (const id of req.entityIds) {
    const entity = ctx.knownEntities.find((e) => e.id === id);
    if (!entity) {
      return {
        ok: false,
        action: req.action,
        reason: "entity-missing",
        message: `entity not found: ${id}`,
        partiallyAffected: affected,
      };
    }

    const groupKey = entity.identity || `id:${entity.id}`;
    if (processedGroups.has(groupKey)) continue;
    processedGroups.add(groupKey);

    const group = groupByIdentity(entity, ctx.knownEntities);
    if (group.length < 2) continue;

    const winner = pickWinner(group);
    const losers = group.filter((g) => g.id !== winner.id);
    const toMerge = losers.filter((g) => req.entityIds.includes(g.id));

    if (toMerge.length === 0) continue;

    // We only support merging for markdown-backed file entities in v1.8.
    const canMerge = (e: Entity) =>
      e.type === "skill" ||
      e.type === "command" ||
      e.type === "agent" ||
      e.type === "memory" ||
      e.type === "standing-instruction";

    if (!canMerge(winner)) {
      return {
        ok: false,
        action: req.action,
        reason: "action-not-applicable",
        message: `merging into ${winner.type} is not supported`,
        partiallyAffected: affected,
      };
    }

    // Read winner content
    let winnerContent: string;
    try {
      winnerContent = await fs.readFile(winner.sourceFile, "utf8");
    } catch (e) {
      return {
        ok: false,
        action: req.action,
        reason: "internal",
        message: `failed to read winner file: ${(e as Error).message}`,
        partiallyAffected: affected,
      };
    }

    // Append loser contents
    let mergedContent = winnerContent.trimEnd() + "\n\n";
    for (const loser of toMerge) {
      mergedContent += `\n--- Merged from ${loser.scope} scope ---\n\n`;
      mergedContent += loser.rawContent.trim() + "\n";
    }

    // Back up winner
    try {
      const bk = await createBackup({
        sourceFile: winner.sourceFile,
        scopeRoot: winner.scopeRoot,
        backupsDir: ctx.backupsDir,
      });
      affected.push({
        entityId: winner.id,
        sourceFile: winner.sourceFile,
        backupPath: bk.backupPath,
      });
    } catch (e) {
      return {
        ok: false,
        action: req.action,
        reason: "write-failed",
        message: `backup failed: ${(e as Error).message}`,
        partiallyAffected: affected,
      };
    }

    // Write winner
    try {
      await fs.writeFile(winner.sourceFile, mergedContent, "utf8");
    } catch (e) {
      return {
        ok: false,
        action: req.action,
        reason: "write-failed",
        message: (e as Error).message,
        partiallyAffected: affected,
      };
    }

    // Delete merged copies
    for (const loser of toMerge) {
      const res = await deleteFileEntity(loser, ctx);
      if (!res.ok) {
        return {
          ok: false,
          action: req.action,
          reason: res.reason,
          message: res.message,
          partiallyAffected: affected,
        };
      }
      affected.push(res.affected);
    }
  }

  return { ok: true, action: req.action, affected };
}

// ── promote / demote scope ─────────────────────────────────────────────────

async function runScopeMove(
  req: BulkRequest,
  ctx: BulkContext,
  dir: "up" | "down",
): Promise<BulkResponse> {
  const affected: BulkAffected[] = [];
  for (const id of req.entityIds) {
    const entity = ctx.knownEntities.find((e) => e.id === id);
    if (!entity) {
      return {
        ok: false,
        action: req.action,
        reason: "entity-missing",
        message: `entity not found: ${id}`,
        partiallyAffected: affected,
      };
    }

    const target = req.targetScope ?? (dir === "up" ? scopeAbove(entity.scope) : scopeBelow(entity.scope));
    if (!target) {
      return {
        ok: false,
        action: req.action,
        reason: "action-not-applicable",
        message: `cannot move ${entity.scope} ${dir}`,
        partiallyAffected: affected,
      };
    }

    if (target === entity.scope) continue;

    const destFile = resolveDestFile(entity, target, ctx);
    if (!destFile) {
      return {
        ok: false,
        action: req.action,
        reason: "action-not-applicable",
        message: `no valid destination for ${entity.type} in ${target} scope`,
        partiallyAffected: affected,
      };
    }

    const isFileBacked =
      entity.type === "skill" ||
      entity.type === "command" ||
      entity.type === "agent" ||
      entity.type === "memory" ||
      entity.type === "keybinding" ||
      entity.type === "plugin";

    try {
      if (isFileBacked) {
        // 1. Back up original
        const bk = await createBackup({
          sourceFile: entity.sourceFile,
          scopeRoot: entity.scopeRoot,
          backupsDir: ctx.backupsDir,
        });

        // 2. Write to new location
        await fs.mkdir(path.dirname(destFile), { recursive: true });
        await fs.writeFile(destFile, entity.rawContent, "utf8");

        // 3. Delete original
        await fs.unlink(entity.sourceFile);

        affected.push({
          entityId: entity.id,
          sourceFile: entity.sourceFile,
          newSourceFile: destFile,
          backupPath: bk.backupPath,
        });
      } else {
        // Entry-level move
        // 1. Delete from source
        const delRes = await deleteFileEntity(entity, ctx);
        if (!delRes.ok) {
          return {
            ok: false,
            action: req.action,
            reason: delRes.reason,
            message: delRes.message,
            partiallyAffected: affected,
          };
        }
        affected.push(delRes.affected);

        // 2. Add to destination
        const addRes = await addEntityToTarget(entity, destFile, ctx);
        if (!addRes.ok) {
          return {
            ok: false,
            action: req.action,
            reason: "write-failed",
            message: addRes.message!,
            partiallyAffected: affected,
          };
        }
        affected.push(addRes.affected!);
      }
    } catch (e) {
      return {
        ok: false,
        action: req.action,
        reason: "write-failed",
        message: (e as Error).message,
        partiallyAffected: affected,
      };
    }
  }
  return { ok: true, action: req.action, affected };
}

async function addEntityToTarget(
  entity: Entity,
  destFile: string,
  ctx: BulkContext,
): Promise<{ ok: boolean; message?: string; affected?: BulkAffected }> {
  try {
    let content = "";
    try {
      content = await fs.readFile(destFile, "utf8");
    } catch {
      // file doesn't exist yet, that's fine
    }

    let nextContent: string;
    if (entity.type === "standing-instruction") {
      nextContent = content.trimEnd() + "\n\n" + entity.rawContent.trim() + "\n";
    } else {
      const parsed = parseSettings(content || "{}");
      if (entity.type === "permission") {
        const sd = entity.structured as any;
        const group = sd?.group || "allow";
        const val = sd?.value || entity.title;
        const perms = (parsed.raw.permissions ??= {}) as any;
        const list = (perms[group] ??= []) as string[];
        list.push(val);
      } else if (entity.type === "hook") {
        const sd = entity.structured as any;
        const hooks = (parsed.raw.hooks ??= {}) as any;
        const list = (hooks[sd?.event || "PostToolUse"] ??= []) as any[];
        list.push({ matcher: sd?.matcher || "*", hooks: sd?.hooks || [] });
      } else if (entity.type === "env") {
        const sd = entity.structured as any;
        const env = (parsed.raw.env ??= {}) as any;
        env[sd?.name || entity.title] = sd?.value || entity.intent;
      } else {
        return { ok: false, message: `adding ${entity.type} to settings.json not implemented` };
      }
      nextContent = serializeSettings(parsed);
    }

    // Backup dest before writing
    let backupPath: string | undefined;
    if (content) {
      const bk = await createBackup({
        sourceFile: destFile,
        scopeRoot: ctx.claudeHome, // best effort
        backupsDir: ctx.backupsDir,
      });
      backupPath = bk.backupPath;
    }

    await fs.mkdir(path.dirname(destFile), { recursive: true });
    await fs.writeFile(destFile, nextContent, "utf8");

    return {
      ok: true,
      affected: {
        entityId: entity.id,
        sourceFile: destFile,
        backupPath,
      },
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

function resolveDestFile(
  entity: Entity,
  target: Scope,
  ctx: BulkContext,
): string | null {
  const basename = path.basename(entity.sourceFile);
  const isFileBacked =
    entity.type === "skill" ||
    entity.type === "command" ||
    entity.type === "agent" ||
    entity.type === "memory" ||
    entity.type === "keybinding" ||
    entity.type === "plugin";

  const kindDir = entity.type === "memory" ? "memory" : `${entity.type}s`;

  let root: string | null = null;
  switch (target) {
    case "global":
      root = ctx.claudeHome;
      break;
    case "slug":
      root = entity.slugRef ? path.join(ctx.claudeHome, "projects", entity.slugRef) : null;
      break;
    case "project":
      root = entity.scopeRoot; // scopeRoot is the project root for project/local/slug entities
      break;
    case "local":
      root = entity.scopeRoot;
      break;
  }

  if (!root) return null;

  if (isFileBacked) {
    return joinDestForKind(root, kindDir, entity.sourceFile, basename);
  }

  // Entry-level
  if (entity.type === "standing-instruction") {
    if (target === "local") return path.join(root, "CLAUDE.local.md");
    return path.join(root, "CLAUDE.md");
  }

  // settings.json backed
  const settingsDir = (target === "project" || target === "local") ? path.join(root, ".claude") : root;
  if (target === "local") return path.join(settingsDir, "settings.local.json");
  return path.join(settingsDir, "settings.json");
}

// Build `<root>/<kindDir>/<tail>` where tail is either `<name>/SKILL.md`
// (to preserve the dir-style layout) or just the basename for flat files.
function joinDestForKind(
  root: string,
  kindDir: string,
  oldSourceFile: string,
  basename: string,
): string {
  if (basename === "SKILL.md") {
    const parts = oldSourceFile.split(/[\\/]/);
    const parent = parts[parts.length - 2] ?? "";
    return path.join(root, kindDir, parent, "SKILL.md");
  }
  return path.join(root, kindDir, basename);
}

// ── delete-entity ──────────────────────────────────────────────────────────

async function runDeleteEntity(
  req: BulkRequest,
  ctx: BulkContext,
): Promise<BulkResponse> {
  const affected: BulkAffected[] = [];
  for (const id of req.entityIds) {
    const entity = ctx.knownEntities.find((e) => e.id === id);
    if (!entity) {
      return {
        ok: false,
        action: req.action,
        reason: "entity-missing",
        message: `entity not found: ${id}`,
        partiallyAffected: affected,
      };
    }
    const group = groupByIdentity(entity, ctx.knownEntities);
    for (const copy of group) {
      const res = await deleteFileEntity(copy, ctx);
      if (!res.ok) {
        return {
          ok: false,
          action: req.action,
          reason: res.reason,
          message: res.message,
          partiallyAffected: affected,
        };
      }
      affected.push(res.affected);
    }
  }
  return { ok: true, action: req.action, affected };
}

// ── dismiss-stale / flag-for-review ────────────────────────────────────────
// Persist marker entries to ~/.claude/memmgmt-state.json. The stale-detection
// layer consults this file at read-time.

async function runMarker(
  req: BulkRequest,
  ctx: BulkContext,
  bucket: "dismissedStale" | "flaggedForReview" | "keptAsOverride",
): Promise<BulkResponse> {
  const markerFile = path.join(ctx.claudeHome, "memmgmt-state.json");
  const state = await readState(markerFile);
  const now = Date.now();
  const list = (state[bucket] ??= []) as Array<{
    entityId: string;
    atMs: number;
  }>;
  const affected: BulkAffected[] = [];
  for (const id of req.entityIds) {
    const entity = ctx.knownEntities.find((e) => e.id === id);
    if (!entity) {
      return {
        ok: false,
        action: req.action,
        reason: "entity-missing",
        message: `entity not found: ${id}`,
        partiallyAffected: affected,
      };
    }
    const idx = list.findIndex((m) => m.entityId === id);
    if (idx >= 0) list[idx] = { entityId: id, atMs: now };
    else list.push({ entityId: id, atMs: now });
    affected.push({
      entityId: entity.id,
      sourceFile: entity.sourceFile,
      markerFile,
    });
  }
  try {
    await fs.mkdir(path.dirname(markerFile), { recursive: true });
    await fs.writeFile(markerFile, JSON.stringify(state, null, 2) + "\n", "utf8");
  } catch (e) {
    return {
      ok: false,
      action: req.action,
      reason: "write-failed",
      message: (e as Error).message,
      partiallyAffected: affected,
    };
  }
  return { ok: true, action: req.action, affected };
}

interface MemmgmtState {
  dismissedStale?: Array<{ entityId: string; atMs: number }>;
  flaggedForReview?: Array<{ entityId: string; atMs: number }>;
  keptAsOverride?: Array<{ entityId: string; atMs: number }>;
}

async function readState(markerFile: string): Promise<MemmgmtState> {
  try {
    const raw = await fs.readFile(markerFile, "utf8");
    return JSON.parse(raw) as MemmgmtState;
  } catch {
    return {};
  }
}

// ── Low-level delete (file-layer for file-backed types; entry-layer for others) ─

type DeleteResult =
  | { ok: true; affected: BulkAffected }
  | {
      ok: false;
      reason: "write-failed" | "action-not-applicable" | "internal";
      message: string;
    };

async function deleteFileEntity(
  entity: Entity,
  ctx: BulkContext,
): Promise<DeleteResult> {
  // Artifacts contributed by a plugin (skills, commands, etc.) are read-only.
  // The plugin manifest itself is NOT read-only so that duplicates can be pruned.
  if (entity.plugin && entity.type !== "plugin") {
    return {
      ok: false,
      reason: "action-not-applicable",
      message: `${entity.type} contributed by plugin is read-only`,
    };
  }

  const fileBacked =
    entity.type === "skill" ||
    entity.type === "command" ||
    entity.type === "agent" ||
    entity.type === "memory" ||
    entity.type === "keybinding" ||
    entity.type === "plugin";

  if (fileBacked) {
    let backupPath: string;
    try {
      const bk = await createBackup({
        sourceFile: entity.sourceFile,
        scopeRoot: entity.scopeRoot,
        backupsDir: ctx.backupsDir,
      });
      backupPath = bk.backupPath;
    } catch (e) {
      return {
        ok: false,
        reason: "write-failed",
        message: `backup failed: ${(e as Error).message}`,
      };
    }
    try {
      await fs.unlink(entity.sourceFile);
    } catch (e) {
      return {
        ok: false,
        reason: "write-failed",
        message: (e as Error).message,
      };
    }
    return {
      ok: true,
      affected: {
        entityId: entity.id,
        sourceFile: entity.sourceFile,
        backupPath,
      },
    };
  }

  // Entry-level entities (share a file with other entities)
  try {
    const raw = await fs.readFile(entity.sourceFile, "utf8");
    let nextContent: string;

    if (entity.type === "standing-instruction") {
      const sections = parseClaudeMd(raw);
      const nextSections = sections.filter((s) => {
        // Match by headingPath (exact identity)
        const key = JSON.stringify(s.headingPath);
        return key !== entity.entryKey;
      });
      if (nextSections.length === sections.length) {
        return { ok: false, reason: "internal", message: "section not found" };
      }
      nextContent = serializeClaudeMd(nextSections);
    } else {
      // settings.json backed
      const parsed = parseSettings(raw);
      if (!entity.entryKey) {
        return { ok: false, reason: "internal", message: "entryKey missing" };
      }
      deleteEntryFromSettings(parsed.raw, entity.entryKey);
      nextContent = serializeSettings(parsed);
    }

    const bk = await createBackup({
      sourceFile: entity.sourceFile,
      scopeRoot: entity.scopeRoot,
      backupsDir: ctx.backupsDir,
    });
    await fs.writeFile(entity.sourceFile, nextContent, "utf8");

    return {
      ok: true,
      affected: {
        entityId: entity.id,
        sourceFile: entity.sourceFile,
        backupPath: bk.backupPath,
      },
    };
  } catch (e) {
    return {
      ok: false,
      reason: "write-failed",
      message: (e as Error).message,
    };
  }
}

/**
 * Removes a nested property from an object using pseudo-JSON-pointer syntax
 * like "permissions.allow[0]" or "env.DEBUG".
 */
function deleteEntryFromSettings(obj: any, pathStr: string) {
  const parts = pathStr.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]!;
    if (!cur[p]) return;
    cur = cur[p];
  }
  const last = parts[parts.length - 1]!;
  const arrayMatch = /(.*)\[(\d+)\]$/.exec(last);
  if (arrayMatch) {
    const key = arrayMatch[1]!;
    const index = parseInt(arrayMatch[2]!, 10);
    if (Array.isArray(cur[key])) {
      cur[key].splice(index, 1);
    }
  } else {
    delete cur[last];
  }
}
