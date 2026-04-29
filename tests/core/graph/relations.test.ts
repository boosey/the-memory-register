import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  deriveAccretesFrom,
  deriveFiresOn,
  deriveGates,
  deriveImports,
  deriveProvides,
} from "@/core/graph/relations";
import { PseudoNodeRegistry } from "@/core/graph/pseudoNodes";
import type { Entity } from "@/core/entities";
import type { SlugMetadata } from "@/core/types";

function ent(partial: Partial<Entity> & Pick<Entity, "id" | "type">): Entity {
  return {
    scope: "global",
    author: "you",
    title: "",
    intent: "",
    sourceFile: "/abs/file.md",
    scopeRoot: "/abs",
    mtimeMs: 0,
    rawContent: "",
    ...partial,
  } as Entity;
}

describe("deriveProvides", () => {
  it("emits plugin → skill/command/agent/mcp-server relations for same scopeRoot", () => {
    const entities: Entity[] = [
      ent({
        id: "pl",
        type: "plugin",
        scope: "global",
        scopeRoot: "/p/dbtools",
      }),
      ent({
        id: "sk",
        type: "skill",
        scope: "global",
        scopeRoot: "/p/dbtools",
        plugin: "dbtools",
      }),
      ent({
        id: "cm",
        type: "command",
        scope: "global",
        scopeRoot: "/p/dbtools",
        plugin: "dbtools",
      }),
      ent({
        id: "ag",
        type: "agent",
        scope: "global",
        scopeRoot: "/p/dbtools",
        plugin: "dbtools",
      }),
      ent({
        id: "mc",
        type: "mcp-server",
        scope: "global",
        scopeRoot: "/p/dbtools",
        plugin: "dbtools",
      }),
      // No plugin provenance — no relation.
      ent({
        id: "sk2",
        type: "skill",
        scope: "global",
        scopeRoot: "/p/other",
      }),
    ];
    const rels = deriveProvides(entities);
    expect(rels.map((r) => r.to).sort()).toEqual(["ag", "cm", "mc", "sk"]);
    expect(rels.every((r) => r.kind === "provides" && r.from === "pl")).toBe(
      true,
    );
  });
});

describe("deriveImports", () => {
  it("resolves known targets to entities; unknown paths to path pseudo-nodes", () => {
    // Use the same sourceFile for both entities so the byFile index is
    // populated regardless of platform path resolution.
    const srcFile = path.resolve("/abs/CLAUDE.md");
    const tgtFile = path.resolve("/abs/imp.md");
    const entities: Entity[] = [
      ent({
        id: "src",
        type: "standing-instruction",
        sourceFile: srcFile,
        imports: ["@./imp.md", "@./missing.md"],
      }),
      ent({
        id: "tgt",
        type: "standing-instruction",
        sourceFile: tgtFile,
      }),
    ];
    const reg = new PseudoNodeRegistry();
    const rels = deriveImports(entities, reg, {
      exists: (p) => p === tgtFile,
    });
    const resolved = rels.find((r) => r.to === "tgt");
    expect(resolved?.kind).toBe("imports");
    const broken = rels.find((r) => r.broken);
    expect(broken?.to).toBe("@./missing.md");
  });

  it("marks missing-file imports as broken and registers path pseudo-node", () => {
    const entities: Entity[] = [
      ent({
        id: "src",
        type: "standing-instruction",
        sourceFile: path.resolve("/abs/CLAUDE.md"),
        imports: ["@./gone.md"],
      }),
    ];
    const reg = new PseudoNodeRegistry();
    const rels = deriveImports(entities, reg, { exists: () => false });
    expect(rels[0]!.broken).toBe(true);
    const paths = reg.flush().filter((n) => n.kind === "path");
    expect(paths).toHaveLength(1);
    expect((paths[0] as { broken: boolean }).broken).toBe(true);
  });
});

describe("deriveAccretesFrom", () => {
  it("links memory → slug:<name> with session count note", () => {
    const entities: Entity[] = [
      ent({
        id: "m1",
        type: "memory",
        scope: "slug",
        slugRef: "the-memory-register",
      }),
    ];
    const slugMetadata: SlugMetadata[] = [
      {
        slug: "the-memory-register",
        projectPath: "/home/u/proj",
        sessionCount: 47,
        lastActiveMs: 100,
      },
    ];
    const reg = new PseudoNodeRegistry();
    const rels = deriveAccretesFrom(entities, slugMetadata, reg);
    expect(rels).toHaveLength(1);
    expect(rels[0]).toMatchObject({
      kind: "accretes-from",
      from: "m1",
      to: "slug:the-memory-register",
      note: "47 sessions",
    });
  });

  it("singular 'session' for count of 1", () => {
    const entities: Entity[] = [
      ent({ id: "m1", type: "memory", slugRef: "s" }),
    ];
    const rels = deriveAccretesFrom(
      entities,
      [{ slug: "s", projectPath: "/x", sessionCount: 1, lastActiveMs: 1 }],
      new PseudoNodeRegistry(),
    );
    expect(rels[0]!.note).toBe("1 session");
  });
});

describe("deriveFiresOn", () => {
  it("uses matcher verbatim including '*' and pipes", () => {
    const entities: Entity[] = [
      ent({
        id: "h1",
        type: "hook",
        structured: { matcher: "Bash|Edit", event: "PreToolUse" },
      }),
      ent({
        id: "h2",
        type: "hook",
        structured: { matcher: "*", event: "PostToolUse" },
      }),
    ];
    const reg = new PseudoNodeRegistry();
    const rels = deriveFiresOn(entities, reg);
    expect(rels).toHaveLength(2);
    expect(rels.map((r) => r.to).sort()).toEqual(["tool:*", "tool:Bash|Edit"]);
    expect(rels.every((r) => r.kind === "fires-on")).toBe(true);
  });
});

describe("deriveGates", () => {
  it("uses tool prefix only (Bash(git *) → tool:Bash)", () => {
    const entities: Entity[] = [
      ent({
        id: "p1",
        type: "permission",
        title: "Bash(git *)",
        structured: {
          kind: "permission",
          group: "allow",
          value: "Bash(git *)",
        },
      }),
      ent({
        id: "p2",
        type: "permission",
        title: "Read(~/*)",
        structured: {
          kind: "permission",
          group: "deny",
          value: "Read(~/*)",
        },
      }),
    ];
    const reg = new PseudoNodeRegistry();
    const rels = deriveGates(entities, reg);
    expect(rels.map((r) => r.to).sort()).toEqual(["tool:Bash", "tool:Read"]);
    const p1 = rels.find((r) => r.from === "p1")!;
    expect(p1.note).toBe("allow · Bash(git *)");
  });

  it("emits a mechanical {effect} · {pattern} note", () => {
    const entities: Entity[] = [
      ent({
        id: "p",
        type: "permission",
        structured: {
          kind: "permission",
          group: "deny",
          value: "Bash(rm *)",
        },
      }),
    ];
    const reg = new PseudoNodeRegistry();
    const rels = deriveGates(entities, reg);
    expect(rels[0]!.note).toBe("deny · Bash(rm *)");
  });
});
