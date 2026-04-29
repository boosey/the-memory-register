import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { dispatchBulk } from "@/core/save/bulkOps";
import type { Entity } from "@/core/entities";

let tmp: string;
let backupsDir: string;
let claudeHome: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "the-memory-register-bk-"));
  backupsDir = path.join(tmp, "backups");
  claudeHome = path.join(tmp, ".claude");
  await fs.mkdir(claudeHome, { recursive: true });
});

async function writeFileFixture(abs: string, content = "x\n"): Promise<void> {
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
}

function skillEntity(
  scope: Entity["scope"],
  sourceFile: string,
  scopeRoot: string,
  name: string,
  id: string,
  rawContent: string = "",
): Entity {
  return {
    id,
    type: "skill",
    scope,
    author: "you",
    title: name,
    intent: "",
    identity: `skill::${name}`,
    sourceFile,
    scopeRoot,
    mtimeMs: 0,
    rawContent,
  };
}

function memoryEntity(
  scope: Entity["scope"],
  sourceFile: string,
  scopeRoot: string,
  id: string,
  rawContent: string = "",
): Entity {
  return {
    id,
    type: "memory",
    scope,
    author: "you",
    title: path.basename(sourceFile),
    intent: "",
    slugRef: "my-project",
    sourceFile,
    scopeRoot,
    mtimeMs: 0,
    rawContent,
  };
}

function permissionEntity(
  scope: Entity["scope"],
  sourceFile: string,
  scopeRoot: string,
  id: string,
  tool: string,
  pattern: string,
  entryKey: string,
  group: string = "allow",
): Entity {
  return {
    id,
    type: "permission",
    scope,
    author: "you",
    title: `${tool}(${pattern})`,
    intent: "",
    sourceFile,
    scopeRoot,
    mtimeMs: 0,
    rawContent: "",
    entryKey,
    structured: { value: `${tool}(${pattern})`, group },
  };
}

