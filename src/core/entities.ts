// Canonical data model for the-memory-register v1.6+ — Entity, Relation, Detection, PseudoNode.
// Consumed by /api/graph and every UI surface.
//
// Earlier internal shapes (ArtifactNode / GraphEdge in types.ts) continue to exist
// during crawling and parsing; the transform layer in src/core/graph/transform.ts
// lifts them into the Entity shape exported here.

// ── Scopes ───────────────────────────────────────────────────────────────────

export type Scope = "global" | "slug" | "project" | "local";

export const SCOPE_ORDER: readonly Scope[] = [
  "global",
  "slug",
  "project",
  "local",
] as const;

// Precedence: later scopes win on conflict (local > project > slug > global).
export const SCOPE_PRECEDENCE: Record<Scope, number> = {
  global: 1,
  slug: 2,
  project: 3,
  local: 4,
};

// ── Entity types ─────────────────────────────────────────────────────────────

export type EntityType =
  | "standing-instruction"
  | "permission"
  | "plugin"
  | "skill"
  | "command"
  | "memory"
  | "hook"
  | "env"
  | "keybinding"
  | "agent"        // new in v1.6 — ~/.claude/agents/**/*.md + project agents
  | "mcp-server"   // new in v1.6 — extracted from settings.json mcpServers
  | "enabled-plugins"; // new — extracted from settings.json enabledPlugins

export const ENTITY_TYPE_ORDER: readonly EntityType[] = [
  "standing-instruction",
  "permission",
  "plugin",
  "skill",
  "command",
  "memory",
  "hook",
  "env",
  "keybinding",
  "agent",
  "mcp-server",
] as const;

// ── Provenance buckets ───────────────────────────────────────────────────────

export type AuthorBucket = "anthropic" | "community" | "you" | "unknown";

// ── Entity ───────────────────────────────────────────────────────────────────

export interface Entity {
  id: string;
  type: EntityType;
  scope: Scope;
  author: AuthorBucket;
  title: string;
  intent: string;

  // Identity key for override grouping (same logical artifact at different scopes).
  // Identical keys across different scopes form a "tournament bracket" row in the UI.
  identity?: string;

  // For standing-instruction: @path references extracted from body.
  imports?: string[];

  // mtime-drift: slug.lastActiveMs - this.mtimeMs > STALE_THRESHOLD_DAYS.
  stale?: boolean;

  // warn = author === 'unknown' && scope === 'plugin'.
  warn?: boolean;

  // When scope === 'plugin', the plugin's name.
  plugin?: string;

  // When scope === 'slug', the slug's decoded name.
  slugRef?: string;

  // Filesystem provenance carried through so the UI can render "Writes to"
  // and the save pipeline can route edits back to disk.
  sourceFile: string;
  scopeRoot: string;
  mtimeMs: number;
  rawContent: string;
  entryKey?: string | undefined;

  // Parse / dead-import signalling — shown as badges on the row.
  parseError?: string;
  hasDeadImports?: boolean;
  isInformational?: boolean;

  // Whether the entity is active in the current environment.
  // Defaults to true for most types; explicitly false for disabled MCPs/Plugins.
  enabled?: boolean;
  disabledReason?: "plugin" | "config";

  // Type-specific parsed data for editors in v1.7. `unknown` by design —
  // per-type editor components narrow via the `type` discriminant.
  structured?: unknown;
}

// ── Relation ─────────────────────────────────────────────────────────────────

export type RelationKind =
  | "provides"
  | "invokes"        // Vocabulary retained; v1.6 emits zero edges.
  | "gates"
  | "imports"
  | "fires-on"
  | "accretes-from";

export interface Relation {
  id: string;
  kind: RelationKind;
  from: string;      // Entity.id OR PseudoNode.id
  to: string;        // Entity.id OR PseudoNode.id
  note?: string;
  broken?: boolean;  // Replaces the old `dead-import` edge kind.
}

