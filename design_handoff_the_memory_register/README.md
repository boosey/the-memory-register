# Handoff: the-memory-register — Claude Code config & memory manager

> A visual, editable map of a Claude Code user's entire configuration surface
> (standing instructions, permissions, skills, memories, hooks, plugins, env
> vars, keybindings) across global / plugin / slug / project / local scopes,
> with tournament-bracket override resolution, relationship tracing, inline
> type-dispatched editors, and bulk pruning.

---

## About the design files

The HTML + JSX files in this folder are **design references**, not
production code. They are an interactive high-fidelity prototype built in
plain React-via-Babel in a single HTML page so we could iterate visually.

Your job is to **recreate these designs in the real the-memory-register codebase** —
wiring them to the actual filesystem watcher, CLAUDE.md parser, override
engine, and live edit layer described in `original-brief.md`. The prototype
runs against mock data (`data.js`); production needs the real data model.

If no codebase exists yet, start a Vite + React + TypeScript app and
re-implement the prototype there as a first milestone.

## Fidelity

**High-fidelity.** Colors, typography, spacing, interaction affordances,
empty/warning/error states, and per-entity-kind editor forms are all
intentional. Recreate them pixel-close in the target codebase. Replace the
inline styles with whatever styling system the codebase uses (CSS modules,
Tailwind, styled-components, etc.) — the tokens are enumerated below.

---

## What's in the box

| File | Role |
|---|---|
| `the-memory-register.html` | Entry point. Loads React + Babel, wires the canvas. |
| `data.js` | Mock data: entities, relations, scopes, authors, health issues. **Replace entirely** — this is the shape the real data model should expose. |
| `design-canvas.jsx` | A pan/zoom canvas wrapper used purely to stage one large artboard. In production the canvas frame is not needed — the app IS the artboard. |
| `shared.jsx` | Editorial typography tokens, masthead, provenance pills, health ribbon, author/scope helpers, override-grouping logic. |
| `variation-c.jsx` | The main screen: entity-kind tabs, signal-flow rows, bulk selection, filter chips, inline editor drawer. |
| `editors-by-type.jsx` | Nine type-dispatched editor forms (standing instruction, permission, plugin, skill, memory, hook, env var, keybinding) + shared shell with Move Scope / Resolve Conflict / Save-with-backup. |
| `original-brief.md` | The full product specification (authoritative for data model, scope resolution, file-layer semantics). |

### How to run the prototype

```sh
# Any static server will do:
python3 -m http.server 8080
# or
npx serve .
```
Open `http://localhost:8080/the-memory-register.html`. No build step.

---

## The one screen

The app is a single-window editor. Think: a thoughtful file manager that
understands Claude Code's object model. It is NOT a settings page with a
sidebar of preferences.

### Masthead (top strip)
- Wordmark "the-memory-register" in Inter Tight, weight 600, letter-spacing −0.02em, ~26px.
- Subtitle to its right in smallcaps: "Trace entities, follow relationships, resolve and prune — all inline."
- Edition tag on the far right, smallcaps + mono: "Signal Edition · v4".
- 1px rule below.

### Health ribbon (sticky under masthead)
Filter chips summarizing issues across the entire config:
- **Contested** (multi-scope entities in conflict) — warn dot
- **Stale memory** (not touched in N days) — info dot
- **Unknown author** (plugins/skills with no provenance) — warn dot
- **Dead imports** (@-references to missing files) — error dot

Each chip is clickable and acts as a filter on the row list. Active chip
inverts to filled ink. Right-aligned: `"2 ghost slugs · N issues"`.

### Tracing banner (only visible when a row is pinned)
Shows the pinned entity's title, kind, and count of related entities
across kinds. "Clear" button. Background = warm tint (oklch(0.97 0.03 55)).

### Entity-kind tabs (primary nav)
Order: **Standing Instructions · Permissions · Plugins · Skills · Slash
Commands · Memories · Hooks · Env Vars · Keybindings**. Underlined active
state, mono count beside each label, a small colored dot when the pinned
entity has relatives in that tab.

