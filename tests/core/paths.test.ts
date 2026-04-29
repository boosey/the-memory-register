import { describe, it, expect, afterEach } from "vitest";
import { resolveHomePaths } from "@/core/paths";
import path from "node:path";
import os from "node:os";

describe("resolveHomePaths", () => {
  const ORIGINAL = process.env.THE_MEMORY_REGISTER_CLAUDE_HOME;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.THE_MEMORY_REGISTER_CLAUDE_HOME;
    else process.env.THE_MEMORY_REGISTER_CLAUDE_HOME = ORIGINAL;
  });

  it("defaults to os.homedir() + /.claude when no override", () => {
    delete process.env.THE_MEMORY_REGISTER_CLAUDE_HOME;
    const p = resolveHomePaths();
    expect(p.claudeHome).toBe(path.join(os.homedir(), ".claude"));
  });

  it("honors THE_MEMORY_REGISTER_CLAUDE_HOME env var", () => {
    process.env.THE_MEMORY_REGISTER_CLAUDE_HOME = "/tmp/fake-claude";
    const p = resolveHomePaths();
    expect(p.claudeHome).toBe("/tmp/fake-claude");
    expect(p.projectsDir).toBe(path.join("/tmp/fake-claude", "projects"));
    expect(p.backupsDir).toBe(path.join("/tmp/fake-claude", "the-memory-register-backups"));
  });

  it("explicit override wins over env var", () => {
    process.env.THE_MEMORY_REGISTER_CLAUDE_HOME = "/tmp/from-env";
    const p = resolveHomePaths({ claudeHome: "/tmp/from-arg" });
    expect(p.claudeHome).toBe("/tmp/from-arg");
  });
});
