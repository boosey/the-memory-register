// Pure helpers for rendering the compiled preview of a permission entry
// in the PermissionEditor. Consumers apply the color class to the effect
// label; the preview string itself stays uncolored.

export type PermissionEffect = "allow" | "ask" | "deny";

export interface PermissionPreviewInput {
  effect: PermissionEffect;
  tool: string;
  pattern: string;
}

// Shape a permission as `<effect> · <Tool>(<pattern>)`. When pattern is empty
// we still print the parens around `*` so the preview never looks like a bare
// tool name (the UI relies on the shape to split colors across the effect
// and the tool-call portion).
export function permissionPreview(inp: PermissionPreviewInput): string {
  const arg = inp.pattern.trim().length > 0 ? inp.pattern : "*";
  return `${inp.effect} · ${inp.tool}(${arg})`;
}

// Semantic CSS color var the UI uses for the effect label. Extracted so
// tests can assert it and so RightRail can render the same preview with
// identical coloring.
export function permissionPreviewColorClass(effect: PermissionEffect): string {
  switch (effect) {
    case "allow":
      return "text-[color:var(--semantic-ok)]";
    case "ask":
      return "text-[color:var(--semantic-warn)]";
    case "deny":
      return "text-[color:var(--semantic-error)]";
  }
}

const PERM_RE = /^([^\s(]+)\s*(?:\(([^)]*)\))?$/;

export function parsePermissionValue(
  value: string,
): { tool: string; pattern: string } {
  const m = PERM_RE.exec(value ?? "");
  if (!m) return { tool: "Bash", pattern: "" };
  return { tool: m[1] ?? "Bash", pattern: (m[2] ?? "").trim() };
}

export function formatPermissionValue(tool: string, pattern: string): string {
  const p = pattern.trim();
  return p.length > 0 ? `${tool}(${p})` : tool;
}
