# memmgmt v1 — Claude Code Build Prompt

**How to use this file:** Paste everything between the `=== BEGIN PROMPT ===` and `=== END PROMPT ===` markers into a fresh Claude Code session opened inside `C:\Users\boose\projects\memmgmt`. Claude Code will then execute the build autonomously until the success criteria are met, asking for input only in the specific situations enumerated in §6.

Before pasting: make sure the session has permission to install npm packages, run `pnpm`/`pnpm dlx`, write files under the project directory, and run git commits. The prompt does not require any network beyond npm registry access and the `open` package's browser launch.

---

=== BEGIN PROMPT ===

# Mission

You are building **memmgmt v1** — a local-only Next.js web app that gives a Claude Code power user a visual, scope-aware UX for managing the entire Claude Code configuration surface (CLAUDE.md, skills, slash commands, settings.json, hooks, keybindings, and auto-memory) across Global / Slug / Plugin / Project / Local scopes, with diff-preview saves, timestamped backups, and one-click undo.

Your job is to execute the pre-existing implementation plan end-to-end and stop only when the v1 success criteria pass. The design and plan are already approved; do not re-litigate them. Your value is implementation fidelity and verification discipline, not redesign.

## 1. Authoritative sources of truth (read these first, in this order)

1. **Design / PRD:** `docs/superpowers/specs/2026-04-22-memmgmt-design.md` — the *what* and *why*. Section references throughout the plan (e.g., §5.6.2) point here.
2. **Implementation plan:** `docs/superpowers/plans/2026-04-22-memmgmt-v1.md` — the *how*, as a sequence of 10 milestones, each with concrete tasks and TDD steps (code + commands + commit instructions). This is the operating manual; follow it task-by-task.

Read both files fully before writing any code. Do not skim. The design document includes an explicit non-goals list (§6) and a core tenet (§2) that must constrain every implementation choice.

## 2. Execution model

Follow the plan's milestones in order. Within a milestone, use **Agent Teams** (`TeamCreate` / `TeamDelete` + task assignment via `TaskUpdate` `owner`) for any tasks that can run in parallel. Never use ad-hoc `Task`-tool subagent fan-out or launch multiple parallel sessions yourself — Agent Teams is the one and only multi-task primitive for this project.

### 2.1 Shared-contracts-first rule (blocking)

**Before any parallel fan-out, Task 1.1 (`src/core/types.ts` — shared types for `ArtifactNode`, `GraphEdge`, `Graph`, `RawArtifact`, `Scope`, `ArtifactKind`) must be complete, committed, and type-checking clean.** This is the contract that every parser, graph component, API route, and UI component in every later milestone depends on. If the types change after fan-out begins, parallel workers will produce mismatches that are expensive to reconcile.

This rule is non-negotiable. It exists because past Agent Teams runs produced frontend/backend mismatches when contracts were written in parallel with consumers.

### 2.2 Parallelizable vs sequential milestones

The plan was written with the following parallelism in mind. Structure each team accordingly:

| Milestone | Parallelism | Why |
|---|---|---|
| M0 Scaffold | Sequential | Each step depends on the prior toolchain step. One worker. |
| M1 Types + Discovery | **Task 1.1 first (blocking), then 1.2 ∥ 1.3** | Slug codec and crawler are independent once types exist. Two workers after contracts land. |
| M2 Parsers | **Task 2.1 first (frontmatter util), then 2.2–2.8 fully parallel** | Every parser depends only on the frontmatter util. Seven workers. |
| M3 Graph | **3.1 ∥ 3.2 ∥ 3.3 ∥ 3.4, then 3.5 (builder) alone** | Helpers are independent; builder consumes them all. Four workers, then one. |
| M4 API routes | **4.1 ∥ 4.2 ∥ 4.3 fully parallel** | Each route is isolated. Three workers. |
| M5 Inventory view | Mostly sequential (5.1 → 5.2 → 5.3 → 5.4) | Component composition chain. One worker. |
| M6 Graph view | Sequential. One worker. | Single component. |
| M7 Editor panel | **7.1 → 7.2, then 7.3 per-kind editors fully parallel** | Per-kind editors are isolated once the dispatcher exists. Five workers. |
| M8 Save pipeline | **8.1 ∥ 8.2, then 8.3 → 8.4 ∥ 8.5 (routes)** | Diff and backup are independent primitives; writer composes them. Two, then two. |
| M9 Edit UI | Sequential. One worker. | Each step builds on the prior. |
| M10 Polish | **10.1 ∥ 10.2 ∥ 10.3, then 10.4 → 10.5 → 10.6** | Three polish items are independent. |

