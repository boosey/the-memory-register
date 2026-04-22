import fs from "node:fs/promises";
import path from "node:path";
import type {
  RawArtifact,
  ArtifactKind,
  ArtifactGranularity,
  Scope,
  GhostSlug,
  SlugMetadata,
} from "../types";
import { slugToPath } from "./slugCodec";

export interface CrawlOptions {
  claudeHome: string;
  knownProjectPaths?: string[];
}

export interface CrawlResult {
  raws: RawArtifact[];
  ghostSlugs: GhostSlug[];
  slugMetadata: SlugMetadata[];
  crawledAtMs: number;
}

export async function crawl(opts: CrawlOptions): Promise<CrawlResult> {
  const { claudeHome } = opts;
  const raws: RawArtifact[] = [];
  const ghostSlugs: GhostSlug[] = [];
  const slugMetadata: SlugMetadata[] = [];

  // Global scope
  await pushIfFile(
    raws,
    path.join(claudeHome, "CLAUDE.md"),
    "claude-md-section",
    "entry",
    "global",
    claudeHome,
  );
  await pushIfFile(
    raws,
    path.join(claudeHome, "settings.json"),
    "settings-entry",
    "entry",
    "global",
    claudeHome,
  );
  await pushIfFile(
    raws,
    path.join(claudeHome, "keybindings.json"),
    "keybindings",
    "file",
    "global",
    claudeHome,
  );
  await pushDirFiles(
    raws,
    path.join(claudeHome, "skills"),
    "skill",
    "file",
    "global",
    claudeHome,
  );
  await pushDirFiles(
    raws,
    path.join(claudeHome, "commands"),
    "slash-command",
    "file",
    "global",
    claudeHome,
  );

  // Plugin scope — plugins may live at any depth under ~/.claude/plugins/
  // (e.g. plugins/cache/<source>/<name>/<version>/.claude-plugin/plugin.json).
  // Walk the tree and treat the dir containing each manifest as a plugin root.
  const pluginsDir = path.join(claudeHome, "plugins");
  for (const pluginDir of await findPluginRoots(pluginsDir)) {
    const manifestCandidates = [
      path.join(pluginDir, ".claude-plugin", "plugin.json"),
      path.join(pluginDir, "plugin.json"),
      path.join(pluginDir, "package.json"),
    ];
    for (const m of manifestCandidates) {
      if (await fileExists(m)) {
        await pushIfFile(
          raws,
          m,
          "plugin-manifest",
          "file",
          "plugin",
          pluginDir,
        );
        break;
      }
    }
    await pushDirFiles(
      raws,
      path.join(pluginDir, "skills"),
      "skill",
      "file",
      "plugin",
      pluginDir,
    );
    await pushDirFiles(
      raws,
      path.join(pluginDir, "commands"),
      "slash-command",
      "file",
      "plugin",
      pluginDir,
    );
  }

  // Slug scope (auto-memory)
  const projectsDir = path.join(claudeHome, "projects");
  const projectPaths = new Set<string>(opts.knownProjectPaths ?? []);
  for (const slugDir of await listDirs(projectsDir)) {
    const slug = path.basename(slugDir);
    const expectedPath = slugToPath(slug);
    if (await dirExists(expectedPath)) {
      projectPaths.add(expectedPath);
    } else {
      ghostSlugs.push({ slug, expectedPath });
    }

    const memDir = path.join(slugDir, "memory");
    if (await dirExists(memDir)) {
      await pushIfFile(
        raws,
        path.join(memDir, "MEMORY.md"),
        "memory-index-entry",
        "entry",
        "slug",
        slugDir,
        slug,
      );
      for (const p of await listFiles(memDir, ".md")) {
        if (path.basename(p) === "MEMORY.md") continue;
        await pushIfFile(raws, p, "typed-memory", "file", "slug", slugDir, slug);
      }
    }

    const sessions = await listFiles(slugDir, ".jsonl");
    let lastActiveMs = 0;
    for (const s of sessions) {
      try {
        const st = await fs.stat(s);
        if (st.mtimeMs > lastActiveMs) lastActiveMs = st.mtimeMs;
      } catch {
        /* ignore */
      }
    }
    slugMetadata.push({
      slug,
      projectPath: expectedPath,
      sessionCount: sessions.length,
      lastActiveMs,
    });
  }

  // Project + Local scope per known project path
  for (const proj of projectPaths) {
    for (const fname of ["CLAUDE.md", "AGENTS.md", "GEMINI.md"]) {
      await pushIfFile(
        raws,
        path.join(proj, fname),
        "claude-md-section",
        "entry",
        "project",
        proj,
      );
    }
    await pushIfFile(
      raws,
      path.join(proj, ".claude", "settings.json"),
      "settings-entry",
      "entry",
      "project",
      proj,
    );
    await pushDirFiles(
      raws,
      path.join(proj, ".claude", "skills"),
      "skill",
      "file",
      "project",
      proj,
    );
    await pushDirFiles(
      raws,
      path.join(proj, ".claude", "commands"),
      "slash-command",
      "file",
      "project",
      proj,
    );
    await pushIfFile(
      raws,
      path.join(proj, "CLAUDE.local.md"),
      "claude-md-section",
      "entry",
      "local",
      proj,
    );
    await pushIfFile(
      raws,
      path.join(proj, ".claude", "settings.local.json"),
      "settings-entry",
      "entry",
      "local",
      proj,
    );
  }

  return { raws, ghostSlugs, slugMetadata, crawledAtMs: Date.now() };
}

