import { splitFrontmatter, joinFrontmatter } from "./frontmatter";

export interface ParsedSkill {
  name: string;
  description: string;
  author: string | null;
  enabled: boolean;
  body: string;
  extraFrontmatter: Record<string, unknown>;
}

export function parseSkill(src: string): ParsedSkill {
  const { frontmatter, body } = splitFrontmatter(src);
  const { name, description, author, enabled, disabled, ...extra } = frontmatter as {
    name?: string;
    description?: string;
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
    author: typeof author === "string" ? author : null,
    enabled: isEnabled,
    body,
    extraFrontmatter: extra,
  };
}

export function serializeSkill(p: ParsedSkill): string {
  const fm: Record<string, unknown> = {
    name: p.name,
    description: p.description,
    ...p.extraFrontmatter,
  };
  if (p.enabled === false) fm.enabled = false;
  if (p.author) fm.author = p.author;
  return joinFrontmatter(fm, p.body);
}
