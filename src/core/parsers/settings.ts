import { parseMcpServerEntry, type ParsedMcpServer } from "./mcpServer";

export type SettingsEntry =
  | {
      kind: "permission";
      entryKey: string;
      group: "allow" | "deny" | "ask";
      value: string;
    }
  | {
      kind: "hook";
      entryKey: string;
      event: string;
      matcher: string;
      hooks: unknown[];
    }
  | { kind: "env"; entryKey: string; name: string; value: string }
  | {
      kind: "mcp-server";
      entryKey: string;
      server: ParsedMcpServer;
    }
  | { kind: "enabled-plugins"; entryKey: string; plugins: string[] | Record<string, boolean> }
  | { kind: "other"; entryKey: string; key: string; value: unknown };

export interface ParsedSettings {
  raw: Record<string, unknown>;
  entries: SettingsEntry[];
  /** Top-level keys that aren't in the known set. Used for detections. */
  unknownTopLevelKeys: string[];
}

const PERMISSION_GROUPS = ["allow", "deny", "ask"] as const;

// Top-level keys memmgmt recognizes in settings.json. Anything else is
// surfaced via `unknownTopLevelKeys` for the detections accordion.
const KNOWN_TOP_LEVEL_KEYS = new Set([
  "permissions",
  "hooks",
  "env",
  "mcpServers",
  // Harmless but commonly-present fields we don't need to flag:
  "$schema",
  "model",
  "apiKeyHelper",
  "includeCoAuthoredBy",
  "cleanupPeriodDays",
  "autoUpdates",
  "outputStyle",
  "theme",
  "enableAllProjectMcpServers",
  "enabledMcpjsonServers",
  "disabledMcpjsonServers",
  "enabledPlugins",
  "statusLine",
  "alwaysThinkingEnabled",
  "forceLoginMethod",
  "allowedTools",
  "disallowedTools",
  "installMethod",
]);

const STRUCTURED_KEYS = new Set(["permissions", "hooks", "env", "mcpServers", "enabledPlugins"]);

export function parseSettings(src: string): ParsedSettings {
  const obj = (JSON.parse(src) ?? {}) as Record<string, unknown>;
  const entries: SettingsEntry[] = [];

  const perms = (obj.permissions ?? {}) as Record<string, unknown>;
  for (const group of PERMISSION_GROUPS) {
    const list = (perms[group] ?? []) as string[];
    list.forEach((value, i) => {
      entries.push({
        kind: "permission",
        entryKey: `permissions.${group}[${i}]`,
        group,
        value,
      });
    });
  }

  const hooks = (obj.hooks ?? {}) as Record<string, unknown>;
  for (const [event, arr] of Object.entries(hooks)) {
    const list = (arr ?? []) as Array<{
      matcher?: string;
      hooks?: unknown[];
    }>;
    list.forEach((h, i) => {
      entries.push({
        kind: "hook",
        entryKey: `hooks.${event}[${i}]`,
        event,
        matcher: h.matcher ?? "",
        hooks: h.hooks ?? [],
      });
    });
  }

  const env = (obj.env ?? {}) as Record<string, string>;
  for (const [name, value] of Object.entries(env)) {
    entries.push({ kind: "env", entryKey: `env.${name}`, name, value });
  }

  const mcp = obj.mcpServers;
  if (mcp && typeof mcp === "object" && !Array.isArray(mcp)) {
    for (const [name, raw] of Object.entries(mcp as Record<string, unknown>)) {
      entries.push({
        kind: "mcp-server",
        entryKey: `mcpServers.${name}`,
        server: parseMcpServerEntry(name, raw),
      });
    }
  }

  const enabledPlugins = obj.enabledPlugins ?? [];
  entries.push({
    kind: "enabled-plugins",
    entryKey: "enabledPlugins",
    plugins: (Array.isArray(enabledPlugins) || (enabledPlugins && typeof enabledPlugins === "object"))
      ? (enabledPlugins as any)
      : [],
  });

  const unknownTopLevelKeys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (STRUCTURED_KEYS.has(k)) continue;
    if (!KNOWN_TOP_LEVEL_KEYS.has(k)) unknownTopLevelKeys.push(k);
    entries.push({ kind: "other", entryKey: k, key: k, value: v });
  }

  return { raw: obj, entries, unknownTopLevelKeys };
}

export function serializeSettings(parsed: ParsedSettings): string {
  return JSON.stringify(parsed.raw, null, 2) + "\n";
}