// ── Pseudo-nodes ─────────────────────────────────────────────────────────────
// Targets of relations that aren't themselves Entities. Pinnable in the UI.

export interface SlugPseudoNode {
  id: string;                // 'slug:<name>'
  kind: "slug";
  name: string;              // decoded slug (e.g. 'the-memory-register')
  projectPath: string;
  sessionCount: number;
  lastActiveMs: number;
  isGhost: boolean;          // true when projectPath doesn't exist on disk
}

export interface ToolPseudoNode {
  id: string;                // 'tool:<matcher>'
  kind: "tool";
  matcher: string;           // verbatim: 'Bash', '*', 'Write', 'Bash|Edit', 'Read(~/.ssh/**)'
}

export interface PathPseudoNode {
  id: string;                // '@<path>'
  kind: "path";
  path: string;              // verbatim import reference
  broken: boolean;           // true when import target doesn't exist on disk
}

export type PseudoNode = SlugPseudoNode | ToolPseudoNode | PathPseudoNode;

// Helpers for constructing pseudo-node IDs. Use these exclusively — never
// build pseudo-node IDs inline, or synchronization between emitters and
// the pseudo-node registry will drift.
export const pseudoNodeId = {
  slug: (name: string) => `slug:${name}`,
  tool: (matcher: string) => `tool:${matcher}`,
  path: (atPath: string) =>
    atPath.startsWith("@") ? atPath : `@${atPath}`,
} as const;

// ── Detections ───────────────────────────────────────────────────────────────
// Conventions recognized on disk but not yet modeled as first-class entities
// or relations. Rendered in the footer accordion; the counts prioritize
// future modeling work.

export interface DetectionOccurrence {
  sourceFile: string;
  excerpt?: string;
}

export interface Detection {
  convention: string;       // stable registry key — used as React key and to dedupe
  label: string;            // human-facing
  occurrences: DetectionOccurrence[];
}

// Registry of conventions the-memory-register watches for. Adding a new convention here
// means the accordion will render it (once parsers start emitting). Removing
// means the convention has graduated to a first-class model.
export const DETECTION_CONVENTIONS = {
  SKILL_REFERENCES_IMPORT: {
    key: "skill-references-import",
    label: "@references/ imports inside skill bodies",
  },
  PLUGIN_SUB_AGENTS: {
    key: "plugin-manifest-subagents-field",
    label: "Plugin manifest `subAgents` field",
  },
  PLUGIN_MCP_SERVERS_UNPARSED: {
    key: "plugin-manifest-mcp-servers-unparsed",
    label: "Plugin manifest `mcpServers` field (not yet extracted per-server)",
  },
  SETTINGS_UNKNOWN_TOP_LEVEL: {
    key: "settings-unknown-top-level-key",
    label: "Unknown top-level key in settings.json",
  },
  CMD_BODY_REFERENCES_ENTITY: {
    key: "command-body-references-entity",
    label: "Command body references another entity by name (invokes candidate)",
  },
  SKILL_BODY_REFERENCES_ENTITY: {
    key: "skill-body-references-entity",
    label: "Skill body references another skill by name (invokes candidate)",
  },
} as const;

export type DetectionConventionKey =
  (typeof DETECTION_CONVENTIONS)[keyof typeof DETECTION_CONVENTIONS]["key"];

// ── Errors ───────────────────────────────────────────────────────────────────

export interface EntityParseError {
  entityId: string;
  message: string;
}

// ── Top-level API payload ────────────────────────────────────────────────────
// Shape returned by GET /api/graph. Replaces the v1 Graph shape.

export interface GraphPayload {
  entities: Entity[];
  relations: Relation[];
  pseudoNodes: PseudoNode[];
  detections: Detection[];
  parseErrors: EntityParseError[];
  crawledAtMs: number;
}

// ── Health thresholds ────────────────────────────────────────────────────────

export const STALE_THRESHOLD_DAYS = 14;
export const STALE_THRESHOLD_MS = STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