### Tracing blurb
One sentence describing what this kind means ("Allow/deny rules for tools
and shell access.") plus an inline "clear filter" link when a health filter
is active.

### Signal-flow body
The heart of the screen. For each logical entity in the current kind, one
row with this grid:

| col | width | content |
|---|---|---|
| checkbox | 22px | select for bulk actions |
| identity | 210px | **28px chevron button** (toggles editor drawer) + title (600 weight) + metadata line (scope count / relation counts) |
| Global | 1fr | scope node (see below) |
| Plugin | 1fr | scope node |
| Slug | 1fr | scope node |
| Project | 1fr | scope node |
| Local | 1fr | scope node |
| Composite | 1.6fr | what Claude actually sees — boxed, 1.5px ink border, provenance-colored left stripe |
| Relations | 1.4fr | outbound + inbound relation pills |

**Scope node** — if the entity is defined at that scope, render a small card
with the scope label (smallcaps mono) and the winning phrase of intent.
Winners of contested entities get an ink border + 1px shadow. Shadowed
losers are 60% opacity with a strikethrough. Right edge of each non-empty
cell has a tiny wire-and-dot SVG "connecting" it rightward to the next
column — the tournament-bracket affordance.

**Empty lane** — a short dashed 1px line centered vertically. Do NOT
render an empty card; the visual "gap" is the message.

**Composite** — the resolved winner. Ink border is intentional. Author
color (Anthropic / Community / You / Unknown) appears as a 3px left stripe.
Below the intent line: author pill + "from <scope>" + "· N shadowed" when
contested.

**Relations pills** — one per outbound relation, then inbound. Pill format:
8.5px mono smallcaps verb on the left, 11.5px sans target name, 9px mono
type label on the right. Outbound = ink left stripe, inbound = muted left
stripe, broken = red border + red left stripe + "missing" badge.

**Row states**
- Hover: no change (cursor pointer)
- Pinned (clicked): warm tint bg + 1px ink inset ring. Pin button (not the
  chevron) is the pin/unpin toggle. In the current design, clicking the row
  body pins it; clicking the chevron button opens the editor drawer.
- Related (to pinned): slightly paler warm tint
- Expanded: deep paper bg + 1px ink inset ring. Chevron button inverts to
  filled ink. Drawer opens beneath the row.

### Inline editor drawer
Renders immediately below the row, full-width, 18px 28px padding. Two-column
grid: main form (1fr) + right rail (320px).

Header row: `Editing · <Kind>` smallcaps + bold entity title + close button.
Tabs: Edit / Move scope / Resolve conflict (only when contested).

Body is **type-dispatched**. Never a generic markdown blob — each kind has a
form tailored to its real shape. See "Per-kind editors" below.

Right rail (always):
- **Safety** section: "Edits preview a diff, write a timestamped backup,
  then apply. Undo is one click."
- Buttons: Preview diff (ghost) · Save with backup (primary)
- **Writes to** block: mono path. Driven by `describePath(winner)` in
  `editors-by-type.jsx`. Display the ACTUAL filesystem path the write will
  go to. This is crucial — users should always know where a change lands.

### Bulk action bar
Appears fixed to the bottom of the artboard when ≥1 row is checked. Dark
ink fill, 4px radius, 12px 28px shadow. Contents left-to-right:
- "SELECTED" smallcaps
- "N entities" bold
- Summary: "N contested · N stale · N flagged"
- Action buttons (ghost, destructive ones in red):
  - Resolve to winner (only if selection contains contested)
  - Delete shadowed (destructive)
  - Promote to higher scope
  - Demote to lower scope
  - Dismiss stale (if any stale selected)
  - Flag for review (if any unknown-author selected)
  - Delete entity (destructive)
- "clear" link

### Footer
1px rule, paper-deep bg. Left = provenance legend (Anthropic / Community /
You / Unknown swatches). Right = mono rule reminder: `override · provides ·
invokes · gates · imports · fires-on · accretes-from`.

---

## Per-kind editor forms

Every form is a structured smart form. Forms that edit a markdown file
expose a **Form / Markdown** toggle so the user can escape to raw when
needed; forms that edit settings.json / keybindings.json do not.

There are **9 editor kinds**: Standing Instruction, Permission, Plugin,
Skill, **Slash Command**, Memory, Hook, Env Var, Keybinding.

Unknown frontmatter fields round-tripped via the Markdown toggle are
preserved invisibly (option (b) from our conversation): don't strip them,
don't show them in the form, show a small "N unknown frontmatter field(s)
preserved" note at the bottom of the editor.

### Standing Instruction (CLAUDE.md section)
- Heading input (rendered as H2 in CLAUDE.md)
- Body editor with toolbar (B / I / H / • / 1. / > / </> / @link) + Form/Markdown toggle
- Imports list: shows `@path` references, flags broken ones red with a "missing" badge, + button + inline input to add new imports
- Writes to: `<scope-path>/CLAUDE.md`

### Permission
- Tool chips: Bash / Read / Edit / Write / WebFetch / * (single-select)
- Pattern input (mono) + preset chips depending on tool (`git *`, `pnpm *`, `~/.ssh/**`, `.env*`, etc.)
- Effect segmented control: **Allow** (green) / **Ask** (amber) / **Deny** (red). Filled when active.
- Optional reason field (stored as comment alongside the rule)
- **Live compiled rule preview** in a dashed-border block: `allow · Bash(git *)` — colored by effect
- No body, no markdown toggle
- Writes to: `<scope-path>/settings.json`

### Plugin
- Name, source (git URL / registry / local path), enabled checkbox
- Read-only "Contains · N" section listing the skills/commands/hooks this
  plugin provides, each row with kind label + name + "open →" link that
  navigates to that entity's tab + pins it + opens its editor
- Warning block (red-bordered) for plugins with `warn: true` (unknown author, old install)
- No body, no markdown toggle
- Writes to: `<scope-path>/<plugin-name>/plugin.json`

### Skill
- Name input (mono, = folder name)
- Description textarea (one line)
- **Tool access** — two radios:
  - "Inherit — all tools allowed" (default, with plain-English explanation)
  - "Restrict to selected tools" (reveals chip grid; shows warning if empty)
- Instructions body editor with Form/Markdown toggle
- Writes to: `<scope-path>/skills/<name>.md`

### Slash Command
- Name input with a fixed `/` prefix affordance (invoked as `/name`)
- Description (one line, shown in the command palette)
- Arguments field — defaults to `$ARGUMENTS` placeholder, referenced from body
- Prompt body editor with Form/Markdown toggle — this is the text sent to
  Claude when the user runs the command
- **Convert to Skill** block (left-striped in Anthropic blue, paper-deep bg):
  - Collapsed: explanatory paragraph + "Convert to Skill…" button
  - Expanded: review form with `Skill name` + `Skill description` inputs
    (prefilled from command name/intent), followed by a dashed "What this
    does" checklist explaining the 4 concrete changes (write new skill file,
    back up + delete command file, rewrite relations, slash invocation
    stops working). Buttons: **cancel · Preview conversion diff · Convert
    & back up**.
  - Conversion is a file-layer move + frontmatter rewrite, not a re-author:
    prompt body carries over unchanged. Only invocation style changes
    (explicit `/name` → auto-invoke when description matches).
