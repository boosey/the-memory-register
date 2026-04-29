# the-memory-register — Design & PRD (v1)

**Date:** 2026-04-22
**Status:** Approved (brainstorming phase)
**Next step:** Implementation plan (via `writing-plans` skill)

---

## 1. Problem

Claude Code's configuration surface is large, layered, and invisible. A single "Claude Code life" pulls from:

- **Global scope:** `~/.claude/CLAUDE.md`, `~/.claude/settings.json`, `~/.claude/keybindings.json`, `~/.claude/skills/`, `~/.claude/commands/`
- **Slug scope (per-project auto-memory):** `~/.claude/projects/<slug>/memory/MEMORY.md` + typed memory files (`user_*.md`, `feedback_*.md`, `project_*.md`, `reference_*.md`), plus session transcripts (`*.jsonl`)
- **Plugin scope:** skills and slash commands contributed by installed plugins under `~/.claude/plugins/`
- **Project scope:** `<project>/CLAUDE.md`, `<project>/.claude/settings.json`, `<project>/.claude/skills/`, `<project>/.claude/commands/`
- **Local scope:** `<project>/CLAUDE.local.md`, `<project>/.claude/settings.local.json`

Each of those files can also `@path/to/file` import other markdown, creating a dependency graph that no user holds in their head. The result:

- Instructions drift (stale references like old GitHub org names persist across sessions).
- Duplicate or contradictory entries accumulate across scopes.
- Users cannot answer "where does *this* instruction live, and what overrides it?" without grepping.
- Learnings from sessions never get codified at the right scope.
- Bloat grows unchecked; no one prunes.

Existing tools do not solve this end-to-end: Claude Code's built-in `/memory` opens one file at a time; MCP memory servers (`basic-memory`, `memory-bank-mcp`, self-hosted `mem0`) address individual memory storage but not the whole config graph.

## 2. Core Tenet

**The UI never treats the user as a markdown editor.** Intent, scope, and relationship are first-class concepts in every screen. Files are implementation details. Raw markdown is the escape hatch, not the default.

Every view answers *"what does this mean / where does it apply / what overrides it"* before *"what does this say."*

## 3. Product

**Name:** `the-memory-register`
**Form:** Local-only web app. Runs on the user's machine. No cloud, no auth, no service dependencies.
**Invocation:** `npx the-memory-register` or `bunx the-memory-register` — starts a local Next.js server on an ephemeral port and opens the default browser automatically. Ctrl-C exits.
**Target user:** Claude Code power users managing 5+ projects with non-trivial per-project configuration.

## 4. Staging (Roadmap)

| Version | Theme | Scope |
|---|---|---|
| **v1** | The Map + The Editor | Crawl, visualize, and edit every config artifact across every scope. No LLM. |
| v2 | Editor polish | Advanced diff UX, safe renames across imports, bulk operations. |
| v3 | The Critic | LLM-powered consolidation: find duplicate/contradictory entries across scopes, dead imports, entries that should move up or down the hierarchy. |
| v4 | The Hygienist | Parse recent session transcripts, detect drift (repeated corrections, stale references), propose memory edits. The genuinely novel piece. |

**This document specifies v1 only.** v2–v4 are roadmap context; each will get its own spec.

## 5. v1 Scope

### 5.1 Stack

- **Framework:** Next.js 15 (App Router)
- **Runtime:** React 19, TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Graph:** React Flow
- **Code/markdown editor (escape hatch):** Monaco
- **Distribution:** npm package, invoked via `npx the-memory-register` / `bunx the-memory-register`

### 5.2 Primary View — Hybrid

Three interlocking modes, sharing one underlying node/edge graph:

1. **Scope-layered inventory (default).** Columns for each scope (Global / Slug / Plugin / Project / Local). Within each column, artifacts are grouped by type (CLAUDE.md sections, skills, commands, settings, hooks, memory). Items are cards with title + short intent summary + author badge (Anthropic-official / community-authored / you / unknown — see §5.6.2). A "Show connections" toggle overlays import/override edges between columns. Top-bar filters include author ("Anthropic only", "Community only", specific author name).
2. **Graph tab.** Full-canvas React Flow rendering of the same graph. Filters for scope, artifact type, and edge type. Zoom and drag.
3. **Side panel editor.** Opens on click of any artifact in either mode. See §5.5.

