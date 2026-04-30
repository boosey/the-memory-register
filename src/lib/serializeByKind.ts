import {
  parseClaudeMd,
  serializeClaudeMd,
  type ClaudeMdSection,
} from "@/core/parsers/claudeMd";
import {
  parseSettings,
  serializeSettings,
  type SettingsEntry,
} from "@/core/parsers/settings";
import { serializeSkill, type ParsedSkill } from "@/core/parsers/skill";
import { serializeCommand, type ParsedCommand } from "@/core/parsers/command";
import { serializeAgent, type ParsedAgent } from "@/core/parsers/agent";
import {
  serializeTypedMemory,
  type ParsedTypedMemory,
} from "@/core/parsers/memory";
import {
  serializeKeybindings,
  type ParsedKeybindings,
} from "@/core/parsers/keybindings";
import type { ArtifactNode } from "@/core/types";

/**
 * Compose the next full-file content for an artifact node plus its edited draft.
 *
 * CLAUDE.md and settings are stored per-entry; editing a single entry must
 * re-serialize the entire file, so we re-parse the original rawContent and
 * splice the changed entry back in.
 */
export function buildNextContent(node: ArtifactNode, draft: unknown): string {
  switch (node.kind) {
    case "claude-md-section":
      return buildClaudeMdNext(node, draft as ClaudeMdSection);
    case "settings-entry":
      return buildSettingsNext(node, draft as SettingsEntry);
    case "skill":
      return serializeSkill(draft as ParsedSkill);
    case "command":
      return serializeCommand(draft as ParsedCommand);
    case "agent":
      return serializeAgent(draft as ParsedAgent);
    case "typed-memory":
      return serializeTypedMemory(draft as ParsedTypedMemory);
    case "keybindings":
      return serializeKeybindings(draft as ParsedKeybindings);
    default:
      throw new Error(`no serializer for kind: ${node.kind}`);
  }
}

function buildClaudeMdNext(
  node: ArtifactNode,
  draftSection: ClaudeMdSection,
): string {
  const currentSection = node.structuredData as ClaudeMdSection;
  const sections = parseClaudeMd(node.rawContent);
  const target = sections.findIndex(
    (s) =>
      s.level === currentSection.level &&
      s.heading === currentSection.heading &&
      s.headingPath.join("/") === currentSection.headingPath.join("/"),
  );
  if (target < 0) {
    throw new Error("could not locate section to update in source file");
  }
  sections[target] = { ...sections[target]!, body: draftSection.body };
  return serializeClaudeMd(sections);
}

function buildSettingsNext(
  node: ArtifactNode,
  draft: SettingsEntry,
): string {
  const parsed = parseSettings(node.rawContent);
  const raw = JSON.parse(JSON.stringify(parsed.raw)) as Record<string, unknown>;
  applySettingsEntry(raw, draft);
  return serializeSettings({
    raw,
    entries: parsed.entries,
    unknownTopLevelKeys: parsed.unknownTopLevelKeys,
  });
}

function applySettingsEntry(
  raw: Record<string, unknown>,
  entry: SettingsEntry,
): void {
  if (entry.kind === "permission") {
    const permissions = (raw.permissions ??= {}) as Record<string, string[]>;
    const list = (permissions[entry.group] ??= []);
    const match = /\[(\d+)\]$/.exec(entry.entryKey);
    const i = match ? Number(match[1]) : list.length;
    list[i] = entry.value;
  } else if (entry.kind === "env") {
    const env = (raw.env ??= {}) as Record<string, unknown>;
    env[entry.name] = entry.value;
  } else if (entry.kind === "hook") {
    const hooks = (raw.hooks ??= {}) as Record<string, unknown[]>;
    const list = (hooks[entry.event] ??= []);
    const match = /\[(\d+)\]$/.exec(entry.entryKey);
    const i = match ? Number(match[1]) : list.length;
    list[i] = { matcher: entry.matcher, hooks: entry.hooks };
  } else if (entry.kind === "mcp-server") {
    const servers = (raw.mcpServers ??= {}) as Record<string, unknown>;
    servers[entry.server.name] = entry.server.raw;
  } else if (entry.kind === "other") {
    raw[entry.key] = entry.value;
  }
}
