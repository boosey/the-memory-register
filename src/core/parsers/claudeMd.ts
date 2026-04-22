export interface ClaudeMdSection {
  heading: string;
  level: number;
  headingPath: string[];
  body: string;
  imports: string[];
}

const HEADING_RE = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/gm;
const IMPORT_RE = /@([^\s)<>]+)/g;

interface HeadingHit {
  index: number;
  length: number;
  level: number;
  heading: string;
}

export function parseClaudeMd(src: string): ClaudeMdSection[] {
  const headings: HeadingHit[] = [];
  for (const m of src.matchAll(HEADING_RE)) {
    headings.push({
      index: m.index!,
      length: m[0].length,
      level: m[1]!.length,
      heading: m[2]!.trim(),
    });
  }

  const out: ClaudeMdSection[] = [];
  const firstStart = headings[0]?.index ?? src.length;
  if (firstStart > 0) {
    const body = src.slice(0, firstStart);
    if (body.trim().length > 0) {
      out.push({
        heading: "",
        level: 0,
        headingPath: [],
        body,
        imports: extractImports(body),
      });
    }
  }

  const stack: HeadingHit[] = [];
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]!;
    while (stack.length > 0 && stack[stack.length - 1]!.level >= h.level) {
      stack.pop();
    }
    stack.push(h);
    const next = headings[i + 1];
    const bodyStart = h.index + h.length;
    const bodyEnd = next ? next.index : src.length;
    const body = src.slice(bodyStart, bodyEnd);
    out.push({
      heading: h.heading,
      level: h.level,
      headingPath: stack.map((s) => s.heading),
      body,
      imports: extractImports(body),
    });
  }

  if (out.length === 0) {
    out.push({
      heading: "",
      level: 0,
      headingPath: [],
      body: src,
      imports: extractImports(src),
    });
  }
  return out;
}

export function serializeClaudeMd(sections: ClaudeMdSection[]): string {
  let out = "";
  for (const s of sections) {
    if (s.level > 0) out += `${"#".repeat(s.level)} ${s.heading}`;
    out += s.body;
  }
  return out;
}

function extractImports(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(IMPORT_RE)) {
    const p = m[1]!;
    if (p.startsWith("http") || p.includes("@anthropic.com")) continue;
    out.push(p);
  }
  return Array.from(new Set(out));
}
