import { NextResponse } from "next/server";
import path from "node:path";
import { crawl } from "@/core/discovery";
import { buildGraph } from "@/core/graph/builder";
import { resolveHomePaths } from "@/core/paths";
import { getCached, setCached } from "@/lib/graphCache";

export const runtime = "nodejs";

export async function GET() {
  const hit = getCached();
  if (hit) return NextResponse.json(hit);

  const paths = resolveHomePaths();
  const extra = process.env.MEMMGMT_EXTRA_PROJECTS
    ? process.env.MEMMGMT_EXTRA_PROJECTS.split(path.delimiter).filter(Boolean)
    : undefined;
  const { raws, ghostSlugs, slugMetadata } = await crawl({
    claudeHome: paths.claudeHome,
    ...(extra ? { knownProjectPaths: extra } : {}),
  });
  const graph = buildGraph(raws);
  graph.ghostSlugs = ghostSlugs;
  graph.slugMetadata = slugMetadata;
  setCached(graph);
  return NextResponse.json(graph);
}
