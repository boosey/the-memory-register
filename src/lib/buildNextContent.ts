// Client-side file re-serialization. The /api/save route expects the full
// nextContent for the entity's sourceFile — for multi-entry files (CLAUDE.md,
// settings.json) that means re-parsing the current raw and splicing in the
// edited entry. Mirrors the server-side buildNextContent in lib/serializeByKind,
// but runs in the browser so the editor forms never leak a partial shape up
// to the save endpoint.

import {
  parseClaudeMd,
  serializeClaudeMd,
  type ClaudeMdSection,
} from "@/core/parsers/claudeMd";
import {
  parseSettings,
  serializeSettings,
} from "@/core/parsers/settings";
import {
  serializeSkill,
  type ParsedSkill,
} from "@/core/parsers/skill";
import {
  serializeCommand,
  type ParsedCommand,
} from "@/core/parsers/command";
import {
  serializeAgent,
  type ParsedAgent,
} from "@/core/parsers/agent";
import {
  serializeTypedMemory,
  type ParsedTypedMemory,
} from "@/core/parsers/memory";
import {
  serializeKeybindings,
  type ParsedKeybindings,
} from "@/core/parsers/keybindings";
import type { Entity, EntityType } from "@/core/entities";

// ── Draft shapes ────────────────────────────────────────────────────────────

export interface StandingInstructionDraft {
  heading: string;
  body: string;
}

export interface PermissionDraft {
  group: "allow" | "deny" | "ask";
  value: string;
}

export interface HookDraft {
  event: string;
  matcher: string;
  hooks: unknown[];
}

export interface EnvDraft {
  name: string;
  value: string;
}

export interface KeybindingDraft {
  raw: Record<string, string>;
}

export interface McpServerDraft {
  name: string;
  raw: Record<string, unknown>;
}

export interface McpConsolidateDraft {
  kind: "consolidate-permissions";
  toWildcard: string; // e.g. "mcp__server__*"
  toRemoveValues: string[]; // values of permissions to remove (e.g. "mcp__server__foo")
  allRelatedPermissions: Entity[]; // Full list of permission entities to potentially remove
}

export interface EnabledPluginsDraft {
  plugins: string[];
}

export interface PluginToggleDraft {
  pluginName: string;
  enabled: boolean;
}

// ── Entry-path parsing ──────────────────────────────────────────────────────

function settingsEntryLocation(entity: Entity): {
  kind: "permission" | "hook" | "env" | "mcp-server" | "other";
  group?: "allow" | "deny" | "ask";
  index?: number;
  event?: string;
  name?: string;
  key?: string;
} {
  const sd = entity.structured as {
    kind?: string;
    group?: "allow" | "deny" | "ask";
    event?: string;
    name?: string;
    entryKey?: string;
    key?: string;
  } | null;
  const entryKey = sd?.entryKey ?? "";
  const kind =
    (sd?.kind as
      | "permission"
      | "hook"
      | "env"
      | "mcp-server"
      | "other"
      | undefined) ?? "other";
  const idxMatch = /\[(\d+)\]$/.exec(entryKey);
  const result: ReturnType<typeof settingsEntryLocation> = { kind };
  if (sd?.group) result.group = sd.group;
  if (sd?.event) result.event = sd.event;
  if (sd?.name) result.name = sd.name;
  if (sd?.key) result.key = sd.key;
  if (idxMatch) result.index = Number(idxMatch[1]);
  return result;
}

// ── Per-type builders ───────────────────────────────────────────────────────

function buildStandingInstruction(
  entity: Entity,
  draft: StandingInstructionDraft,
): string {
  const current = entity.structured as ClaudeMdSection | null;
  const sections = parseClaudeMd(entity.rawContent);
  const target = sections.findIndex(
    (s) =>
      s.level === (current?.level ?? 2) &&
      s.heading === (current?.heading ?? entity.title) &&
      (s.headingPath ?? []).join("/") ===
        (current?.headingPath ?? []).join("/"),
  );
  if (target < 0) {
    throw new Error("could not locate section to update");
  }
  sections[target] = {
    ...sections[target]!,
    heading: draft.heading,
    body: draft.body,
  };
  return serializeClaudeMd(sections);
}

