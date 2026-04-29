import fs from "node:fs";

// Claude Code's slug scheme:
//   "/foo/bar"           ->  "-foo-bar"
//   "C:\\Users\\boose"   ->  "C--Users-boose"
//   "/opt/my-tool"       ->  "-opt-my--tool"   (literal "-" doubled)

function isWindowsDriveSlug(slug: string): boolean {
  return /^[A-Za-z]--/.test(slug);
}

/**
 * Decodes a slug to a filesystem path. Performs greedy dash-as-separator
 * parsing by default, but refined by filesystem-aware disambiguation if
 * a synchronous `exists` probe is provided or if running in Node.
 */
export function slugToPath(slug: string, exists?: (p: string) => boolean): string {
  const isWindows = isWindowsDriveSlug(slug);
  const sep = isWindows ? "\\" : "/";
  
  let rest: string;
  let prefix = "";
  
  if (isWindows) {
    prefix = `${slug[0]!}:\\`;
    rest = slug.slice(3);
  } else if (slug.startsWith("-")) {
    prefix = "/";
    rest = slug.slice(1);
  } else {
    rest = slug;
  }
  
  const segments = decodeDashes(rest);
  const greedy = prefix + segments.join(sep);

  const check = exists ?? ((p: string) => {
    try {
      return typeof window === "undefined" && fs.existsSync(p);
    } catch {
      return false;
    }
  });

  // Try greedy first
  if (check(greedy)) return greedy;

  // Greedy hit nothing. Try merging adjacent segments with dashes.
  const found = findValidPathSync(prefix, segments, sep, check);
  return found ?? greedy;
}

function findValidPathSync(
  currentPrefix: string,
  remaining: string[],
  sep: string,
  exists: (p: string) => boolean,
): string | null {
  if (remaining.length === 0) {
    return exists(currentPrefix) ? currentPrefix : null;
  }

  // Try using the first segment as a directory
  const nextDir = currentPrefix + (currentPrefix.endsWith(sep) ? "" : sep) + remaining[0]!;
  const hit = findValidPathSync(nextDir, remaining.slice(1), sep, exists);
  if (hit) return hit;

  // Try merging the first two segments with a dash
  if (remaining.length >= 2) {
    const merged = remaining[0]! + "-" + remaining[1]!;
    const nextRemaining = [merged, ...remaining.slice(2)];
    return findValidPathSync(currentPrefix, nextRemaining, sep, exists);
  }

  return null;
}

/**
 * Filesystem-aware slug resolution. If the greedy decode doesn't exist,
 * tries merging segments with dashes until a hit is found.
 */
export async function resolveSlugToPath(
  slug: string,
  exists: (p: string) => Promise<boolean>,
): Promise<string> {
  const isWindows = isWindowsDriveSlug(slug);
  const sep = isWindows ? "\\" : "/";
  
  let rest: string;
  let prefix = "";
  
  if (isWindows) {
    prefix = `${slug[0]!}:\\`;
    rest = slug.slice(3);
  } else if (slug.startsWith("-")) {
    prefix = "/";
    rest = slug.slice(1);
  } else {
    rest = slug;
  }
  
  const segments = decodeDashes(rest);
  
  // Try greedy first
  const greedy = prefix + segments.join(sep);
  if (await exists(greedy)) return greedy;
  
  // Greedy hit nothing. Try merging adjacent segments with dashes.
  // This is a simple recursive search for a valid path.
  const found = await findValidPath(prefix, segments, sep, exists);
  return found ?? greedy;
}

async function findValidPath(
  currentPrefix: string,
  remaining: string[],
  sep: string,
  exists: (p: string) => Promise<boolean>,
): Promise<string | null> {
  if (remaining.length === 0) {
    return (await exists(currentPrefix)) ? currentPrefix : null;
  }

  // Try using the first segment as a directory
  const nextDir = currentPrefix + (currentPrefix.endsWith(sep) ? "" : sep) + remaining[0]!;
  const hit = await findValidPath(nextDir, remaining.slice(1), sep, exists);
  if (hit) return hit;

  // Try merging the first two segments with a dash
  if (remaining.length >= 2) {
    const merged = remaining[0]! + "-" + remaining[1]!;
    const nextRemaining = [merged, ...remaining.slice(2)];
    // Optimization: only recurse if the merged path is still a candidate? 
    // No, we can't know until we reach the end or see if the prefix exists.
    return findValidPath(currentPrefix, nextRemaining, sep, exists);
  }

  return null;
}

export function pathToSlug(abs: string): string {
  const winMatch = /^([A-Za-z]):[\\/](.*)$/.exec(abs);
  if (winMatch) {
    const drive = winMatch[1]!;
    const rest = winMatch[2]!;
    const segments = rest.split(/[\\/]/);
    return `${drive}--${encodeSegments(segments)}`;
  }
  if (abs.startsWith("/")) {
    const segments = abs.slice(1).split("/");
    return `-${encodeSegments(segments)}`;
  }
  return encodeSegments(abs.split(/[\\/]/));
}

function encodeSegments(segments: string[]): string {
  return segments.map((s) => s.replace(/-/g, "--")).join("-");
}

function decodeDashes(encoded: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < encoded.length; i++) {
    const c = encoded[i]!;
    if (c === "-") {
      if (encoded[i + 1] === "-") {
        cur += "-";
        i++;
      } else {
        out.push(cur);
        cur = "";
      }
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}
