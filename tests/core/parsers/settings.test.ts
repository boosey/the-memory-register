import { describe, it, expect } from "vitest";
import { parseSettings, serializeSettings } from "@/core/parsers/settings";

const SAMPLE = `{
  "permissions": { "allow": ["Bash(git *)", "Read(~/*)"], "deny": [] },
  "hooks": {
    "PostToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "echo done" }] }
    ]
  },
  "env": { "DEBUG": "true" },
  "theme": "dark"
}`;

describe("settings parser", () => {
  it("splits permissions into per-rule entries", () => {
    const { entries } = parseSettings(SAMPLE);
    const perms = entries.filter((e) => e.kind === "permission");
    expect(perms).toHaveLength(2);
    expect(perms.map((p) => p.value)).toEqual(["Bash(git *)", "Read(~/*)"]);
  });

  it("splits hooks into per-matcher entries", () => {
    const { entries } = parseSettings(SAMPLE);
    const hooks = entries.filter((e) => e.kind === "hook");
    expect(hooks).toHaveLength(1);
    expect(hooks[0]!.event).toBe("PostToolUse");
    expect(hooks[0]!.matcher).toBe("Bash");
  });

  it("splits env vars into per-name entries", () => {
    const { entries } = parseSettings(SAMPLE);
    const env = entries.filter((e) => e.kind === "env");
    expect(env).toEqual([
      expect.objectContaining({ name: "DEBUG", value: "true" }),
    ]);
  });

  it("rolls up misc top-level keys as 'other' entries", () => {
    const { entries } = parseSettings(SAMPLE);
    expect(
      entries.some(
        (e) => e.kind === "other" && e.key === "theme" && e.value === "dark",
      ),
    ).toBe(true);
  });

  it("round-trips via serializeSettings preserving keys", () => {
    const parsed = parseSettings(SAMPLE);
    const back = serializeSettings(parsed);
    expect(JSON.parse(back)).toEqual(JSON.parse(SAMPLE));
  });
});