function buildPermission(entity: Entity, draft: PermissionDraft): string {
  const parsed = parseSettings(entity.rawContent);
  const raw = JSON.parse(JSON.stringify(parsed.raw)) as Record<string, unknown>;
  const loc = settingsEntryLocation(entity);
  const currentGroup = loc.group ?? "allow";
  const idx = loc.index;

  const permissions = (raw.permissions ??= {}) as Record<string, string[]>;

  // If group changed, remove from old group first.
  if (draft.group !== currentGroup && idx !== undefined) {
    const oldList = (permissions[currentGroup] ??= []);
    if (idx < oldList.length) oldList.splice(idx, 1);
  }

  const list = (permissions[draft.group] ??= []);
  if (draft.group === currentGroup && idx !== undefined && idx < list.length) {
    list[idx] = draft.value;
  } else {
    list.push(draft.value);
  }

  return serializeSettings({ ...parsed, raw });
}

function buildHook(entity: Entity, draft: HookDraft): string {
  const parsed = parseSettings(entity.rawContent);
  const raw = JSON.parse(JSON.stringify(parsed.raw)) as Record<string, unknown>;
  const loc = settingsEntryLocation(entity);
  const currentEvent = loc.event ?? draft.event;
  const idx = loc.index;

  const hooks = (raw.hooks ??= {}) as Record<string, unknown[]>;

  // If event changed, drop the old entry.
  if (currentEvent !== draft.event && idx !== undefined) {
    const oldList = (hooks[currentEvent] ??= []);
    if (idx < oldList.length) oldList.splice(idx, 1);
  }

  const list = (hooks[draft.event] ??= []);
  const next = { matcher: draft.matcher, hooks: draft.hooks };
  if (currentEvent === draft.event && idx !== undefined && idx < list.length) {
    list[idx] = next;
  } else {
    list.push(next);
  }

  return serializeSettings({ ...parsed, raw });
}

function buildEnv(entity: Entity, draft: EnvDraft): string {
  const parsed = parseSettings(entity.rawContent);
  const raw = JSON.parse(JSON.stringify(parsed.raw)) as Record<string, unknown>;
  const loc = settingsEntryLocation(entity);
  const env = (raw.env ??= {}) as Record<string, string>;
  if (loc.name && loc.name !== draft.name) delete env[loc.name];
  env[draft.name] = draft.value;
  return serializeSettings({ ...parsed, raw });
}

function buildMcpServer(entity: Entity, draft: McpServerDraft): string {
  const parsed = parseSettings(entity.rawContent);
  const raw = JSON.parse(JSON.stringify(parsed.raw)) as Record<string, unknown>;
  const loc = settingsEntryLocation(entity);
  const servers = (raw.mcpServers ??= {}) as Record<string, unknown>;
  if (loc.name && loc.name !== draft.name) delete servers[loc.name];
  servers[draft.name] = draft.raw;
  return serializeSettings({ ...parsed, raw });
}

function buildMcpConsolidate(entity: Entity, draft: McpConsolidateDraft): string {
  const parsed = parseSettings(entity.rawContent);
  const raw = JSON.parse(JSON.stringify(parsed.raw)) as Record<string, any>;
  const perms = (raw.permissions ??= {});
  const allow = (perms.allow ??= []) as string[];

  // Identify all values we want to remove
  const toRemoveValues = new Set(draft.toRemoveValues);
  
  // Also identify permissions that specifically belong to this file (sourceFile match)
  const entitiesInThisFile = draft.allRelatedPermissions.filter(p => p.sourceFile === entity.sourceFile);
  for (const p of entitiesInThisFile) {
    const val = (p.structured as any)?.value || p.title;
    toRemoveValues.add(val);
  }

  // Ensure we don't remove the wildcard itself if it was somehow in toRemove
  toRemoveValues.delete(draft.toWildcard);

  const nextAllow = allow.filter(v => !toRemoveValues.has(v));
  if (!nextAllow.includes(draft.toWildcard)) {
    nextAllow.push(draft.toWildcard);
  }
  
  // Only update if something actually changed to avoid subtle JSON formatting noops
  perms.allow = nextAllow.sort();

  return serializeSettings({ ...parsed, raw });
}

