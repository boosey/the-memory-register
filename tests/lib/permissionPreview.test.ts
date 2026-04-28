import { describe, it, expect } from "vitest";
import {
  permissionPreview,
  permissionPreviewColorClass,
  parsePermissionValue,
  formatPermissionValue,
} from "@/lib/permissionPreview";

describe("permissionPreview", () => {
  it("formats with effect · Tool(pattern) shape", () => {
    expect(
      permissionPreview({ effect: "allow", tool: "Bash", pattern: "git *" }),
    ).toBe("allow · Bash(git *)");
  });

  it("substitutes * for empty pattern", () => {
    expect(
      permissionPreview({ effect: "deny", tool: "Read", pattern: "" }),
    ).toBe("deny · Read(*)");
  });

  it("renders each effect value verbatim in the preview", () => {
    for (const effect of ["allow", "ask", "deny"] as const) {
      expect(
        permissionPreview({ effect, tool: "Edit", pattern: "src/**" }),
      ).toBe(`${effect} · Edit(src/**)`);
    }
  });
});

describe("permissionPreviewColorClass", () => {
  it("returns the matching semantic var class for each effect", () => {
    expect(permissionPreviewColorClass("allow")).toContain("--semantic-ok");
    expect(permissionPreviewColorClass("ask")).toContain("--semantic-warn");
    expect(permissionPreviewColorClass("deny")).toContain("--semantic-error");
  });
});

describe("parsePermissionValue / formatPermissionValue", () => {
  it("round-trips through tool(pattern)", () => {
    const parsed = parsePermissionValue("Bash(git *)");
    expect(parsed).toEqual({ tool: "Bash", pattern: "git *" });
    expect(formatPermissionValue(parsed.tool, parsed.pattern)).toBe("Bash(git *)");
  });

  it("treats a bare tool as no pattern", () => {
    expect(parsePermissionValue("Write")).toEqual({
      tool: "Write",
      pattern: "",
    });
    expect(formatPermissionValue("Write", "")).toBe("Write");
  });

  it("handles complex MCP tool names with hyphens and underscores", () => {
    const mcpTool = "mcp__plugin_chrome-devtools-mcp_chrome-devtools__evaluate_script";
    const parsed = parsePermissionValue(`${mcpTool}(args)`);
    expect(parsed).toEqual({
      tool: mcpTool,
      pattern: "args",
    });
    expect(formatPermissionValue(parsed.tool, parsed.pattern)).toBe(`${mcpTool}(args)`);
  });
});