- Writes to: `<scope-path>/commands/<name>.md`

### Memory
- File name input (mono)
- Body editor with Form/Markdown toggle
- **Provenance block** (paper-deep bg): "Accreted from slug:<slug>" + note + "stale (14d)" if applicable
- Action buttons: Re-accrete from recent sessions · View source turns · Dismiss memory (red)
- Writes to: `<scope-path>/<filename>`

### Hook
- Event chips: PreToolUse / PostToolUse / UserPromptSubmit / SubagentStop / SessionStart / SessionEnd / Notification (single-select)
- Matcher input (mono, glob, default `*`)
- Run-as chips: shell / script / claude-prompt
- Command textarea (mono, supports $TOOL_NAME, $TOOL_ARGS, $FILE, $SESSION_ID)
- **Plain-English preview block**: "on **PreToolUse** where tool matches **\*** · run shell: ..."
- Writes to: `<scope-path>/settings.json`

### Env Var
- Variable name (uppercase mono)
- Value field with password-mode toggle
- "Mark as secret" checkbox — when on, value is masked by default and a "reveal" button appears next to it
- Writes to: `<scope-path>/settings.json`

### Keybinding
- Editable table of chord rows (160px chord cell + 1fr action input + 30px remove button)
- Chord cell is a press-to-capture input (not typed) — show "press chord…" in faint when empty
- "add chord" button at the bottom
- Writes to: `<scope-path>/keybindings.json`

