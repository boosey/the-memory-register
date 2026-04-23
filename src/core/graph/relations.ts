import type { Entity, Relation } from "../entities";
import type { SlugMetadata } from "../types";
import { pseudoNodeId } from "../entities";
import type { PseudoNodeRegistry } from "./pseudoNodes";
import { resolveImport } from "./importResolver";
import fs from "node:fs";

// ── provides ────────────────────────────────────────────────────────────────
// Plugin entity → {skill, command, agent, mcp-server} entities that share
// its plugin scopeRoot. One Relation per contribution.

const PROVIDES_KINDS = new Set<Entity["type"]>([
  "skill",
  "command",
  "agent",
  "mcp-server",
]);

export function deriveProvides(entities: Entity[]): Relation[] {
  const pluginsByRoot = new Map<string, Entity>();
  for (const e of entities) {
    if (e.type === "plugin" && e.scope === "plugin") {
      pluginsByRoot.set(e.scopeRoot, e);
    }
  }
  const out: Relation[] = [];
  for (const e of entities) {
    if (e.scope !== "plugin") continue;
    if (!PROVIDES_KINDS.has(e.type)) continue;
    const plug = pluginsByRoot.get(e.scopeRoot);
    if (!plug) continue;
    out.push({
      id: `provides::${plug.id}->${e.id}`,
      kind: "provides",
      from: plug.id,
      to: e.id,
    });
  }
  return out;
}

// ── invokes ─────────────────────────────────────────────────────────────────
// skill/command entity → skill/command entities that are mentioned in its body.
// Uses simple name-based matching.

const INVOKE_TARGET_KINDS = new Set<Entity["type"]>(["skill", "command"]);
const INVOKE_RE = /\/(\w[\w-]*)\b/g;

export function deriveInvokes(entities: Entity[]): Relation[] {
  const out: Relation[] = [];
  const targetsByName = new Map<string, Entity>();
  for (const e of entities) {
    if (INVOKE_TARGET_KINDS.has(e.type) && e.title) {
      // For commands, title often includes the / prefix, but the regex match
      // m[1] strips it. Handle both.
      const name = e.title.startsWith("/") ? e.title.slice(1) : e.title;
      targetsByName.set(name, e);
    }
  }

  for (const e of entities) {
    if (e.type !== "skill" && e.type !== "command") continue;
    const body = (e.structured as { body?: string } | null)?.body ?? "";
    if (!body) continue;

    const seen = new Set<string>();
    for (const m of body.matchAll(INVOKE_RE)) {
      const token = m[1]!;
      const target = targetsByName.get(token);
      if (target && target.id !== e.id && !seen.has(target.id)) {
        seen.add(target.id);
        out.push({
          id: `invokes::${e.id}->${target.id}`,
          kind: "invokes",
          from: e.id,
          to: target.id,
        });
      }
    }
  }
  return out;
}

// ── imports ─────────────────────────────────────────────────────────────────
// standing-instruction → entity (when the @path resolves to a known entity)
// or → path pseudo-node (when not). Sets `broken: true` when the target
// file is missing on disk.

export interface DeriveImportsOpts {
  homeDir?: string;
  /** Existence probe; defaults to fs.existsSync. Overridable for tests. */
  exists?: (absPath: string) => boolean;
}