### 5.3 Node Model — Hybrid

- **Entry-level nodes** (one node per conceptual unit, multiple per file):
  - CLAUDE.md sections, parsed by heading tree
  - `settings.json` entries: each permission rule, each hook, each env var, each top-level setting key
  - `MEMORY.md` index entries
- **File-level nodes** (one node per file):
  - Skills (already one file per skill, with frontmatter)
  - Slash commands (one `.md` per command)
  - Typed memory files (`user_*.md`, `feedback_*.md`, `project_*.md`, `reference_*.md`)
  - Keybinding sets (`keybindings.json`)

Each node carries: `id`, `type`, `scope`, `sourceFile`, `title`, `intentSummary`, `author` (see §5.6.2), `rawContent`, `structuredData` (where applicable).

**`intentSummary` derivation (v1, no LLM):** derived deterministically from structural signals in this order:
1. Frontmatter `description` field, if present (skills, typed memory files).
2. First sentence of the body after the title/heading, truncated to ~120 chars.
3. For settings entries: a generated label from the key path and value (e.g., `permissions.allow[2] → "Bash(git *)"`).
4. For keybindings: the human-readable action name from the JSON.

No LLM is called. If none of the above produces anything, the summary is empty and the card shows only the title.

### 5.4 Edges

Four edge types:

- **imports** — explicit `@path/to/file` reference from one artifact's content into another file
- **overrides** — same logical artifact exists at multiple scopes; edge direction points from overridden to winner; precedence rule annotated
- **plugin-provides** — plugin node → skill/command node it contributes
- **contains** — scope root → its top-level artifacts

#### 5.4.1 Override Identity and Precedence

**"Same logical artifact" identity rule (per artifact type):**

| Artifact type | Identity key |
|---|---|
| CLAUDE.md section | Exact heading text + heading level, compared across scopes |
| Skill | `name` field from frontmatter |
| Slash command | Filename (without `.md`) + command namespace |
| Permission rule | Exact rule string (e.g., `Bash(git *)`) |
| Hook | `matcher` + `hooks[].type` combination |
| Env var (settings) | Env var name |
| Typed memory file | `name` field from frontmatter |
| Keybinding | Key chord string |

**Scope precedence (winner on conflict, high → low):**

1. **Local** (`<project>/CLAUDE.local.md`, `<project>/.claude/settings.local.json`) — explicitly per-user, highest.
2. **Project** (`<project>/CLAUDE.md`, `<project>/.claude/*`) — repo-committed.
3. **Slug** (`~/.claude/projects/<slug>/memory/*`) — auto-memory, per-project-per-user.
4. **Plugin** (`~/.claude/plugins/.../`) — installed plugins.
5. **Global** (`~/.claude/*`) — user defaults, lowest.

For `CLAUDE.md` content merges, Claude Code itself concatenates rather than overrides; the-memory-register reflects this by rendering a "merge" relationship for CLAUDE.md sections at different scopes *rather than* an override, **unless** the same heading exists at a higher scope — which is treated as override (later-scope heading wins for entries within it).

### 5.5 Side Panel Editor

When a node is clicked:

- **For typed artifacts** (permissions, hooks, typed memory, skill frontmatter, individual settings keys): render a **structured form** with field-level labels, validation, and help text. No raw markdown visible.
- **For CLAUDE.md sections:** render a **section editor** — the heading is a prominent title field; the body is a rich-text/markdown composer with live preview; other sections in the same file are listed as sibling navigation in the panel.
- **For any artifact:** a "View raw markdown" button opens a Monaco editor as the **escape hatch**. Changes made here round-trip back to the structured view on save.

Every editor submits through the save pipeline (§5.8).

### 5.6 Discovery

**Slug-reverse from `~/.claude/projects/<slug>/`.** Claude Code already maintains a directory per project it has interacted with; those slugs decode back to project paths (e.g., `C--Users-boose-projects-the-memory-register` ↔ `C:\Users\boose\projects\the-memory-register`).

Discovery algorithm:

1. List subdirectories of `~/.claude/projects/`.
2. For each slug, decode to a project path. If the project path exists, include it as an active project; otherwise flag the slug as **dead** (shown in UI as a separate "Ghost slugs" section for cleanup).
3. For each active project path, crawl all Project and Local scope files (see inventory below).
4. For each slug, also crawl its `memory/` subdirectory and count `*.jsonl` session transcripts.
5. Crawl `~/.claude/` (Global scope) and `~/.claude/plugins/` (Plugin scope).

