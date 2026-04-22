# memmgmt — v2 Follow-ups

Notes from v1 build — items observed during implementation but explicitly out of scope for v1 per the design doc (§6). Record here, do not implement.

## Slug codec — filesystem-aware disambiguation

**Observed:** Project names containing literal dashes (e.g. `ai-sdk-provider-claude-code`) decode to path-separator trees (e.g. `ai/sdk/provider/claude/code`). The greedy codec treats every dash as a separator because Claude Code's on-disk slug scheme does not appear to escape dashes.

**Effect:** Such slugs show up as ghost slugs in the UI because the greedy-decoded path does not exist on disk.

**Proposed fix (v2):** After greedy decode, if the path does not exist, walk ancestors and try merging consecutive slug segments with dashes, checking the filesystem at each step. Return the first path that exists. Fall back to greedy decode + ghost-slug flag only if no variation exists.

## Plugin scope coverage — registered vs cached

**Observed:** `~/.claude/plugins/cache/<source>/<name>/<version>/` holds every cached version of every plugin the user has ever seen, not just the installed ones. The crawler walks every version, producing many near-duplicate skill/command nodes per plugin.

**Proposed fix (v2):** Read `~/.claude/plugins/installed_plugins.json` and only walk plugin versions referenced there. Older cached versions become a "cached (inactive)" footer panel rather than top-level nodes.

## `.fixture-project/` in our test fixtures is visible via slug-ish path on the dev machine

