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
