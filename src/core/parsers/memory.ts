import { splitFrontmatter, joinFrontmatter } from "./frontmatter";

export type MemoryType = "user" | "feedback" | "project" | "reference";

export interface ParsedTypedMemory {
  name: string;
  description: string;
  type: MemoryType;
  body: string;
  extraFrontmatter: Record<string, unknown>;
}

export function parseTypedMemory(src: string): ParsedTypedMemory {
  const { frontmatter, body } = splitFrontmatter(src);
  const { name, description, type, ...extra } = frontmatter as {
    name?: string;
    description?: string;
    type?: MemoryType;
  };
  return {
    name: name ?? "",
    description: description ?? "",
    type: (type as MemoryType) ?? "user",
    body,
    extraFrontmatter: extra,
  };
}

export function serializeTypedMemory(p: ParsedTypedMemory): string {
  return joinFrontmatter(
    {
      name: p.name,
      description: p.description,
      type: p.type,
      ...p.extraFrontmatter,
    },
    p.body,
  );
}

export interface MemoryIndexEntry {
  title: string;
  file: string;
  hook: string;
}

const INDEX_LINE_RE = /^-\s+\[([^\]]+)\]\(([^)]+)\)\s*(?:—|-|\s)\s*(.*)$/;

export function parseMemoryIndex(src: string): MemoryIndexEntry[] {
  const out: MemoryIndexEntry[] = [];
  for (const line of src.split(/\r?\n/)) {
    const m = INDEX_LINE_RE.exec(line);
    if (m) {
      out.push({
        title: m[1]!.trim(),
        file: m[2]!.trim(),
        hook: m[3]!.trim(),
      });
    }
  }
  return out;
}

export function serializeMemoryIndex(entries: MemoryIndexEntry[]): string {
  return [
    "# Memory index",
    "",
    ...entries.map((e) => `- [${e.title}](${e.file}) — ${e.hook}`),
    "",
  ].join("\n");
}
