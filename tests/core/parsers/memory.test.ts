import { describe, it, expect } from "vitest";
import {
  parseTypedMemory,
  serializeTypedMemory,
  parseMemoryIndex,
  serializeMemoryIndex,
} from "@/core/parsers/memory";

const MEM_SAMPLE = `---
name: user_role
description: User's profession
type: user
---
Alex is a data scientist.`;

const INDEX_SAMPLE = `# Memory index

- [User role](user_role.md) — profession notes
- [Project deadlines](project_deadlines.md) — Q2 plan
`;

describe("typed memory parser", () => {
  it("parses frontmatter fields", () => {
    const p = parseTypedMemory(MEM_SAMPLE);
    expect(p).toMatchObject({
      name: "user_role",
      description: "User's profession",
      type: "user",
    });
  });

  it("round-trips", () => {
    const p = parseTypedMemory(MEM_SAMPLE);
    expect(serializeTypedMemory(p)).toBe(MEM_SAMPLE);
  });
});

describe("memory index parser", () => {
  it("extracts entries", () => {
    const e = parseMemoryIndex(INDEX_SAMPLE);
    expect(e).toEqual([
      { title: "User role", file: "user_role.md", hook: "profession notes" },
      {
        title: "Project deadlines",
        file: "project_deadlines.md",
        hook: "Q2 plan",
      },
    ]);
  });

  it("round-trips list entries", () => {
    const e = parseMemoryIndex(INDEX_SAMPLE);
    const back = serializeMemoryIndex(e);
    expect(parseMemoryIndex(back)).toEqual(e);
  });
});
