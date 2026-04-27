import type { EntityType } from "@/core/entities";

interface TypeLabel {
  label: string;
  plural: string;
  glyph: string;
  blurb: string;
}

export const TYPE_LABELS: Record<EntityType, TypeLabel> = {
  "standing-instruction": {
    label: "Memory",
    plural: "Memories",
    glyph: "§",
    blurb: "Manual instructions Claude reads at startup (CLAUDE.md).",
  },
  permission: {
    label: "Permission",
    plural: "Permissions",
    glyph: "∙",
    blurb: "Allow/deny rules for tools and shell access.",
  },
  plugin: {
    label: "Plugin",
    plural: "Plugins",
    glyph: "⬡",
    blurb: "Bundles that contribute skills and commands.",
  },
  skill: {
    label: "Skill",
    plural: "Skills",
    glyph: "◇",
    blurb: "Named capabilities Claude can invoke on demand.",
  },
  command: {
    label: "Slash Command",
    plural: "Slash Commands",
    glyph: "/",
    blurb: "Named prompts invoked with / inside chat.",
  },
  memory: {
    label: "Memory",
    plural: "Memories",
    glyph: "◉",
    blurb: "Auto-curated notes from past sessions (MEMORY.md).",
  },
  hook: {
    label: "Hook",
    plural: "Hooks",
    glyph: "↯",
    blurb: "Scripts that run on tool events.",
  },
  env: {
    label: "Env Var",
    plural: "Env Vars",
    glyph: "$",
    blurb: "Environment values Claude passes to tools.",
  },
  keybinding: {
    label: "Keybinding",
    plural: "Keybindings",
    glyph: "⌘",
    blurb: "Shortcut chords.",
  },
  agent: {
    label: "Agent",
    plural: "Agents",
    glyph: "◬",
    blurb: "Specialized sub-agents Claude can delegate to.",
  },
  "mcp-server": {
    label: "MCP Server",
    plural: "MCP Servers",
    glyph: "⎔",
    blurb: "Model Context Protocol servers registered in settings.",
  },
  "enabled-plugins": {
    label: "Enabled Plugins",
    plural: "Enabled Plugins",
    glyph: "🔌",
    blurb: "List of active plugins in settings.json.",
  },
};
