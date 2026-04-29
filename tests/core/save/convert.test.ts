import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { convertCommandToSkill } from "@/core/save/convert";
import type { Entity } from "@/core/entities";

let tmp: string;
let commandsDir: string;
let skillsDir: string;
let backupsDir: string;
let cmdFile: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "the-memory-register-cv-"));
  commandsDir = path.join(tmp, "commands");
  skillsDir = path.join(tmp, "skills");
  backupsDir = path.join(tmp, "backups");
  await fs.mkdir(commandsDir, { recursive: true });
  cmdFile = path.join(commandsDir, "ship.md");
  await fs.writeFile(
    cmdFile,
    `---
description: ship the app
author: you
---
Body line 1
Body line 2
`,
    "utf8",
  );
});

function makeCommandEntity(): Entity {
  return {
    id: `command::global::${cmdFile}`,
    type: "command",
    scope: "global",
    author: "you",
    title: "ship",
    intent: "ship the app",
    sourceFile: cmdFile,
    scopeRoot: tmp,
    mtimeMs: 0,
    rawContent: "",
  };
}

describe("convertCommandToSkill", () => {
  it("writes a new skill with the command body and deletes the command", async () => {
    const res = await convertCommandToSkill(
      {
        commandId: `command::global::${cmdFile}`,
        newSkillName: "ship",
        newSkillDescription: "Ship the app",
      },
      { backupsDir, knownEntities: [makeCommandEntity()] },
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const skillFile = path.join(skillsDir, "ship", "SKILL.md");
    expect(res.skillPath).toBe(skillFile);
    const written = await fs.readFile(skillFile, "utf8");
    expect(written).toContain("name: ship");
    expect(written).toContain("description: Ship the app");
    expect(written).toContain("Body line 1");
    await expect(fs.stat(cmdFile)).rejects.toBeTruthy();
    const stat = await fs.stat(res.commandBackupPath);
    expect(stat.isFile()).toBe(true);
  });

  it("rejects invalid skill names", async () => {
    const res = await convertCommandToSkill(
      {
        commandId: `command::global::${cmdFile}`,
        newSkillName: "Has Space",
        newSkillDescription: "",
      },
      { backupsDir, knownEntities: [makeCommandEntity()] },
    );
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toBe("skill-name-invalid");
  });

  it("rejects when command is unknown", async () => {
    const res = await convertCommandToSkill(
      {
        commandId: "command::global::/nope.md",
        newSkillName: "ship",
        newSkillDescription: "",
      },
      { backupsDir, knownEntities: [] },
    );
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toBe("command-not-found");
  });

  it("refuses when destination already exists", async () => {
    const dest = path.join(skillsDir, "ship", "SKILL.md");
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, "pre-existing\n", "utf8");
    const res = await convertCommandToSkill(
      {
        commandId: `command::global::${cmdFile}`,
        newSkillName: "ship",
        newSkillDescription: "",
      },
      { backupsDir, knownEntities: [makeCommandEntity()] },
    );
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toBe("skill-name-taken");
    expect(await fs.readFile(cmdFile, "utf8")).toContain("Body line 1");
  });

  it("newSkillId matches the crawler's id convention", async () => {
    const res = await convertCommandToSkill(
      {
        commandId: `command::global::${cmdFile}`,
        newSkillName: "ship",
        newSkillDescription: "Ship it",
      },
      { backupsDir, knownEntities: [makeCommandEntity()] },
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.newSkillId).toBe(`skill::global::${res.skillPath}`);
  });
});