### Move scope tab (shared across all kinds)
- Scope chips: GLOBAL / PLUGIN / SLUG / PROJECT / LOCAL (active = filled ink)
- Current/new display below
- On save: copies the entity file to the new scope path, removes from old scope, updates imports if any

### Resolve conflict tab (appears only when contested)
- Lists each scope's copy of the entity
- Current winner is highlighted (paper bg + ink border)
- Per non-winner row: "make winner" (ghost) / "delete" (red) buttons
- Also supports "merge into winner" and "keep as override" (see brief §5.4.1)

---

## Data model the prototype expects

See `data.js`. In production, replace with a live store fed by:

- A filesystem watcher over `~/.claude/`, `~/.claude/plugins/**`,
  `~/.claude/projects/<slug>/`, `<project>/.claude/`, and each project's
  `CLAUDE.md`/`AGENTS.md`/`GEMINI.md`
- A CLAUDE.md parser that extracts H2 sections as standing instructions and
  follows `@import` references
- A settings.json parser that splits the file into per-entry entities
  (permissions, hooks, env vars)
- An override-resolver that groups by `identity` key (see brief §5.4)

The shape the UI consumes:

```ts
type Entity = {
  id: string;
  type: 'standing-instruction' | 'permission' | 'plugin' | 'skill' | 'command' | 'memory' | 'hook' | 'env' | 'keybinding';
  scope: 'global' | 'plugin' | 'slug' | 'project' | 'local';
  author: 'anthropic' | 'community' | 'you' | 'unknown';
  title: string;
  intent: string;            // one-line summary shown in scope nodes + composite
  identity?: string;         // grouping key for override resolution
  stale?: boolean;
  warn?: boolean;
  plugin?: string;
  slugRef?: string;
  imports?: string[];
};

type Relation = {
  from: string; to: string;
  kind: 'provides' | 'invokes' | 'gates' | 'imports' | 'fires-on' | 'accretes-from';
  note?: string;
  broken?: boolean;
};
```

Precedence order (wins last): global → plugin → slug → project → local.
Where the brief says "specificity wins," resolve by reversed scope order.

---

## Design tokens

### Colors (all oklch for perceptual consistency)

```
INK        #1a1713                 // near-black, principal text + borders
MUTED      rgba(26, 23, 19, 0.55)  // secondary text
FAINT      rgba(26, 23, 19, 0.32)  // tertiary / placeholder
RULE       rgba(26, 23, 19, 0.14)  // standard 1px borders
RULE_SOFT  rgba(26, 23, 19, 0.07)  // hairlines between rows
PAPER      #f6f3ec                 // primary background (warm off-white)
PAPER_DEEP #edead f                // section backgrounds
```

### Provenance (author) colors

```
Anthropic  oklch(0.55 0.11 245) / tint oklch(0.96 0.02 245)
Community  oklch(0.58 0.12 155) / tint oklch(0.96 0.025 155)
You        oklch(0.50 0.12 45)  / tint oklch(0.96 0.025 55)
Unknown    oklch(0.55 0.01 60)  / tint oklch(0.95 0.005 60)
```

### Semantic

```
Error (deny, broken)   oklch(0.55 0.18 28)
Warn (ask, stale)      oklch(0.55 0.11 70)
Ok (allow)             oklch(0.50 0.12 155)
```

### Typography