No user configuration. No directory scanning outside `~/.claude/` and decoded project paths.

#### 5.6.1 File Inventory — Exactly What Gets Crawled

Settings files are **explicitly in scope at every applicable level**. Full inventory:

| Scope | Path pattern | Artifact type produced |
|---|---|---|
| Global | `~/.claude/CLAUDE.md` | CLAUDE.md sections (entry-level nodes) |
| Global | `~/.claude/settings.json` | Settings entries: permissions, hooks, env, other keys (entry-level) |
| Global | `~/.claude/keybindings.json` | Keybinding set (file-level) |
| Global | `~/.claude/skills/**/SKILL.md` | Skill (file-level) |
| Global | `~/.claude/commands/**/*.md` | Slash command (file-level) |
| Slug | `~/.claude/projects/<slug>/memory/MEMORY.md` | MEMORY.md index entries (entry-level) |
| Slug | `~/.claude/projects/<slug>/memory/*.md` (non-index) | Typed memory files (file-level) |
| Slug | `~/.claude/projects/<slug>/*.jsonl` | Session transcript **metadata only** (§5.7) |
| Plugin | `~/.claude/plugins/**/SKILL.md` | Skill contributed by plugin (file-level) |
| Plugin | `~/.claude/plugins/**/commands/*.md` | Slash command contributed by plugin (file-level) |
| Plugin | `~/.claude/plugins/**/plugin.json` (or equivalent manifest) | Plugin metadata node (file-level) |
| Project | `<project>/CLAUDE.md`, `<project>/AGENTS.md`, `<project>/GEMINI.md` | CLAUDE.md sections (entry-level) |
| Project | `<project>/.claude/settings.json` | Settings entries (entry-level) |
| Project | `<project>/.claude/skills/**/SKILL.md` | Skill (file-level) |
| Project | `<project>/.claude/commands/**/*.md` | Slash command (file-level) |
| Local | `<project>/CLAUDE.local.md` | CLAUDE.md sections (entry-level) |
| Local | `<project>/.claude/settings.local.json` | Settings entries (entry-level) |

`settings.json` at Global, Project, and Local scopes is parsed into entry-level nodes (one per permission rule, one per hook matcher, one per env var, one per other top-level key) so that individual rules can be visualized, overridden, and edited independently rather than as an opaque blob.

**Notes:**
- `AGENTS.md` / `GEMINI.md` (cross-agent-vendor memory files) are treated as aliases of `CLAUDE.md` for discovery purposes; the spec follows whichever the project actually uses.
- Plugin manifest format varies across plugin sources; v1 uses a best-effort heuristic and falls back to filesystem layout if no manifest is found (tracked as an implementation detail in §13).
- Anything not listed above is out of scope for v1 crawling.

#### 5.6.2 Author / Provenance Resolution

Trust and provenance are first-class in v1. The "official" Claude Code plugin ecosystem is a mix of Anthropic- and community-authored artifacts; users need to see at a glance which is which when deciding what to keep, debug, or remove.

Every node resolves an `author` field during crawl via this precedence:

1. **Plugin-contributed artifact (Plugin scope):** `author` comes from the plugin manifest (`plugin.json` / `.claude-plugin/plugin.json`). Primary source is the manifest's `author` (string) or `authors[0]` (if array). If the manifest includes `publisher` or `vendor`, that is captured as a secondary `publisher` field.
2. **Skill or command with `author` in frontmatter:** frontmatter `author` wins if present.
3. **User-authored artifact (Global, Project, Local, Slug):** `author = "self"` (rendered as "You" in UI) unless frontmatter says otherwise.
4. **Unknown / unresolvable:** `author = null` (rendered as "unknown" with a warning icon — nudges the user to investigate or attribute).

**Special marker:** when `author` string matches `/^anthropic(\s|$|,)/i` or the plugin manifest's `publisher` is `"anthropic"`, the artifact gets an `isOfficial: true` flag. UI renders an Anthropic badge on official artifacts and a distinct style on community-authored ones — so a glance at the inventory tells the user which parts of their setup are vendor-supported vs community-contributed.