describe("dispatchBulk — resolve-to-winner", () => {
  it("promotes the specifically selected copy as winner even if lower scope", async () => {
    const globalFile = path.join(claudeHome, "skills", "ship", "SKILL.md");
    const projRoot = path.join(tmp, "projA");
    const projFile = path.join(projRoot, ".claude", "skills", "ship", "SKILL.md");
    await writeFileFixture(globalFile, "global\n");
    await writeFileFixture(projFile, "project\n");

    const ents = [
      skillEntity("global", globalFile, claudeHome, "ship", "g1", "global\n"),
      skillEntity("project", projFile, projRoot, "ship", "p1", "project\n"),
    ];

    const res = await dispatchBulk(
      { action: "resolve-to-winner", entityIds: ["g1"] },
      { backupsDir, claudeHome, knownEntities: ents },
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // Affected: 1 deletion of project copy + 1 promotion of global copy to project scope
    expect(res.affected.length).toBe(2);
    // Global source gone (it was moved); project file now contains the global content.
    await expect(fs.stat(globalFile)).rejects.toBeTruthy();
    expect(await fs.readFile(projFile, "utf8")).toBe("global\n");
  });

  it("falls back to natural winner when multiple group members are selected", async () => {
    const globalFile = path.join(claudeHome, "skills", "ship", "SKILL.md");
    const projRoot = path.join(tmp, "projA");
    const projFile = path.join(projRoot, ".claude", "skills", "ship", "SKILL.md");
    await writeFileFixture(globalFile, "global\n");
    await writeFileFixture(projFile, "project\n");

    const ents = [
      skillEntity("global", globalFile, claudeHome, "ship", "g1", "global\n"),
      skillEntity("project", projFile, projRoot, "ship", "p1", "project\n"),
    ];

    const res = await dispatchBulk(
      { action: "resolve-to-winner", entityIds: ["g1", "p1"] },
      { backupsDir, claudeHome, knownEntities: ents },
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // Global gone; project preserved.
    await expect(fs.stat(globalFile)).rejects.toBeTruthy();
    expect(await fs.readFile(projFile, "utf8")).toBe("project\n");
  });
});

describe("dispatchBulk — delete-shadowed", () => {
  it("removes selected shadowed copies without touching the winner", async () => {
    const globalFile = path.join(claudeHome, "skills", "x", "SKILL.md");
    const projRoot = path.join(tmp, "p");
    const projFile = path.join(projRoot, ".claude", "skills", "x", "SKILL.md");
    await writeFileFixture(globalFile, "loser\n");
    await writeFileFixture(projFile, "winner\n");
    const ents = [
      skillEntity("global", globalFile, claudeHome, "x", "a"),
      skillEntity("project", projFile, projRoot, "x", "b"),
    ];
    const res = await dispatchBulk(
      { action: "delete-shadowed", entityIds: ["a"] },
      { backupsDir, claudeHome, knownEntities: ents },
    );
    expect(res.ok).toBe(true);
    await expect(fs.stat(globalFile)).rejects.toBeTruthy();
    expect(await fs.readFile(projFile, "utf8")).toBe("winner\n");
  });
});

describe("dispatchBulk — promote-scope", () => {
  it("refuses to promote an entity at the top of the ladder", async () => {
    const f = path.join(claudeHome, "skills", "s", "SKILL.md");
    await writeFileFixture(f);
    const ent = skillEntity("global", f, claudeHome, "s", "G");
    const res = await dispatchBulk(
      { action: "promote-scope", entityIds: ["G"] },
      { backupsDir, claudeHome, knownEntities: [ent] },
    );
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toBe("action-not-applicable");
  });

  it("promotes a slug skill to global scope", async () => {
    const slugDir = path.join(claudeHome, "projects", "foo");
    const slugFile = path.join(slugDir, "memory", "bar.md");
    const content = "content\n";
    await writeFileFixture(slugFile, content);

    const ents = [memoryEntity("slug", slugFile, slugDir, "a", content)];
    const res = await dispatchBulk(
      { action: "promote-scope", entityIds: ["a"], targetScope: "global" },
      { backupsDir, claudeHome, knownEntities: ents },
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const newPath = res.affected[0]!.newSourceFile!;
    expect(newPath).toBe(path.join(claudeHome, "memory", "bar.md"));
    expect(await fs.readFile(newPath, "utf8")).toBe("content\n");
    await expect(fs.stat(slugFile)).rejects.toBeTruthy();
  });

  it("moves a permission from local scope to global scope directly", async () => {
    const localRoot = path.join(tmp, "p");
    const localFile = path.join(localRoot, ".claude", "settings.local.json");
    const globalFile = path.join(claudeHome, "settings.json");
    
    await writeFileFixture(localFile, JSON.stringify({ permissions: { allow: ["Bash(*)"] } }));
    await writeFileFixture(globalFile, JSON.stringify({ permissions: { allow: [] } }));

    const ent = permissionEntity("local", localFile, localRoot, "p1", "Bash", "*", "permissions.allow[0]");
    
    const res = await dispatchBulk(
      { action: "promote-scope", entityIds: ["p1"], targetScope: "global" },
      { backupsDir, claudeHome, knownEntities: [ent] },
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // Check dest: should have the rule
    const globalContent = JSON.parse(await fs.readFile(globalFile, "utf8"));
    expect(globalContent.permissions.allow).toContain("Bash(*)");

    // Check source: should be gone
    const localContent = JSON.parse(await fs.readFile(localFile, "utf8"));
    expect(localContent.permissions.allow).not.toContain("Bash(*)");
  });
});

describe("dispatchBulk — demote-scope", () => {
  it("refuses to demote an entity at the bottom of the ladder", async () => {
    const f = path.join(tmp, "p", ".claude", "skills", "s", "SKILL.md");
    await writeFileFixture(f);
    const ent = skillEntity("local", f, path.join(tmp, "p"), "s", "L");
    const res = await dispatchBulk(
      { action: "demote-scope", entityIds: ["L"] },
      { backupsDir, claudeHome, knownEntities: [ent] },
    );
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toBe("action-not-applicable");
  });
});

describe("dispatchBulk — dismiss-stale", () => {
  it("writes a marker to the-memory-register-state.json", async () => {
    const memPath = path.join(tmp, "mem.md");
    await writeFileFixture(memPath);
    const ent = memoryEntity("slug", memPath, path.dirname(memPath), "m1");
    const res = await dispatchBulk(
      { action: "dismiss-stale", entityIds: ["m1"] },
      { backupsDir, claudeHome, knownEntities: [ent] },
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const marker = res.affected[0]!.markerFile!;
    const state = JSON.parse(await fs.readFile(marker, "utf8"));
    expect(state.dismissedStale).toHaveLength(1);
    expect(state.dismissedStale[0].entityId).toBe("m1");
  });
});

describe("dispatchBulk — flag-for-review", () => {
  it("writes a flaggedForReview marker", async () => {
    const f = path.join(tmp, "thing.md");
    await writeFileFixture(f);
    const ent: Entity = {
      id: "e1",
      type: "skill",
      scope: "plugin",
      author: "unknown",
      title: "thing",
      intent: "",
      sourceFile: f,
      scopeRoot: tmp,
      mtimeMs: 0,
      rawContent: "",
    };
    const res = await dispatchBulk(
      { action: "flag-for-review", entityIds: ["e1"] },
      { backupsDir, claudeHome, knownEntities: [ent] },
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const marker = res.affected[0]!.markerFile!;
    const state = JSON.parse(await fs.readFile(marker, "utf8"));
    expect(state.flaggedForReview).toHaveLength(1);
  });
});

describe("dispatchBulk — delete-entity", () => {
  it("requires confirm:true", async () => {
    const f = path.join(tmp, "s.md");
    await writeFileFixture(f);
    const ent = skillEntity("global", f, tmp, "s", "s1");
    const res = await dispatchBulk(
      { action: "delete-entity", entityIds: ["s1"] },
      { backupsDir, claudeHome, knownEntities: [ent] },
    );
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toBe("confirmation-required");
  });
});
