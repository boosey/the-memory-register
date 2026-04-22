import { describe, it, expect } from "vitest";
import path from "node:path";
import { resolveImport } from "@/core/graph/importResolver";

describe("importResolver", () => {
  it("resolves relative paths from the source file's directory", () => {
    const fromFile = path.join("/home/u/.claude/CLAUDE.md");
    const got = resolveImport("./shared/tone.md", fromFile);
    expect(got).toBe(path.resolve(path.dirname(fromFile), "./shared/tone.md"));
  });

  it("expands ~/ to the caller-provided home", () => {
    const got = resolveImport(
      "~/.claude/shared/a.md",
      "/anywhere/b.md",
      "/home/u",
    );
    expect(got).toBe(path.join("/home/u", ".claude/shared/a.md"));
  });

  it("returns null for non-markdown or non-path strings", () => {
    expect(resolveImport("just-text", "/a.md")).toBeNull();
  });
});
