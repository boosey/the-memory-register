import fs from "node:fs/promises";
import path from "node:path";
import { createBackup } from "./backup";
import { serializeSkill, type ParsedSkill } from "../parsers/skill";
import { parseCommand } from "../parsers/command";
import type { Entity } from "../entities";
import type {
  ConvertToSkillRequest,
  ConvertToSkillResponse,
} from "../apiContracts";

export interface ConvertContext {
  /** Root for persistent backups. Falls back to `<homeDir>/.claude/the-memory-register-backups` via the route. */
  backupsDir: string;
  /** Snapshot of the current Entity set used to pick the skill dir layout. */
  knownEntities: Entity[];
}

const SLUG_RE = /^[a-z][a-z0-9-]*$/;

// Transactional command → skill move:
//   1. Look up the source Entity + validate.
//   2. Compute destination path (matching the scope's dominant skill layout).
//   3. Back up the command file.
//   4. Write the new skill (atomic via tmp + rename).
//   5. Delete the command file.
// On any failure after the first write, roll back whatever partial state
// landed on disk so the user sees their original command file intact.
export async function convertCommandToSkill(
  req: ConvertToSkillRequest,
  ctx: ConvertContext,
): Promise<ConvertToSkillResponse> {
  const command = ctx.knownEntities.find((e) => e.id === req.commandId);
  if (!command || command.type !== "command") {
    return {
      ok: false,
      reason: "command-not-found",
      message: `no command entity with id ${req.commandId}`,
    };
  }

  if (!SLUG_RE.test(req.newSkillName)) {
    return {
      ok: false,
      reason: "skill-name-invalid",
      message: `skill name must match ${SLUG_RE.source}`,
    };
  }

  const skillsRoot = resolveSkillsRoot(command);
  const layout = pickSkillLayout(ctx.knownEntities, command.scope, skillsRoot);
  const destPath =
    layout === "flat"
      ? path.join(skillsRoot, `${req.newSkillName}.md`)
      : path.join(skillsRoot, req.newSkillName, "SKILL.md");

  if (await pathExists(destPath)) {
    return {
      ok: false,
      reason: "skill-name-taken",
      message: `skill already exists at ${destPath}`,
    };
  }
  // Also guard against the alternate layout existing under the same name.
  const altPath =
    layout === "flat"
      ? path.join(skillsRoot, req.newSkillName, "SKILL.md")
      : path.join(skillsRoot, `${req.newSkillName}.md`);
  if (await pathExists(altPath)) {
    return {
      ok: false,
      reason: "skill-name-taken",
      message: `skill already exists at ${altPath}`,
    };
  }

  // Read current command body + any preserved frontmatter.
  let commandSource: string;
  try {
    commandSource = await fs.readFile(command.sourceFile, "utf8");
  } catch (e) {
    return {
      ok: false,
      reason: "internal",
      message: `failed to read command file: ${(e as Error).message}`,
    };
  }
  const parsedCommand = parseCommand(commandSource);

  // Strip command-only frontmatter keys from `extraFrontmatter` before they
  // land in the skill. `description` is already peeled by parseCommand, but
  // authors sometimes stick command-specific metadata on the frontmatter that
  // shouldn't survive the conversion.
  const COMMAND_ONLY_KEYS = new Set([
    "argument-hint",
    "arguments",
    "args",
    "model",
    "allowed-tools",
  ]);
  const preservedExtra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsedCommand.extraFrontmatter)) {
    if (!COMMAND_ONLY_KEYS.has(k)) preservedExtra[k] = v;
  }

  const skill: ParsedSkill = {
    name: req.newSkillName,
    description: req.newSkillDescription,
    author: parsedCommand.author,
    body: parsedCommand.body,
    extraFrontmatter: preservedExtra,
  };
  const skillContent = serializeSkill(skill);

  // Step 3: back up the command file.
  let commandBackupPath: string;
  try {
    const bk = await createBackup({
      sourceFile: command.sourceFile,
      scopeRoot: command.scopeRoot,
      backupsDir: ctx.backupsDir,
    });
    commandBackupPath = bk.backupPath;
  } catch (e) {
    return {
      ok: false,
      reason: "backup-failed",
      message: (e as Error).message,
    };
  }

  // Step 4: write the skill file atomically (tmp + rename).
  let skillWritten = false;
  try {
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    const tmp = `${destPath}.the-memory-register-tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmp, skillContent, "utf8");
    await fs.rename(tmp, destPath);
    skillWritten = true;
  } catch (e) {
    await cleanupPartial(destPath);
    return {
      ok: false,
      reason: "write-failed",
      message: (e as Error).message,
    };
  }

  // Step 5: delete the command file.
  try {
    await fs.unlink(command.sourceFile);
  } catch (e) {
    // Roll back: remove the skill we just wrote, restore the command from backup.
    if (skillWritten) await cleanupPartial(destPath);
    try {
      const backupContent = await fs.readFile(commandBackupPath, "utf8");
      await fs.writeFile(command.sourceFile, backupContent, "utf8");
    } catch {
      /* best-effort rollback */
    }
    return {
      ok: false,
      reason: "delete-failed",
      message: (e as Error).message,
    };
  }

  return {
    ok: true,
    skillPath: destPath,
    commandBackupPath,
    commandDeletedPath: command.sourceFile,
    newSkillId: `skill::${command.scope}::${destPath}`,
  };
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function cleanupPartial(destPath: string): Promise<void> {
  try {
    await fs.unlink(destPath);
  } catch {
    /* already gone */
  }
  // If we created a brand-new directory for <name>/SKILL.md, drop it if empty.
  const parent = path.dirname(destPath);
  try {
    const entries = await fs.readdir(parent);
    if (entries.length === 0) await fs.rmdir(parent);
  } catch {
    /* ignore */
  }
}

// Map the command's sourceFile to the sibling skills directory. Every scope
// that emits commands also has a parallel `skills/` directory at the same
// level in the tree, so we just swap the segment.
function resolveSkillsRoot(command: Entity): string {
  const sep = command.sourceFile.includes("\\") ? "\\" : "/";
  const parts = command.sourceFile.split(sep);
  const idx = lastIndexOf(parts, "commands");
  if (idx === -1) {
    // Fallback: place skills next to the scope root in the canonical layout.
    if (command.scope === "project" || command.scope === "local") {
      return path.join(command.scopeRoot, ".claude", "skills");
    }
    return path.join(command.scopeRoot, "skills");
  }
  const copy = parts.slice(0, idx + 1);
  copy[idx] = "skills";
  return copy.join(sep);
}

function lastIndexOf(arr: string[], needle: string): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] === needle) return i;
  }
  return -1;
}

// Decide between `<name>.md` and `<name>/SKILL.md` for the new skill by
// counting the layouts already present in `skillsRoot` across knownEntities.
// Ties resolve to SKILL.md since that is the only layout the v1.6 crawler
// currently picks up.
function pickSkillLayout(
  knownEntities: Entity[],
  scope: Entity["scope"],
  skillsRoot: string,
): "flat" | "dir" {
  let flat = 0;
  let dir = 0;
  for (const e of knownEntities) {
    if (e.type !== "skill") continue;
    if (e.scope !== scope) continue;
    if (!e.sourceFile.startsWith(skillsRoot)) continue;
    const basename = e.sourceFile.replace(/[\\/]+$/, "").split(/[\\/]/).pop();
    if (basename === "SKILL.md") dir++;
    else flat++;
  }
  return flat > dir ? "flat" : "dir";
}
