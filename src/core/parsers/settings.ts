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
  | { kind: "other"; entryKey: string; key: string; value: unknown };

export interface ParsedSettings {
  raw: Record<string, unknown>;
  entries: SettingsEntry[];
}

const PERMISSION_GROUPS = ["allow", "deny", "ask"] as const;
const STRUCTURED_KEYS = new Set(["permissions", "hooks", "env"]);

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

  for (const [k, v] of Object.entries(obj)) {
    if (STRUCTURED_KEYS.has(k)) continue;
    entries.push({ kind: "other", entryKey: k, key: k, value: v });
  }

  return { raw: obj, entries };
}

export function serializeSettings(parsed: ParsedSettings): string {
  return JSON.stringify(parsed.raw, null, 2) + "\n";
}