**`author` is a filterable and groupable facet** in both the inventory and graph views. Use cases:
- "Show me every skill authored by X"
- "Show me only Anthropic-official skills"
- "Show me every community-authored artifact in my Global scope"

No network calls. No package-registry lookups. Author resolution is purely from local files on disk.

### 5.7 Session Transcripts in v1

**Metadata only.** Each slug card displays:

- Session count
- Last active date
- Total turns (cheap to count from JSONL line counts)

Transcripts are **not** nodes in v1. They are source material for v4 (The Hygienist); treating them as first-class before we can analyze them adds visual noise without value.

### 5.8 Edit Safety

Every save passes through this pipeline:

1. **Diff preview screen.** User sees before/after of the affected file, with changed regions highlighted.
2. **Timestamped backup.** Before the file is overwritten, the original is copied to `~/.claude/the-memory-register-backups/<YYYY-MM-DDTHH-MM-SS>/<relative/path>`.
3. **Save.**
4. **Undo button** appears briefly in a toast and permanently in the artifact's side panel. Undo restores from the most recent backup for that file.

No git integration, no fancy history — just "oh shit" insurance that covers the likely failure modes.

### 5.9 Persistence

**None.** The filesystem is the source of truth. Every page load re-crawls and re-parses, with results cached in memory for the session only.

The only app-owned state is **view preferences** (active tab, filter selections, sidebar width), stored in `~/.claude/the-memory-register-settings.json`. If crawl performance ever degrades past a few hundred milliseconds, a crawl-result cache file can be added; v1 does not include one.

### 5.10 Launch

`npx the-memory-register` (or `bunx the-memory-register`):

1. Starts Next.js on an ephemeral localhost port (tries 5174, 5175, 5176… until one is free).
2. Opens the default browser to that URL.
3. Keeps running until Ctrl-C.
4. On port conflict it fails with a clear message listing the ports it tried.

No setup screen. No config wizard. First run is indistinguishable from the hundredth.

## 6. Explicit Non-Goals for v1

- LLM-powered suggestions of any kind (→ v3+)
- Transcript parsing or drift detection (→ v4)
- Consolidation or dedup recommendations (→ v3)
- Cross-machine sync
- Auth / multi-user
- Desktop packaging (Tauri/Electron wrapper) — deferred to v2+
- Editing non-markdown/non-JSON config files (e.g., hook scripts themselves)
- Git-style change history beyond the single-level Undo

## 7. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Browser (localhost:<port>)                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Next.js App Router UI (React 19)                   │  │
│  │  - Inventory view  - Graph view  - Editor panel    │  │
│  └──────────────┬─────────────────────────────────────┘  │
└─────────────────┼────────────────────────────────────────┘
                  │ fetch
┌─────────────────┼────────────────────────────────────────┐
│  Next.js server (Node)                                   │
│  ┌──────────────▼─────────────────────────────────────┐  │
│  │ API routes / server actions                        │  │
│  │  GET  /api/graph         - full crawl + parse      │  │
│  │  GET  /api/artifact/:id  - fetch one node's detail │  │
│  │  POST /api/save          - diff + backup + write   │  │
│  │  POST /api/undo          - restore from backup     │  │
│  │  GET  /api/settings      - view prefs              │  │
│  │  POST /api/settings      - persist view prefs      │  │
│  └──────────────┬─────────────────────────────────────┘  │
│  ┌──────────────▼─────────────────────────────────────┐  │
│  │ Core library (pure TS, unit-testable)              │  │
│  │  - Crawler (discovery §5.6)                        │  │
│  │  - Parsers (CLAUDE.md, settings.json, frontmatter) │  │
│  │  - Graph builder (nodes + edges §5.3–5.4)          │  │
│  │  - Save pipeline (diff + backup §5.8)              │  │
│  └──────────────┬─────────────────────────────────────┘  │
└─────────────────┼────────────────────────────────────────┘
                  │ fs
                  ▼
         ~/.claude/  + project dirs (slug-reverse)
