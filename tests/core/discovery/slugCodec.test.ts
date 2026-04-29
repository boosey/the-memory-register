import { describe, it, expect, vi } from "vitest";
import { slugToPath, pathToSlug } from "@/core/discovery/slugCodec";
import fs from "node:fs";

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(),
  },
}));

describe("slugCodec", () => {
  it("decodes Windows-style slugs to absolute paths", () => {
    const exists = (p: string) => p === "C:\\Users\\boose\\projects\\the-memory-register";
    expect(slugToPath("C--Users-boose-projects-the-memory-register", exists)).toBe(
      "C:\\Users\\boose\\projects\\the-memory-register",
    );
  });

  it("decodes POSIX-style slugs", () => {
    expect(slugToPath("-Users-alice-code-proj")).toBe("/Users/alice/code/proj");
  });

  it("round-trips POSIX paths", () => {
    const slug = pathToSlug("/Users/alice/code/proj");
    expect(slugToPath(slug)).toBe("/Users/alice/code/proj");
  });

  it("round-trips Windows paths", () => {
    const slug = pathToSlug("C:\\Users\\boose\\projects\\the-memory-register");
    expect(slugToPath(slug)).toBe("C:\\Users\\boose\\projects\\the-memory-register");
  });

  it("handles dashes inside path segments via escaped double-dash", () => {
    const slug = pathToSlug("/opt/my-tool/sub");
    expect(slugToPath(slug)).toBe("/opt/my-tool/sub");
  });
});
