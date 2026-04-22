import { describe, it, expect } from "vitest";
import { resolveAuthor } from "@/core/graph/authorResolver";

describe("authorResolver", () => {
  it("prefers frontmatter author for plugin-contributed artifact", () => {
    expect(
      resolveAuthor({
        scope: "plugin",
        frontmatterAuthor: "X",
        pluginManifest: { author: "Plugin Y", publisher: null },
      }),
    ).toEqual({ author: "X", publisher: null, isOfficial: false });
  });

  it("uses plugin manifest author when frontmatter absent", () => {
    expect(
      resolveAuthor({
        scope: "plugin",
        frontmatterAuthor: null,
        pluginManifest: { author: "Plugin Y", publisher: null },
      }),
    ).toEqual({ author: "Plugin Y", publisher: null, isOfficial: false });
  });

  it("marks Anthropic as official via author", () => {
    expect(
      resolveAuthor({
        scope: "plugin",
        frontmatterAuthor: null,
        pluginManifest: { author: "Anthropic", publisher: "anthropic" },
      }),
    ).toEqual({
      author: "Anthropic",
      publisher: "anthropic",
      isOfficial: true,
    });
  });

  it("defaults to 'self' for user scopes", () => {
    expect(
      resolveAuthor({
        scope: "project",
        frontmatterAuthor: null,
        pluginManifest: null,
      }),
    ).toEqual({ author: "self", publisher: null, isOfficial: false });
  });

  it("returns null author for plugin with no manifest info", () => {
    expect(
      resolveAuthor({
        scope: "plugin",
        frontmatterAuthor: null,
        pluginManifest: null,
      }),
    ).toEqual({ author: null, publisher: null, isOfficial: false });
  });
});