### 2.3 Team workflow per milestone

For each milestone:

1. Create a `TodoWrite` entry per task.
2. If the milestone has a blocking first task (see table), execute it solo, commit, verify `pnpm typecheck` and `pnpm test` pass.
3. `TeamCreate` a team sized to the number of parallel-safe tasks.
4. Create one `TaskCreate` per plan task, assign owners via `TaskUpdate` `owner`. Set `addBlockedBy` dependencies where the plan requires them.
5. Wait for the team to converge. Review each commit diff against the plan before moving on.
6. Run `pnpm test` and `pnpm typecheck` against the merged state; fix any cross-worker mismatches before advancing.
7. `TeamDelete` and proceed to the next milestone.

### 2.4 Execution per task (applies to solo or team workers)

For each task in the plan:

1. Perform each numbered step in order. The plan's TDD steps (write failing test → run → verify fail → implement → run → verify pass → commit) are **not optional** — skipping tests forfeits the self-correction that makes the rest of the plan reliable.
2. Run the commands the plan specifies. Verify the expected output. If it does not match, diagnose and fix before moving on; do not paper over failures.
3. After the final step of each task, commit with the message the plan provides (or a close variant).
4. Update the TodoWrite entry to completed and proceed to the next task.

After completing all tasks in a milestone, run the milestone-level verification (listed in the plan's "Milestone Overview" table) before moving to the next milestone.

## 3. Success criteria (stop condition)

You are done when **all five** of these pass. These come from the design document §12 verbatim:

1. From a cold `pnpm build && pnpm memmgmt:launch-dev`, every artifact across every scope is rendered in under 10 seconds of crawl time.
2. For any artifact, the user can see its scope, content, and override status in ≤2 clicks.
3. The user can edit any artifact in one of the three kinds supported in M9 (CLAUDE.md section body, settings permission/env entries, skill frontmatter), preview the diff, save, and undo — without leaving the app.
4. Given a CLAUDE.md file that uses `@path/to/file` imports, the user can answer "what does it import and where does each imported file live" without reading any markdown.
5. First-run experience is one command → browser opens → map populated. No setup screen, no config file, no prompts.

Also run the manual smoke checklist in the plan's Milestone 10, Task 10.5 and fix anything that fails.

## 4. Constraints (non-negotiable)

- **No LLM calls anywhere in v1.** Every summary, classification, and suggestion must be derived from structural signals on disk. See design §5.3 for the deterministic derivation rules. Violating this breaks the product tenet.
- **No scope creep beyond v1.** The following are explicitly v2+ and must not be implemented: transcript parsing, drift/duplication suggestions, cross-machine sync, auth, desktop packaging. See design §6.
- **Do not alter the design document.** It is frozen for v1. If you find a design-level ambiguity, log it and proceed using the plan's or design's best available interpretation — do not edit the spec.
- **The plan is frozen; you may patch it only where the plan's "Self-Review Checklist → Gaps to patch inline" section explicitly calls for a patch.** Those patches are already described; apply them as you reach the corresponding milestone.
- **Round-trip safety is load-bearing.** Every parser in Milestone 2 must pass its round-trip test before you use it downstream. If `parse(serialize(x)) !== x` semantically, fix the parser before moving on.
- **Every save must go through the backup pipeline.** No code path may write to `~/.claude/` files without first calling `applyEdit` from `src/core/save/writer.ts`.
- **File sizes.** If any single source file exceeds ~400 lines, stop and split it by responsibility before continuing. The plan's file structure already enforces this; don't undo it.
- **Comments.** Prefer naming and structure over comments. Add a comment only when the *why* is non-obvious (hidden constraint, subtle invariant, a workaround for a specific bug). Never add comments that restate what the code does.

## 5. Order of operations

1. Read the design document end to end.
2. Read the plan document end to end.
3. Confirm the working directory (`C:\Users\boose\projects\memmgmt`) contains only the two docs committed so far; do not delete anything you find.
4. Begin **Milestone 0 Task 0.1** and proceed linearly.
5. After each milestone's final commit, run:

   ```bash
   pnpm test
   pnpm typecheck
   ```

   Both must pass before you move to the next milestone. If either fails, fix before advancing.
6. After Milestone 10 is complete, run the manual smoke checklist in Task 10.5 against a real `~/.claude/` tree. If smoke fails, file a commit per fix and re-run the checklist until clean.

## 6. When to stop and ask the user vs keep going

**Keep going (do not ask) for:**
- Every task and step in the plan.
- Any unit-test failure — diagnose and fix.
- Any TypeScript error — fix.
- Any npm/pnpm install failure — retry once, then read the error and adjust (e.g., if `reactflow` is renamed to `@xyflow/react`, switch imports accordingly).
- Any minor ambiguity where the plan or spec gives a reasonable default — pick it.
- Lint or formatting issues — fix.

**Stop and ask the user when:**
- A step in the plan is factually wrong (e.g., a command does not exist, an API has changed in a way that invalidates the approach) and adapting requires a material deviation from the plan's intent. Describe the deviation you propose before executing.
- A dependency is unavailable on npm under the name the plan specifies AND no obvious successor package covers the same surface.
- `~/.claude/` on this machine contains content the crawler cannot handle even after the parser tolerates errors — describe the content type and ask whether to extend coverage or skip.
- You detect that a previously-implemented task has a structural flaw that affects multiple downstream milestones (e.g., a type signature mistake that needs refactoring in many places). Describe the flaw, propose the refactor, wait.

**Never:**
- Silently skip a step because it looks tedious.
- Skip tests because implementation was obvious.
- Commit code that does not compile or test-pass.
- Add features the plan does not list. If you see an obvious improvement, write it down in a new file `docs/superpowers/followups.md` as a v2 candidate — but do not implement it.

## 7. Verification loop (per milestone)

After each milestone:

1. `pnpm test` — all green.
2. `pnpm typecheck` — zero errors.
3. `pnpm build` — succeeds (only required after M0; thereafter after each UI milestone).
4. Report to the user in this format:

   > **Milestone N complete.** Commits: `<hash1>..<hashN>`. Tests: X passing. Next: Milestone N+1 — <title>.

   Then continue.

After Milestone 10:

1. Run the spec §11 manual smoke checklist.
2. Verify all 5 success criteria in §3 of this prompt.
3. Report:

   > **v1 complete.** All success criteria pass. Ready for `pnpm pack` / publish. Backups directory created. Undo tested end-to-end.

   Then stop.

## 8. What to report as you go

Short status updates only, not narration. One sentence per significant event:

- "Starting Milestone N."
- "Task X.Y complete, tests green."
- "Encountered <problem>, fixing by <approach>."
- "Milestone N complete, moving to N+1."

Do not dump generated code into the chat; the code lives in files and in git.

## 9. Non-obvious pitfalls (read once; internalize)

- **Next.js 15 App Router + `output: 'standalone'`** produces `.next/standalone/server.js` that expects `PORT` and `HOSTNAME` env vars. The `bin/memmgmt.mjs` launcher sets these before `import()`ing the server. Don't bypass this dance.
- **`reactflow` vs `@xyflow/react`**: the ecosystem is mid-migration. If `reactflow` install fails or types are broken, switch to `@xyflow/react` and adjust imports in `src/components/GraphView.tsx`. The rest of the app is unaffected.
- **Slug codec edge cases**: the algorithm in `src/core/discovery/slugCodec.ts` is pragmatic and may not handle every Windows UNC path or symlinked project. If a real-world slug fails to decode, extend the codec with a test case and fix; do not hand-write exceptions in the crawler.
- **Monaco in Next.js App Router**: `@monaco-editor/react` works but requires `"use client"` on any component using it. Don't try to SSR Monaco.
- **Concurrent-edit check**: the mtime comparison uses a ±1ms tolerance. Some filesystems report coarser mtimes; if concurrent-edit false-positives appear in manual testing, expand the tolerance to `1000ms` and add a comment explaining why.
- **File writes via `fs.writeFile(path, content, "utf8")`** — always specify `utf8` explicitly. Default encoding varies by Node version and has caused silent corruption in similar tools.
- **The auto-memory system** (see design §1 Slug scope bullet) is your own test bed. Point memmgmt at `~/.claude/` on whichever machine you run it on and the user's real memory files will appear. This is the fastest smoke test.

## 10. Scope of autonomy

- You may install any npm package the plan specifies, plus reasonable dev-only tools that unblock a specific problem (e.g., `@types/diff`).
- You may create files under the project root freely.
- You may create and delete files under `tests/fixtures/`.
- You may modify `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts` as the plan requires.
- You may not modify files outside the project directory except to *read* from `~/.claude/` during manual smoke tests.
- You may not publish the package to npm. `pnpm pack` for verification is fine; actual `pnpm publish` is for the user to run.

## 11. What "done" looks like (final state)

- `pnpm pack` produces a tarball containing `.next/standalone`, `.next/static`, `public`, `bin/memmgmt.mjs`, `package.json`, `README.md`.
- `pnpm memmgmt:launch-dev` (post-build) opens a browser on a free port in the 5174–5199 range and renders the populated inventory view within 10 seconds.
- A user can click any CLAUDE.md section, settings permission rule, or skill card, edit a supported field, preview the diff, save, confirm a file appeared under `~/.claude/memmgmt-backups/<iso>/`, and click Undo to restore.
- `pnpm test` reports all green. `pnpm typecheck` reports zero errors.
- Git history is a clean linear sequence of commits matching the plan's task structure.
- `docs/superpowers/followups.md` exists and lists any v2 candidates you spotted (empty if none).

Go.

=== END PROMPT ===

---

## Author notes (not part of the prompt)

**Why this shape:**

- **Authoritative docs first**: the prompt explicitly sends Claude Code to read the spec and plan before writing code. Without this, it would improvise from the prompt alone and drift.
- **Explicit stop criteria**: the five success criteria in §3 are concrete and machine-verifiable. Without them, "done" becomes a vibe.
- **Escape hatch rules in §6**: the most common failure mode is agents asking too often (noise) or not enough (scope creep). §6 draws the line.
- **The non-negotiable constraint block in §4**: these are the parts where even a well-intentioned agent can silently break the product tenet (adding an LLM call, adding a feature, deleting a test). Making them non-negotiable rather than "prefer not to" matters.
- **The pitfalls block in §9**: these are known sharp edges at the 2026-04 moment. If you re-use this prompt later, re-check them.

**If you want to run this prompt more aggressively** (less checkpointing, faster iteration), remove §7's per-milestone reporting requirement. If you want to run it more conservatively (reviewing every milestone yourself), keep §7 and also require explicit user approval between milestones by adding a "wait for user approval" line at the end of §7.

**Iteration loop for the prompt itself:** if Claude Code gets stuck or drifts on first run, refine the specific section that failed and re-run from the last clean commit rather than starting over.
