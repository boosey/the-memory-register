import { describe, it, expect } from "vitest";
import { parseClaudeMd, serializeClaudeMd } from "@/core/parsers/claudeMd";

const SAMPLE = `# Global Preferences
Top-level intro.

## Agent Teams
Always use Agent Teams...

## Git Worktrees
Prefer \`/new-worktree\`.
`;

describe("claudeMd parser", () => {
  it("splits by ATX headings into sections with headingPath", () => {
    const sections = parseClaudeMd(SAMPLE);
    expect(sections).toHaveLength(3);
    expect(sections[0]).toMatchObject({
      heading: "Global Preferences",
      level: 1,
      headingPath: ["Global Preferences"],
    });
    expect(sections[1]).toMatchObject({
      heading: "Agent Teams",
      level: 2,
      headingPath: ["Global Preferences", "Agent Teams"],
    });
  });

  it("round-trips content byte-for-byte", () => {
    const sections = parseClaudeMd(SAMPLE);
    expect(serializeClaudeMd(sections)).toBe(SAMPLE);
  });

  it("handles files with no headings (single anonymous section)", () => {
    const sections = parseClaudeMd("Just a prose file.\n");
    expect(sections).toHaveLength(1);
    expect(sections[0]!.heading).toBe("");
  });

  it("detects @imports in bodies", () => {
    const src = `# A\n\n@./shared/tone.md\n\n## B\nsee @./other.md here\n`;
    const sections = parseClaudeMd(src);
    expect(sections[0]!.imports).toEqual(["./shared/tone.md"]);
    expect(sections[1]!.imports).toEqual(["./other.md"]);
  });
});