async function fileExists(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isFile();
  } catch {
    return false;
  }
}

async function dirExists(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function listDirs(p: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(p, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => path.join(p, e.name));
  } catch {
    return [];
  }
}

async function listFiles(dir: string, ext: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(ext))
      .map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}

async function pushIfFile(
  out: RawArtifact[],
  file: string,
  kind: ArtifactKind,
  granularity: ArtifactGranularity,
  scope: Scope,
  scopeRoot: string,
  slug?: string,
) {
  if (!(await fileExists(file))) return;
  const stat = await fs.stat(file);
  const rawContent = await fs.readFile(file, "utf8");
  const base: RawArtifact = {
    id: makeId(kind, scope, file),
    kind,
    granularity,
    scope,
    sourceFile: file,
    scopeRoot,
    rawContent,
    mtimeMs: stat.mtimeMs,
  };
  out.push(slug ? { ...base, slug } : base);
}

async function pushDirFiles(
  out: RawArtifact[],
  dir: string,
  kind: ArtifactKind,
  granularity: ArtifactGranularity,
  scope: Scope,
  scopeRoot: string,
) {
  if (!(await dirExists(dir))) return;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop()!;
    const entries = await fs
      .readdir(cur, { withFileTypes: true })
      .catch(() => []);
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        stack.push(full);
      } else if (e.isFile()) {
        const isSkill = kind === "skill" && e.name === "SKILL.md";
        const isCmd = kind === "slash-command" && e.name.endsWith(".md");
        if (isSkill || isCmd) {
          await pushIfFile(out, full, kind, granularity, scope, scopeRoot);
        }
      }
    }
  }
}

function makeId(kind: string, scope: Scope, sourceFile: string): string {
  return `${kind}::${scope}::${sourceFile}`;
}

async function findPluginRoots(pluginsRoot: string): Promise<string[]> {
  if (!(await dirExists(pluginsRoot))) return [];
  const roots = new Set<string>();
  const stack = [pluginsRoot];
  const MAX_DEPTH = 8;
  const depths = new Map<string, number>([[pluginsRoot, 0]]);
  while (stack.length) {
    const cur = stack.pop()!;
    const depth = depths.get(cur) ?? 0;
    // Is `cur` a plugin root? Check for manifest candidates.
    const manifestCandidates = [
      path.join(cur, ".claude-plugin", "plugin.json"),
      path.join(cur, "plugin.json"),
    ];
    let matched = false;
    for (const m of manifestCandidates) {
      if (await fileExists(m)) {
        roots.add(cur);
        matched = true;
        break;
      }
    }
    if (matched || depth >= MAX_DEPTH) continue;
    for (const child of await listDirs(cur)) {
      depths.set(child, depth + 1);
      stack.push(child);
    }
  }
  return Array.from(roots);
}
