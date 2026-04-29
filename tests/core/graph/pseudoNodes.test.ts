import { describe, it, expect } from "vitest";
import { PseudoNodeRegistry } from "@/core/graph/pseudoNodes";

describe("PseudoNodeRegistry", () => {
  it("registers tool matchers verbatim, idempotent by matcher", () => {
    const r = new PseudoNodeRegistry();
    r.registerTool("Bash");
    r.registerTool("Bash");
    r.registerTool("Write");
    const out = r.flush();
    const tools = out.filter((p) => p.kind === "tool");
    expect(tools.map((t) => t.id)).toEqual(["tool:Bash", "tool:Write"]);
  });

  it("registers slugs idempotently with latest metadata winning", () => {
    const r = new PseudoNodeRegistry();
    r.registerSlug({
      name: "the-memory-register",
      projectPath: "/a",
      sessionCount: 3,
      lastActiveMs: 100,
      isGhost: false,
    });
    r.registerSlug({
      name: "the-memory-register",
      projectPath: "/b",
      sessionCount: 7,
      lastActiveMs: 200,
      isGhost: false,
    });
    const slugs = r.flush().filter((p) => p.kind === "slug");
    expect(slugs).toHaveLength(1);
    expect(slugs[0]).toMatchObject({
      id: "slug:the-memory-register",
      projectPath: "/b",
      sessionCount: 7,
    });
  });

  it("preserves non-broken path once registered, even if broken later", () => {
    const r = new PseudoNodeRegistry();
    r.registerPath("@foo.md", false);
    r.registerPath("@foo.md", true);
    const p = r.flush().find((n) => n.id === "@foo.md")!;
    expect(p.kind).toBe("path");
    expect((p as { broken: boolean }).broken).toBe(false);
  });

  it("has() checks existence by id", () => {
    const r = new PseudoNodeRegistry();
    r.registerSlug({
      name: "a",
      projectPath: "/a",
      sessionCount: 0,
      lastActiveMs: 0,
      isGhost: false,
    });
    r.registerTool("Read");
    r.registerPath("@x.md", false);
    expect(r.has("slug:a")).toBe(true);
    expect(r.has("tool:Read")).toBe(true);
    expect(r.has("@x.md")).toBe(true);
    expect(r.has("slug:missing")).toBe(false);
  });
});
