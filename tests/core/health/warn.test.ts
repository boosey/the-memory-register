import { describe, it, expect } from "vitest";
import { shouldWarn } from "@/core/health/warn";
import type { Entity } from "@/core/entities";

function ent(partial: Partial<Entity>): Entity {
  return {
    id: "x",
    type: "skill",
    scope: "global",
    author: "unknown",
    title: "",
    intent: "",
    sourceFile: "/abs/x.md",
    scopeRoot: "/abs",
    mtimeMs: 0,
    rawContent: "",
    ...partial,
  };
}

describe("shouldWarn", () => {
  it("true for plugin-scope entity with unknown author", () => {
    expect(shouldWarn(ent({ author: "unknown", plugin: "some-plugin" }))).toBe(true);
  });

  it("false when scope is not plugin", () => {
    // In v1.7+, 'plugin' is not a scope; shouldWarn checks the 'plugin' property.
    expect(shouldWarn(ent({ author: "unknown", plugin: undefined }))).toBe(false);
  });

  it("false when author is not unknown", () => {
    expect(shouldWarn(ent({ author: "community", plugin: "some-plugin" }))).toBe(
      false,
    );
  });
});
