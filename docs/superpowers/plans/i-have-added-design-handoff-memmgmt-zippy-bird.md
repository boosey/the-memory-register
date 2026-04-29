# the-memory-register v1.6 + v1.7 — Implement new UX from `design_handoff_the-memory-register/`

## Context

The shipped v1 UI (scope columns of stacked cards + a right-side structured editor) is "unusable" per the user. A new high-fidelity prototype has landed at `C:\Users\boose\projects\the-memory-register\design_handoff_the-memory-register\` — a row-per-entity signal-flow layout with scope lanes, tournament-bracket connectors, 9 type-dispatched inline editors, bulk actions, a health ribbon, and an editorial oklch token system.

Delivering this is **not** a UX swap — it's v2 + part of v3 on the v1 PRD's roadmap. It requires:

- A richer data model (`Entity` with author buckets, `identity` exposed, `stale`/`warn` flags, `imports[]` array)
- Four new relation derivations (`accretes-from`, `fires-on`, `gates`, plus `provides` expansion), a `broken` flag collapsing the old `dead-import` edge kind, and explicit deferral of `invokes` to a detection-driven followup
- Two new first-class entity types (`agent`, `mcp-server`) that don't appear in the handoff but exist extensively in the user's actual `~/.claude/plugins/` install
- Complete typography + token replacement (Inter Tight + JetBrains Mono + oklch ink/paper/provenance palette), dropping dark mode
- A detections accordion pattern for surfacing recognized-but-unmodeled conventions with user-facing counts that drive prioritization
- Deletion of the entire old component tree (`InventoryView`, `ScopeColumn`, `ArtifactCard`, `TopBar`, `ConnectionOverlay`, `GhostSlugsPanel`, `GraphView`, `EditorPanel`) on day one of v1.6

The core library (`src/core/*`), save pipeline, and API route shapes survive largely intact. Only the `/api/graph` payload shape changes.

## Shipping shape — two merges

| Merge | Scope | What the user sees |
|---|---|---|
| **v1.6 — Foundation** | Data-model expansion + new tokens + signal-flow read-only view + detections accordion + 11 entity types crawled | Full new visual layout; agent + mcp-server tabs; can browse but can't edit in structured forms (raw Monaco only for v1.6). E2E suite rewritten against new selectors. |
| **v1.7 — Editor + Interaction** | Inline editor drawer + all 9 type-dispatched forms + Preview-diff + Undo toast + full Convert-to-Skill file-layer move + bulk action bar + filterable health ribbon + Move Scope / Resolve Conflict tabs | Fully interactive app. Feature-complete against the handoff. |

Agent + mcp-server get **read-only rows + raw-Monaco edit fallback in both v1.6 and v1.7**. Proper structured forms for them are a v1.8 task the user will design themselves.

## Decisions locked (reference)

- **Entity types:** 11 total — the 9 handoff types + `agent` + `mcp-server`. Type name `slash-command` → `command` everywhere (core + fixtures + tests).
- **Relations:**
  - `provides` — expanded to plugin → `{skill, command, agent, mcp-server}`
  - `imports` — flatten `dead-import` into `broken: true`; resolve target to entity when possible, else `@path` pseudo-node
  - `accretes-from` — `memory → slug:<name>` pseudo-node; note = `"<N> sessions"`; mtime-based `stale` included
  - `fires-on` — `hook → tool:<matcher>` pseudo-node; matcher verbatim (no splitting); shares pseudo-node pool with `gates`
  - `gates` — `permission → tool:<prefix>` pseudo-node; prefix-only (not prefix+pattern); mechanical note `{effect} · {pattern}`; no effect coloring on pill
  - `invokes` — vocabulary retained, zero edges emitted; candidate conventions routed to detections
- **Pseudo-nodes:** `slug:<name>`, `tool:<matcher>`, `@<path>` all pinnable with tracing banner
- **Detections:** footer accordion, grouped by convention, deduped with counts; initial registry ≥ skill `@references/`, plugin manifest `subAgents`, plugin manifest unparsed `mcpServers`, unknown settings.json top-level keys, command/skill bodies referencing other entities
- **Unknown frontmatter fields:** silent preservation with in-editor note `"N unknown fields preserved: <names>"` and value on hover
- **Tokens:** full replacement of `globals.css`; Inter Tight + JetBrains Mono via Next.js font loader; dark mode dropped
- **Stubs in v1.7:** Preview-diff modal, Undo toast, full Convert-to-Skill file-layer move (backup + rewrite + delete + relation rewrite)

## v1.6 — Foundation

### Goals
1. Full Entity/Relation/Detection data model exposed on `/api/graph`
2. Crawler + parsers extended to `agent` and `mcp-server`
3. Four new relation derivations (`accretes-from`, `fires-on`, `gates`, expanded `provides`), `imports` flattened, `invokes` deferred cleanly
4. Signal-flow layout rendering: Masthead, static HealthRibbon (filterable lands in v1.7), TypeTabs, SchematicHeader, SignalRow (with SignalNode cells + Composite + RelationPills), Footer (ProvenanceLegend + DetectionsAccordion)
5. Complete token + typography replacement
6. Old UI deleted
7. E2E specs rewritten against new DOM

### Files — create

| Path | Purpose |
|---|---|
| `src/core/entities.ts` | New `Entity`, `Relation`, `Detection` types (supersedes the old `ArtifactNode`/`GraphEdge` shape in `types.ts`, which stays for internal use during the transform) |
| `src/core/graph/pseudoNodes.ts` | Registry for `tool:`, `slug:`, `@path` pseudo-nodes; lazy creation; supports pinning-target lookups |
| `src/core/graph/relations.ts` | Per-kind derivation — pure functions: `deriveProvides`, `deriveImports`, `deriveAccretesFrom`, `deriveFiresOn`, `deriveGates` |
| `src/core/graph/detections.ts` | Detection registry + emitter API (`emit(convention, sourceFile, excerpt?)`); registry seeded with the initial 5 conventions |
| `src/core/graph/transform.ts` | `ArtifactNode[] → Entity[]` + `GraphEdge[] → Relation[]` + author-bucket resolution (`'anthropic' \| 'community' \| 'you' \| 'unknown'`) + identity-key surfacing |
| `src/core/parsers/agent.ts` | Parse `~/.claude/agents/**/*.md` (frontmatter: name, description, tools, model) |
| `src/core/parsers/mcpServer.ts` | Extract `mcpServers` object from settings.json into per-server entities |
| `src/core/health/stale.ts` | Mtime-drift staleness for memories (`slug.lastActiveMs - memory.mtimeMs > 14d`) |
| `src/core/health/warn.ts` | `author === null && scope === 'plugin'` → warn flag |
| `src/components/signal/Masthead.tsx` | Wordmark + edition tag |
| `src/components/signal/HealthRibbon.tsx` | Static chip count view (filterable variant in v1.7) |
| `src/components/signal/TypeTabs.tsx` | 11 tabs with mono count + related-entity dot |
| `src/components/signal/SchematicHeader.tsx` | Grid header row |
| `src/components/signal/SignalRow.tsx` | Row shell — identity + 5 scope cells + composite + relations |
| `src/components/signal/SignalNode.tsx` | Per-scope cell with winner ring / loser fade |
| `src/components/signal/WireSegment.tsx` | SVG bracket connector between non-empty cells |
| `src/components/signal/RelationPill.tsx` | Inbound/outbound/broken pill with click-to-pin |
| `src/components/signal/ScopeTick.tsx` | Smallcaps mono scope label |
| `src/components/signal/Composite.tsx` | Resolved-winner card with ink border + author left-stripe |
| `src/components/signal/Footer.tsx` | ProvenanceLegend + DetectionsAccordion + relation-kind reminder |
| `src/components/signal/DetectionsAccordion.tsx` | Collapsed accordion grouped by convention; counts; expand to show example files; per-row "open followup" action |
| `src/components/signal/ProvenanceLegend.tsx` | 4 author swatches |
| `src/components/signal/TracingBanner.tsx` | Shows when an entity or pseudo-node is pinned (banner body used in v1.6; full interaction in v1.7) |
| `src/hooks/usePinned.ts` | Pinned-entity / pseudo-node state |
| `src/hooks/useSelection.ts` | Bulk-selection state (hooked up to BulkActionBar in v1.7) |
| `src/app/api/graph/route.ts` | Rewrite to return `{ entities, relations, detections, slugMetadata, ghostSlugs, parseErrors, crawledAtMs }` |

### Files — modify

| Path | Change |
|---|---|
| `src/core/discovery/crawler.ts` | Add `~/.claude/agents/**/*.md` walk; add project/local `agents/` walk; extract `mcpServers` from settings.json; emit detections for plugin-manifest fields we skip (`subAgents`, unparsed `hooks`, unparsed `mcpServers`) |
| `src/core/graph/builder.ts` | Wire `derive*` relation emitters; wire detections emission through to output; stop emitting `dead-import` as a distinct kind |
| `src/core/graph/overrideDetector.ts` | Surface `identityKey(node)` on the output so `Entity.identity` can be populated |
| `src/core/parsers/authorResolver.ts` | Add `authorBucket()` helper returning `'anthropic' \| 'community' \| 'you' \| 'unknown'` |
| `src/core/parsers/settings.ts` (and friends) | Extract mcp-server entries; detect & emit for unknown top-level settings keys |
| `src/app/page.tsx` | Replace all content with new signal-flow mount — no more two-tab layout, no more right-side EditorPanel |
| `src/app/layout.tsx` | Load Inter Tight + JetBrains Mono via `next/font/google` |
| `src/app/globals.css` | Full palette replacement — ink/paper/provenance oklch tokens; remove dark-mode block |
| `src/lib/serializeByKind.ts` | Add serializers for new entity types (`agent`, `mcp-server`); ensure unknown-frontmatter round-trip for all markdown-backed kinds |
| `src/hooks/useGraph.ts` | Payload shape change (hook contract stays); update return type |

### Files — delete

| Path | Reason |
|---|---|
| `src/components/InventoryView.tsx` | Replaced by signal-flow |
| `src/components/ScopeColumn.tsx` | Replaced |
| `src/components/ArtifactCard.tsx` | Replaced |
| `src/components/TopBar.tsx` | Replaced by Masthead + TypeTabs |
| `src/components/ConnectionOverlay.tsx` | No longer a toggle concept |
| `src/components/GhostSlugsPanel.tsx` | Ghost slugs surface via slug pseudo-node + health ribbon |
| `src/components/GraphView.tsx` | Graph view dropped entirely in new design |
| `src/components/AuthorBadge.tsx` | Re-implemented inline in SignalNode/Composite using the new token palette |
| `src/components/editor/EditorPanel.tsx` | Side-panel shell replaced by EditorDrawer in v1.7 |
| `src/components/editor/StructuredEditor.tsx` | v1.7 introduces per-kind editors in `signal/editors/` |
| `src/components/editor/DiffPreviewModal.tsx` | Will be re-created under `signal/DiffPreviewModal.tsx` in v1.7 |
| `src/components/editor/ClaudeMdSectionEditor.tsx`, `SettingsEntryEditor.tsx`, `SkillEditor.tsx`, `MemoryEditor.tsx`, `KeybindingsEditor.tsx` | All replaced by new type-dispatched editors in v1.7 |
| `tests/e2e/01-crawl-under-10s.spec.ts` through `06-error-states.spec.ts` | Rewritten against the new DOM as part of v1.6 |

### Reuse (verified existing utilities)

- `src/core/save/*` — entire save pipeline survives: `backup.ts` (createBackup, listBackups), `writer.ts` (applyEdit w/ mtime check), `diff.ts` (computeDiff), `undo.ts`. Only reused in v1.7 when the editor drawer lands, but the plumbing stays.
- `src/core/parsers/frontmatter.ts` — round-trip-safe YAML parser via rest-spread; agent parser reuses it.
- `src/core/parsers/command.ts:10–22` — exemplifies the extra-frontmatter preservation pattern that all markdown-backed parsers must follow.
- `src/core/discovery/slugCodec.ts` — slug-reverse for project-path discovery; unchanged.
- `src/core/paths.ts` — `resolveHomePaths()` (plus the v1.5 env-var overrides) remains authoritative.
- `src/app/api/artifact/[id]/route.ts`, `/api/save`, `/api/undo`, `/api/settings` — routes stay. Only `/api/graph` payload shape changes; others consume `id` like today.
- `src/hooks/useArtifact.ts`, `useSave.ts` — untouched; wired to new drawer in v1.7.
- shadcn primitives under `src/components/ui/*` — Button, Dialog, Sheet, Tabs, Input, Textarea, etc. restyle automatically from the new CSS vars; keep.

### Verification (v1.6)

1. `pnpm typecheck` — zero errors.
2. `pnpm test` — all unit tests pass, including new tests for `transform.ts`, `relations.ts`, `detections.ts`, `agent` parser, `mcpServer` parser, stale/warn health.
3. `pnpm test:e2e` — rewritten 6 specs pass, targeting new DOM selectors (SignalRow, TypeTabs, HealthRibbon chips, DetectionsAccordion).
4. `pnpm dev` manual smoke against user's real `~/.claude/`:
   - 11 type tabs render; counts match `ls` in relevant dirs
   - Agent + mcp-server rows appear (confirmed by their presence in the user's plugin install)
   - Footer detections accordion is non-empty (skill `@references/`, plugin `subAgents`, etc.)
   - No references to old components remain (`rg InventoryView src/` returns empty)
   - No dark-mode flashes — single-theme editorial
   - Fonts load (Inter Tight + JetBrains Mono) without FOIT
5. Chrome DevTools MCP audit per v1.5 build convention — console-error scan zero, Lighthouse a11y ≥ 85.

## v1.7 — Editor + Interaction

### Goals
1. Inline EditorDrawer under the active SignalRow (replaces right-side EditorPanel concept)
2. All 9 type-dispatched editor forms (agent + mcp-server remain raw-Monaco fallback)
3. Save pipeline fully wired: Preview-diff (Monaco diff modal), Save with backup, Undo toast
4. BulkActionBar with 7 actions (resolve-to-winner, delete-shadowed, promote/demote scope, dismiss stale, flag for review, delete entity)
5. Filterable HealthRibbon — 4 chips filter SignalRow list; "clear filter" link
6. TracingBanner fully interactive — pin entity OR pseudo-node, show related-entity count across kinds
7. Convert-to-Skill full file-layer move — backup command.md, write skill/<name>.md with body verbatim, delete command, rewrite `provides` relations, warn dialog about invocation-style change
8. Move Scope tab — copy to new scope path, remove from old, update imports
9. Resolve Conflict tab — make-winner, delete, merge-into-winner, keep-as-override

### Files — create

| Path | Purpose |
|---|---|
| `src/components/signal/EditorDrawer.tsx` | Shell: header + tab nav (Edit / Move Scope / Resolve Conflict) + type-dispatch + right rail |
| `src/components/signal/editors/StandingInstructionEditor.tsx` | Heading + BodyEditor + ImportList |
| `src/components/signal/editors/PermissionEditor.tsx` | Tool chips + pattern + effect segmented + reason + live compiled preview |
| `src/components/signal/editors/SkillEditor.tsx` | Name + description + ToolAccessControl + BodyEditor |
| `src/components/signal/editors/CommandEditor.tsx` | Name (/-prefix) + description + args + BodyEditor + ConvertToSkill block |
| `src/components/signal/editors/MemoryEditor.tsx` | Filename + BodyEditor + provenance block + dismiss/re-accrete actions |
| `src/components/signal/editors/HookEditor.tsx` | Event chips + matcher + run-as chips + command textarea + plain-English preview |
| `src/components/signal/editors/EnvVarEditor.tsx` | Var name + value (password-mode) + secret checkbox |
| `src/components/signal/editors/KeybindingEditor.tsx` | Chord table (press-to-capture) + action cells + add chord |
| `src/components/signal/editors/PluginEditor.tsx` | Name + source + enabled + read-only Contains list + warning block |
| `src/components/signal/editors/RawFallbackEditor.tsx` | Monaco fallback for agent + mcp-server (+ "coming in v1.8" banner) |
| `src/components/signal/editors/BodyEditor.tsx` | Shared markdown toolbar + textarea + Form/Markdown toggle + "N unknown fields preserved" note with value-on-hover |
| `src/components/signal/editors/ToolAccessControl.tsx` | Inherit vs restrict radio + chip grid |
| `src/components/signal/editors/ImportList.tsx` | @path rows with broken badges; add input |
| `src/components/signal/editors/RightRail.tsx` | Safety section + Preview diff btn + Save with backup btn + Writes to path |
| `src/components/signal/editors/ScopeMover.tsx` | Scope chips + current/new display |
| `src/components/signal/editors/ResolveConflict.tsx` | Group list + make-winner/delete per row + merge/keep-override |
| `src/components/signal/editors/ConvertToSkill.tsx` | Collapsed/expanded convert-to-skill flow |
| `src/components/signal/BulkActionBar.tsx` | Fixed bottom dark bar; 7 actions + clear link |
| `src/components/signal/DiffPreviewModal.tsx` | Monaco-diff-viewer modal reading from `computeDiff` |
| `src/components/signal/UndoToast.tsx` | Toast wired to `/api/undo` |
| `src/lib/describePath.ts` | `(entity) => filesystem path` — drives Right Rail's "Writes to" |
| `src/lib/permissionPreview.ts` | `{effect, pattern, tool} → "allow · Bash(git *)"` colored preview |
| `src/lib/hookPreview.ts` | `{event, matcher, runAs, command} → "on PreToolUse where tool matches * · run shell: …"` |
| `src/app/api/convert-to-skill/route.ts` | POST: takes `{commandId, newSkillName, newSkillDescription}`; performs file-layer transaction |
| `src/app/api/bulk/route.ts` | POST: takes `{action, entityIds[]}`; dispatches to per-action handlers |
| `src/core/save/convert.ts` | Command → skill transactional move (backup, write skill, delete command, relation-graph rewrite) |
| `src/core/save/bulkOps.ts` | Per-action handlers: resolve-to-winner, delete-shadowed, promote/demote scope, dismiss stale, flag for review, delete entity |

### Files — modify

| Path | Change |
|---|---|
| `src/components/signal/SignalRow.tsx` | Add chevron button (toggles drawer), checkbox (bulk-select), pin/unpin behavior on body click |
| `src/components/signal/HealthRibbon.tsx` | Filterable — clicking a chip filters the visible SignalRows; active chip inverts to filled ink |
| `src/components/signal/TracingBanner.tsx` | Interactive — pin state reflected; "N related entities across M kinds" computed; clear button |
| `src/core/save/writer.ts` | Add `previewDiff(sourceFile, nextContent)` that runs the write simulation and returns `{before, after, hunks}` without touching disk |

### Reuse (v1.7)

- `src/core/save/backup.ts` / `writer.ts` / `diff.ts` / `undo.ts` — now driven by the drawer and toast.
- `src/app/api/save/route.ts`, `/api/undo/route.ts` — consumed by EditorDrawer and UndoToast.
- `src/hooks/useArtifact.ts`, `useSave.ts` — wired to drawer lifecycle.

### Verification (v1.7)

1. `pnpm typecheck` and `pnpm test` pass.
2. `pnpm test:e2e` — one spec per editor form (9 new specs), covering edit → preview diff → save → verify disk → undo → verify disk restored.
3. E2E: Convert-to-Skill — fixture command; convert; assert skill file exists with identical body; command file removed; backup directory contains original; `provides` edges rewired; `/command` invocation no longer exists in graph.
4. E2E: Bulk `resolve-to-winner` — fixture with 2 contested identities; select both; invoke; assert shadowed scope copies deleted; winners preserved; backup directory contains all deleted copies.
5. E2E: Bulk `delete-entity` — confirmation flow; asserts all scope copies removed + backed up.
6. Manual smoke on user's real `~/.claude/`:
   - Edit a real permission → preview diff → save → undo restores
   - Pin a real plugin → trace banner shows correct related-entity count
   - Convert a real slash command to a skill (on a throwaway command) → verify files + relations + backup
   - Bulk-select 3 stale memories → dismiss-stale → stale flags clear
7. Chrome DevTools MCP visual sanity per v1.5 convention on each editor form.

## Out of scope / deferred

| Item | When |
|---|---|
| Structured editor forms for `agent` and `mcp-server` | v1.8 (user designs by analogy to Skill and Hook respectively) |
| `invokes` edge derivation | v1.8+ driven by detections-accordion data; if no candidate conventions accumulate significant counts, drop the kind entirely |
| Session-JSONL memory staleness ("content out of date" vs mtime-drift) | v4 ("The Hygienist") per v1 PRD §4 |
| Dark mode | v1.8+ if demand surfaces |
| Mobile / narrow viewport (<1600px) | v1.8+ — design team to weigh in |
| Plugin install flow | Not in v1 roadmap |
| LLM-powered consolidation | v3 per v1 PRD |

## Critical files to know when executing

- `src/core/entities.ts` *(new)* — the canonical Entity/Relation/Detection shape. Everything else consumes this.
- `src/core/graph/transform.ts` *(new)* — single source for ArtifactNode→Entity lift.
- `src/core/graph/builder.ts` *(modify)* — aggregation point; wire all emitters here.
- `src/app/api/graph/route.ts` *(rewrite)* — the one API contract that changes shape.
- `src/components/signal/SignalRow.tsx` *(new)* — the workhorse component; 80% of the visual identity lives here.
- `src/app/globals.css` *(rewrite)* — palette + typography replacement; affects every downstream component.
- `design_handoff_the-memory-register/variation-c.jsx`, `editors-by-type.jsx`, `shared.jsx` — visual + interaction contract; reference constantly; do not copy inline styles (port to Tailwind + CSS-vars).