export function deriveImports(
  entities: Entity[],
  registry: PseudoNodeRegistry,
  opts: DeriveImportsOpts = {},
): Relation[] {
  const exists = opts.exists ?? ((p: string) => fs.existsSync(p));
  const byFile = new Map<string, Entity[]>();
  for (const e of entities) {
    const arr = byFile.get(e.sourceFile) ?? [];
    arr.push(e);
    byFile.set(e.sourceFile, arr);
  }

  const out: Relation[] = [];
  for (const e of entities) {
    if (!e.imports?.length) continue;
    for (const ref of e.imports) {
      // Strip the `@` prefix before resolving; keep the original `@path` form
      // as the pseudo-node id for a stable, pinnable target.
      const bare = ref.startsWith("@") ? ref.slice(1) : ref;
      const abs = resolveImport(bare, e.sourceFile, opts.homeDir);
      const atPath = pseudoNodeId.path(ref);

      // File-missing case: always a broken import targeted at path pseudo-node.
      if (!abs || !exists(abs)) {
        registry.registerPath(atPath, true);
        e.hasDeadImports = true;
        out.push({
          id: `imports::${e.id}->${atPath}`,
          kind: "imports",
          from: e.id,
          to: atPath,
          broken: true,
        });
        continue;
      }

      // File-present case: prefer resolving to a concrete Entity (e.g. a
      // claude-md-section inside the imported file). Otherwise fall back
      // to a non-broken path pseudo-node.
      const targets = byFile.get(abs) ?? [];
      const picked =
        targets.find((t) => t.type === "standing-instruction") ?? targets[0];
      if (picked) {
        out.push({
          id: `imports::${e.id}->${picked.id}`,
          kind: "imports",
          from: e.id,
          to: picked.id,
          note: ref,
        });
      } else {
        registry.registerPath(atPath, false);
        out.push({
          id: `imports::${e.id}->${atPath}`,
          kind: "imports",
          from: e.id,
          to: atPath,
        });
      }
    }
  }
  return out;
}

// ── accretes-from ───────────────────────────────────────────────────────────
// memory entity → slug:<name> pseudo-node. Note = "<N> sessions".

export function deriveAccretesFrom(
  memoryEntities: Entity[],
  slugMetadata: SlugMetadata[],
  registry: PseudoNodeRegistry,
): Relation[] {
  const out: Relation[] = [];
  const metaByName = new Map(slugMetadata.map((m) => [m.slug, m]));
  for (const e of memoryEntities) {
    if (e.type !== "memory") continue;
    if (!e.slugRef) continue;
    const meta = metaByName.get(e.slugRef);
    if (!meta) continue;
    const id = registry.registerSlug({
      name: e.slugRef,
      projectPath: meta.projectPath,
      sessionCount: meta.sessionCount,
      lastActiveMs: meta.lastActiveMs,
      isGhost: false,
    });
    out.push({
      id: `accretes-from::${e.id}->${id}`,
      kind: "accretes-from",
      from: e.id,
      to: id,
      note: `${meta.sessionCount} session${meta.sessionCount === 1 ? "" : "s"}`,
    });
  }
  return out;
}

// ── fires-on ────────────────────────────────────────────────────────────────
// hook entity → tool:<matcher> pseudo-node. Matcher stays verbatim.

export function deriveFiresOn(
  hookEntities: Entity[],
  registry: PseudoNodeRegistry,
): Relation[] {
  const out: Relation[] = [];
  for (const e of hookEntities) {
    if (e.type !== "hook") continue;
    const sd = e.structured as { matcher?: string; event?: string } | null;
    const matcher = sd?.matcher ?? "";
    if (!matcher) continue;
    const id = registry.registerTool(matcher);
    const note = sd?.event ? `${sd.event} on ${matcher}` : matcher;
    out.push({
      id: `fires-on::${e.id}->${id}`,
      kind: "fires-on",
      from: e.id,
      to: id,
      note,
    });
  }
  return out;
}

// ── gates ───────────────────────────────────────────────────────────────────
// permission entity → tool:<prefix> pseudo-node. Prefix-only; regex below.

const PERM_PREFIX_RE = /^(\w+|\*)(?:\(.*\))?$/;

export function deriveGates(
  permissionEntities: Entity[],
  registry: PseudoNodeRegistry,
): Relation[] {
  const out: Relation[] = [];
  for (const e of permissionEntities) {
    if (e.type !== "permission") continue;
    const sd = e.structured as {
      kind?: string;
      group?: string;
      value?: string;
    } | null;
    const raw = sd?.value ?? e.title;
    if (!raw) continue;
    const m = PERM_PREFIX_RE.exec(raw);
    const prefix = m ? m[1]! : raw;
    const id = registry.registerTool(prefix);
    const effect = sd?.group ?? "allow";
    out.push({
      id: `gates::${e.id}->${id}`,
      kind: "gates",
      from: e.id,
      to: id,
      note: `${effect} · ${raw}`,
    });
  }
  return out;
}
