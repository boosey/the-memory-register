import { NextResponse } from "next/server";
import path from "node:path";
import { crawl } from "@/core/discovery";
import { buildPayload } from "@/core/graph/transform";
import { resolveHomePaths } from "@/core/paths";
import { getCachedPayload, setCached } from "@/lib/graphCache";

export const runtime = "nodejs";

export async function GET() {
  const hit = getCachedPayload();
  if (hit) return NextResponse.json(hit);

  const paths = resolveHomePaths();
  const extra = process.env.THE_MEMORY_REGISTER_EXTRA_PROJECTS
    ? process.env.THE_MEMORY_REGISTER_EXTRA_PROJECTS.split(path.delimiter).filter(Boolean)
    : [];
  const { raws, ghostSlugs, slugMetadata, crawledAtMs } = await crawl({
    claudeHome: paths.claudeHome,
    ...(extra ? { knownProjectPaths: extra } : {}),
  });
  const { payload, nodes } = buildPayload({
    raws,
    slugMetadata,
    ghostSlugs,
    crawledAtMs,
  });
  setCached(payload, nodes);
  return NextResponse.json(payload);
}