**Observed:** When memmgmt runs against its own repo's `~/.claude/`, the fixture's `sample-claude-home` tree is NOT crawled (good — only the user's real `~/.claude/` is). Confirms discovery isolation. No action needed.

## Override detection for `contains`

**Observed:** `contains` edges are emitted from synthetic `scope-root::...` pseudo-nodes that are not rendered in the inventory or graph views. They are recorded on the graph but currently unused.

**Proposed fix (v2):** Either render scope-root nodes in the graph canvas (giving the graph a grouped/clustered appearance) or drop `contains` edges in favor of a different UI grouping.

## Author resolution for plugin skills

**Observed:** On the user's machine, 80 plugin skills resolved to Anthropic (via `publisher: anthropic` in manifests). Author attribution is working. No action needed.

---

# v1.5 follow-ups — from E2E retrofit (2026-04-22)

The following were surfaced by the Playwright E2E suite and the Chrome DevTools MCP visual gate during the v1.5 build. Per v1.5 core tenet ("document, do not fix"), each is recorded for v2 resolution.

## v1.5 E2E failure: Undo button unreachable — lost on post-save page reload

**Spec file:** `tests/e2e/03-edit-save-undo.spec.ts`
**Test:** `edit permission -> diff preview -> save -> backup exists -> undo restores`
**Expected:** After confirming Save in the diff modal, an Undo button appears and clicking it reverts `settings.json` on disk to its pre-edit content.
**Actual:** `locator.click: Test timeout of 30000ms exceeded. waiting for getByRole('button', { name: /undo/i })`. The Undo control lives inside the post-save toast inside `EditorPanel`, but `HomePage` passes `onSaved={() => location.reload()}` which fires immediately after confirm — the toast's `justSaved` state is wiped by the reload before any user (or test) can click Undo.
**Repro:** `pnpm test:e2e tests/e2e/03-edit-save-undo.spec.ts`
**Trace:** `playwright-report/` (run `pnpm test:e2e:report` after a failing run)
**Proposed v2 fix:** Decouple the post-save refresh from the Undo affordance. Options: (a) surface the Undo toast at `HomePage` level so it survives the reload, persisting the last-saved pointer in sessionStorage or the graphCache; (b) replace `location.reload()` with a targeted refetch of the affected artifact so the `EditorPanel` toast stays mounted; (c) move Undo into a first-class "Recent edits" surface in the inventory view. Option (b) is the smallest behavior-preserving change.

## v1.5 E2E failure: Imported markdown targets not indexed as artifacts

**Spec file:** `tests/e2e/04-import-resolution.spec.ts`
**Test:** `imports-demo target is discoverable in inventory without reading markdown`
**Expected:** The fixture file `tests/fixtures/sample-claude-home/imports-demo.md` — target of a live `@./imports-demo.md` reference in the global CLAUDE.md — appears as its own inventory card with title "Imported content" or "imports-demo".
**Actual:** `getByText(/Imported content|imports-demo/i).first()` not visible (element not found after 5s). The crawler (`src/core/discovery/crawler.ts`) only picks up specific named files (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`) plus recognized `skills/` and `commands/` directories. Arbitrary top-level `.md` files imported via `@./…` are recorded as edge targets but never emitted as their own `ArtifactNode`.
**Repro:** `pnpm test:e2e tests/e2e/04-import-resolution.spec.ts`
**Trace:** `playwright-report/`
**Proposed v2 fix:** Parse `@import` references during CLAUDE.md ingestion and enqueue resolved targets (existing file paths only) as additional `RawArtifact` candidates with `kind: "imported-markdown"`. Render them as a thinner inventory card style to distinguish from first-class artifacts, and annotate their inbound edge with the importing file's title for traceability.

## v1.5 visual finding: Slug codec dash-as-separator confirmed user-visible

**Spec file:** `tests/e2e/06-error-states.spec.ts` (passes), plus `tests/e2e/01-crawl-under-10s.spec.ts`
**Observed during visual gate:** The Ghost slugs panel on fixture load shows `-tmp-fx-proj → /tmp/fx/proj` and `-tmp-fx-proj-dead → /tmp/fx/proj/dead`. The fixture's actual source path is `/tmp/fx-proj`, but the greedy codec treats every dash as `/`.
**Repro:** Run the app against `tests/fixtures/sample-claude-home/` (e.g. via Playwright webServer). Observe the Ghost slugs panel's right-hand column.
**Relation:** Duplicate root cause with the existing "Slug codec — filesystem-aware disambiguation" entry at top of this file. This visual-gate observation confirms the bug is cosmetically visible to users (dashes silently become slashes in displayed paths), not just a correctness issue in ghost-slug detection.
**Proposed v2 fix:** Same as the top-of-file entry — filesystem-aware ancestor merging.

## v1.5 visual finding: Graph view renders only `overrides` edges — imports and dead-import edges not drawn

**Spec file:** `tests/e2e/04-import-resolution.spec.ts` (test 1 passes because it asserts `edges.count() > 0`, which the single `overrides` edge satisfies)
**Observed during visual gate:** With Inventory showing a live @import + dead @import on the global CLAUDE.md card ("⚠ dead @import"), switching to Graph surfaces all nodes but only one visible edge — the `overrides` connection between global and project-scope "Coding Standards". Expected: at least an `imports` edge to `imports-demo.md` and a visible dead-import marker.
**Repro:** `PORT=5999 MEMMGMT_CLAUDE_HOME=$PWD/tests/fixtures/sample-claude-home MEMMGMT_EXTRA_PROJECTS=$PWD/tests/fixtures/sample-claude-home/.fixture-project node .next/standalone/server.js`, open http://127.0.0.1:5999/, click Graph tab.
**Proposed v2 fix:** Audit `src/components/GraphView.tsx` edge filtering. Likely the React Flow edge mapping drops `imports`/`dead-import` edges whose target nodes are either synthetic (scope-root pseudo-nodes) or non-existent (dead imports). Render dead-import edges as dashed red lines terminating at a "missing target" placeholder node; render imports as solid gray lines to the imported-markdown node introduced by the fix above.

## v1.5 visual finding: Local scope column clipped on default viewport

**Spec file:** `tests/e2e/01-crawl-under-10s.spec.ts` (asserts presence but not layout)
**Observed during visual gate:** On a 1280×1024 desktop viewport the 5th scope column ("Local (gitignored)") is clipped off the right edge. Horizontal scroll inside the column container does work but is not visually obvious — there is no scroll affordance.
**Proposed v2 fix:** Either (a) shrink column minimum width at narrow viewports, (b) add a visible right-edge scroll affordance (chevron + shadow), or (c) switch to a stacked/paginated layout below a breakpoint.

## v1.5 visual finding: Next.js `next start` warning under `output: standalone`

**Spec file:** N/A (build step)
**Observed during visual gate:** `pnpm build && pnpm start` emits `"next start" does not work with "output: standalone" configuration. Use "node .next/standalone/server.js" instead.` The app serves successfully despite the warning (6/8 E2E tests green), but the Playwright webServer command is now relying on fallback behavior.
**Proposed v2 fix:** Update the `start` script in `package.json` to `node .next/standalone/server.js` (after ensuring the `postbuild` asset copy stays wired), and update `playwright.config.ts`'s `webServer.command` accordingly. Separately, investigate the Turbopack NFT warning about `src/core/discovery/crawler.ts` — the dynamic `path.join` calls there trace the whole project unintentionally.

## v1.5 visual finding: Lighthouse accessibility 89 (above threshold, 3 audits failed)

**Spec file:** N/A (visual gate, inventory view snapshot)
**Observed during visual gate:** Lighthouse desktop snapshot against the inventory at http://127.0.0.1:5999/ returned: Accessibility 89, Best Practices 100, SEO 100. 27 audits passed, 3 failed. Score is above the plan's ≥85 threshold, so no gate failure; recording here for v2 polish.
**Proposed v2 fix:** Run `pnpm exec chrome-devtools-mcp lighthouse` locally and triage the three failing audits. Likely candidates based on the DOM: color-contrast on the light-gray scope-column headings, label-association for the author-filter `<select>`, and possibly tap-target sizing on the very compact artifact cards.