```

**Module boundaries:**

- **Crawler** — knows filesystem layout; produces an unparsed `ArtifactManifest`. Does not know about parsing formats.
- **Parsers** — each format (CLAUDE.md, settings.json, skill frontmatter, MEMORY.md) is a module with a `parse(rawContent) → ParsedArtifact` function and a `serialize(parsedArtifact) → string` function. Round-trip safe.
- **Graph builder** — consumes parsed artifacts, resolves `@imports`, detects overrides by logical identity, emits node/edge graph. No FS I/O.
- **Save pipeline** — takes edits, applies to parsed form, re-serializes, runs diff, writes backup, overwrites file.

The core library is pure TS with no Next.js dependencies, so it can be unit-tested without a server and reused in future CLI or desktop wrappers.

## 8. Data Flow — Load

1. Browser requests `/api/graph`.
2. Crawler lists `~/.claude/projects/<slug>/`, decodes slugs, walks each project, walks globals and plugins.
3. Each discovered file is passed to the appropriate parser; parse errors become artifact-level warnings (artifact still shown, flagged).
4. Graph builder resolves `@imports` (by path resolution relative to each containing file), detects overrides, emits nodes and edges.
5. Result JSON returned to browser; inventory and graph views render from the same payload.

## 9. Data Flow — Edit

1. User clicks a node → side panel opens, fetches `/api/artifact/:id` for full structured detail.
2. User edits via form (or raw Monaco).
3. User clicks Save → diff preview screen renders.
4. User confirms → `POST /api/save` with the new parsed form.
5. Server: re-serialize, compute diff vs current on-disk content, write backup, overwrite file.
6. Undo toast appears; server returns new artifact state.
7. Graph refreshes the affected node and any dependent edges (e.g., if an `@import` was added/removed).

## 10. Error Handling

- **Parse failures:** artifact appears in UI with a "could not parse" badge and a "View raw" fallback; does not break the graph.
- **Missing imports:** `@path/to/file` pointing to a non-existent file becomes a **dead-import** edge, rendered in red with a "broken" indicator.
- **Dead slugs:** project path no longer exists → slug listed under "Ghost slugs" with a one-click "Remove this slug directory" action (with backup).
- **FS permission errors:** artifact shown with a lock icon and the specific error; edit actions disabled for that artifact.
- **Port conflict on launch:** fail fast with a clear message listing attempted ports; suggest `PORT=xxxx npx the-memory-register`.
- **Concurrent edits:** if a file's mtime changed between load and save, the save is blocked with a clear "file changed on disk; reload?" prompt.

## 11. Testing

- **Unit tests:** parsers (parse → serialize round-trip), graph builder (override detection, import resolution, edge generation), crawler (mocked filesystem).
- **Integration tests:** end-to-end load against a fixture `.claude/` tree with representative artifacts across all scopes.
- **Manual smoke test checklist** for v1 sign-off:
  - Launch: `npx the-memory-register` opens browser, crawl completes in <10s on a tree with ≥20 projects.
  - Inventory view: every scope column populated with expected artifact counts.
  - Graph view: every `@import` in a test fixture is rendered as an edge.
  - Override detection: a project-level CLAUDE.md override of a global section is detected and visualized.
  - Edit: structured-form edit of a permission entry → diff preview → save → backup file exists → undo restores.
  - Dead slug: a slug whose project dir has been renamed appears under "Ghost slugs."
  - Dead import: a CLAUDE.md with a bogus `@./missing.md` renders a red dead-import edge.

## 12. Success Criteria

1. From a cold `npx the-memory-register`, every artifact across every scope is rendered in under 10 seconds of crawl time.
2. For any artifact, the user can see its scope, content, and override status in ≤2 clicks.
3. The user can edit any artifact (structured form preferred, Monaco escape hatch available), preview the diff, save, and undo — without leaving the app.
4. The user can answer "what does this CLAUDE.md import and where does each imported file live" without reading any markdown.
5. First-run experience is one command → browser opens → map populated. No setup screen, no config file, no prompts.

## 13. Open Questions (Deferred to Implementation)

- Exact default port range and browser-opening library (Node's native ability vs `open` package).
- Precise heading-parse strategy for CLAUDE.md (ATX only, or ATX + Setext; nested heading trees vs flat).
- Whether MDX or pure markdown parser is needed for CLAUDE.md (leaning pure markdown — MDX is overkill).
- Plugin manifest format for `plugin-provides` edges — may vary by plugin source (official catalog vs custom); v1 can start with a best-effort heuristic.

These are implementation details, not design decisions. Resolved during the `writing-plans` pass.