- **Sans (everything)**: Inter Tight — 400 / 500 / 600 / 700
- **Mono**: JetBrains Mono — 400 / 500 (used for paths, patterns, scope labels, env vars, chord keys, all code-adjacent values)
- No serif.
- Smallcaps = `text-transform: uppercase; letter-spacing: 0.14–0.20em; font-size: 9–11px.`

Scale (rough, context-sensitive):
- 26px masthead
- 18px editor entity title
- 16px tab labels, entity titles in rows
- 13.5px body, form field text
- 12–13px secondary body, legend labels
- 11–11.5px pill labels, relation pill target, tooltips
- 9.5–10.5px mono smallcaps column headers, scope labels
- 8.5–9px mono smallcaps relation verbs, type labels

### Spacing

- Row padding: 12px vertical, 6px horizontal
- Column gap inside row: 10px
- Editor drawer padding: 18px 28px
- Artboard outer padding: 14–28px
- Card internal padding: 4–8px small, 10–14px medium

### Borders / shadows / radius

- 1px standard rule, 1.5px for the Composite box (it should feel like a ledger stamp)
- Border radius: 2px almost everywhere. 3px on chevron buttons, 4px on the bulk action bar.
- Provenance left-stripe: 3px solid
- Winner shadow: `1px 1px 0 <ink>` (old-ledger offset, not a drop shadow)
- Bulk action bar shadow: `0 12px 28px -8px rgba(0,0,0,0.35)` (this is the one exception)

---

## Interactions (complete list)

- **Click row body** → pin entity. Pinning highlights related entities across all tabs; related tabs show a dot badge.
- **Click chevron button** → toggle inline editor drawer. Auto-scrolls drawer into view.
- **Click checkbox** → add to bulk selection; action bar appears.
- **Click health chip** → filter rows to that problem kind. "clear filter" link appears in blurb.
- **Click relation pill** → jump to that entity (switch tab + pin + scroll into view + open editor for it).
- **Click pinned banner "clear"** → un-pin.
- **Editor close button** → close drawer.
- **Editor scope chip** → preview scope move. Save triggers the actual move.
- **Editor resolve "make winner"** → promote that scope copy; other scopes keep/delete per their individual buttons.
- **Editor "Preview diff"** → show a modal with the old vs new file content (not yet wired in the mock).
- **Editor "Save with backup"** → write a timestamped backup copy of the file, then write the new file, then refresh affected entities.
- **Bulk "Resolve to winner"** → for each contested entity in selection, keep winner and delete all shadowed scopes.
- **Bulk "Delete shadowed"** → only delete non-winner copies; preserve winner.
- **Bulk "Delete entity"** → delete ALL scope copies. Confirmation required.
- **Relation-pill click when broken** → open the broken-import resolution flow (file not found → offer to create / remove import / pick different path).

---

## What the prototype does NOT yet cover

Flag these for product before implementing:
1. **First-run empty state** — what the app looks like when `~/.claude/`
   has only a skeletal config
2. **Plugin install flow** — no install UI in the prototype
3. **Session transcript browsing** — memories show provenance but not a
   transcript viewer (§5.7 in the brief calls this out as deferred anyway)
4. **Mobile / narrow viewport** — prototype is sized for ≥1600px wide
5. **Diff viewer modal** — button exists, target UI is not designed
6. **Undo toast** — the right rail promises "Undo is one click" but the
   toast isn't drawn anywhere
7. **Permission precedence viz for tool calls at runtime** — out of scope

---

## Suggested implementation order

1. Filesystem watcher + parsers → produce the `Entity[] + Relation[]` data model
2. Override grouping + composite resolution
3. Render Signal Flow with real data; no editor yet
4. Inline editor shell + Save-with-backup + Preview-diff
5. Standing Instruction editor (most common)
6. Permission editor (highest stakes)
7. Skill + Memory + Hook editors
8. Plugin editor + contained-entity navigation
9. Env Var + Keybinding editors
10. Bulk action bar
11. Health ribbon + filters
12. Relationship graph (cross-kind navigation)

---

## Questions? Reference `original-brief.md`.

It's the authoritative spec for data model, scope semantics, override
resolution, file-layer mapping, and product scope boundaries. The prototype
is the visual + interaction contract.
