import { splitFrontmatter, joinFrontmatter } from "./frontmatter";

export interface ParsedCommand {
  description: string;
  author: string | null;
  enabled: boolean;
  body: string;
  extraFrontmatter: Record<string, unknown>;
}

export function parseCommand(src: string): ParsedCommand {
  const { frontmatter, body } = splitFrontmatter(src);
  const { description, author, enabled, disabled, ...extra } = frontmatter as {
    description?: string;
    author?: string;
    enabled?: boolean;
    disabled?: boolean;
  };

  let isEnabled = true;
  if (typeof enabled === "boolean") isEnabled = enabled;
  else if (typeof disabled === "boolean") isEnabled = !disabled;

  return {
    description: description ?? "",
    author: typeof author === "string" ? author : null,
    enabled: isEnabled,
    body,
    extraFrontmatter: extra,
  };
}

export function serializeCommand(p: ParsedCommand): string {
  const fm: Record<string, unknown> = {
    description: p.description,
    ...p.extraFrontmatter,
  };
  if (p.enabled === false) fm.enabled = false;
  if (p.author) fm.author = p.author;
  return joinFrontmatter(fm, p.body);
}