function buildEnabledPlugins(entity: Entity, draft: EnabledPluginsDraft): string {
  const parsed = parseSettings(entity.rawContent);
  const raw = JSON.parse(JSON.stringify(parsed.raw)) as Record<string, unknown>;
  raw.enabledPlugins = draft.plugins;
  return serializeSettings({ ...parsed, raw });
}

function buildPluginToggle(entity: Entity, draft: PluginToggleDraft): string {
  const parsed = parseSettings(entity.rawContent);
  const raw = JSON.parse(JSON.stringify(parsed.raw)) as Record<string, unknown>;
  const current = raw.enabledPlugins;

  if (Array.isArray(current)) {
    const plugins = new Set(current);
    if (draft.enabled) {
      plugins.add(draft.pluginName);
    } else {
      plugins.delete(draft.pluginName);
    }
    raw.enabledPlugins = Array.from(plugins).sort();
  } else if (current && typeof current === "object") {
    const plugins = { ...current } as Record<string, boolean>;
    plugins[draft.pluginName] = draft.enabled;
    raw.enabledPlugins = plugins;
  } else {
    // Default to array if missing or invalid
    const plugins = new Set<string>();
    if (draft.enabled) {
      plugins.add(draft.pluginName);
    }
    raw.enabledPlugins = Array.from(plugins).sort();
  }

  return serializeSettings({ ...parsed, raw });
}

function buildKeybinding(draft: KeybindingDraft): string {
  return serializeKeybindings({ raw: draft.raw, entries: [] });
}

// ── Dispatch ────────────────────────────────────────────────────────────────

export function buildNextContentFor(
  entity: Entity,
  draft: unknown,
): string {
  const t: EntityType = entity.type;
  switch (t) {
    case "standing-instruction":
      return buildStandingInstruction(entity, draft as StandingInstructionDraft);
    case "permission":
      return buildPermission(entity, draft as PermissionDraft);
    case "hook":
      return buildHook(entity, draft as HookDraft);
    case "env":
      return buildEnv(entity, draft as EnvDraft);
    case "mcp-server":
      if (typeof draft === "object" && draft !== null && (draft as any).kind === "consolidate-permissions") {
        return buildMcpConsolidate(entity, draft as McpConsolidateDraft);
      }
      return buildMcpServer(entity, draft as McpServerDraft);
    case "enabled-plugins":
      if (typeof draft === "object" && draft !== null && (draft as any).kind === "consolidate-permissions") {
        return buildMcpConsolidate(entity, draft as McpConsolidateDraft);
      }
      return buildEnabledPlugins(entity, draft as EnabledPluginsDraft);
    case "keybinding":
      return buildKeybinding(draft as KeybindingDraft);
    case "skill":
      return serializeSkill(draft as ParsedSkill);
    case "command":
      return serializeCommand(draft as ParsedCommand);
    case "agent":
      return serializeAgent(draft as ParsedAgent);
    case "memory":
      return serializeTypedMemory(draft as ParsedTypedMemory);
    case "plugin":
      // If we are given a PluginToggleDraft, it means we are toggling enablement
      // in settings.json rather than editing the plugin manifest itself.
      if (
        typeof draft === "object" &&
        draft !== null &&
        "pluginName" in draft &&
        "targetSettings" in (draft as any)
      ) {
        const d = draft as PluginToggleDraft & { targetSettings: Entity };
        return buildPluginToggle(d.targetSettings, d);
      }
      // Plugin files (plugin.json / package.json) round-trip as JSON raw.
      return JSON.stringify(draft, null, 2) + "\n";
    default:
      throw new Error(`unsupported entity type: ${t}`);
  }
}
