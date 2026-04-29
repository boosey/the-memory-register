import { splitFrontmatter, joinFrontmatter } from "./frontmatter";

export interface ParsedAgent {
  name: string;
  description: string;
  tools: string[];
  model: string | null;
  author: string | null;
  enabled: boolean;
  body: string;
  extraFrontmatter: Record<string, unknown>;
}

function coerceTools(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function parseAgent(src: string): ParsedAgent {
  const { frontmatter, body } = splitFrontmatter(src);
  const { name, description, tools, model, author, enabled, disabled, ...extra } =
    frontmatter as {
      name?: string;
      description?: string;
      tools?: unknown;
      model?: string;
      author?: string;
      enabled?: boolean;
      disabled?: boolean;
    };

  let isEnabled = true;
  if (typeof enabled === "boolean") isEnabled = enabled;
  else if (typeof disabled === "boolean") isEnabled = !disabled;

  return {
    name: name ?? "",
    description: description ?? "",
    tools: coerceTools(tools),
    model: typeof model === "string" ? model : null,
    author: typeof author === "string" ? author : null,
    enabled: isEnabled,
    body,
    extraFrontmatter: extra,
  };
}

export function serializeAgent(p: ParsedAgent): string {
  const fm: Record<string, unknown> = {
    name: p.name,
    description: p.description,
    ...p.extraFrontmatter,
  };
  if (p.enabled === false) fm.enabled = false;
  if (p.tools.length > 0) fm.tools = p.tools;
  if (p.model) fm.model = p.model;
  if (p.author) fm.author = p.author;
  return joinFrontmatter(fm, p.body);
}
