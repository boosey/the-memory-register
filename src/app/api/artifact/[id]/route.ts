import { NextResponse } from "next/server";
import { crawl } from "@/core/discovery";
import { buildGraph } from "@/core/graph/builder";
import { resolveHomePaths } from "@/core/paths";
import { getCached, setCached } from "@/lib/graphCache";

export const runtime = "nodejs";

export async function GET(
  _: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  let graph = getCached();
  if (!graph) {
    const paths = resolveHomePaths();
    const { raws, ghostSlugs, slugMetadata } = await crawl({
      claudeHome: paths.claudeHome,
    });
    graph = buildGraph(raws);
    graph.ghostSlugs = ghostSlugs;
    graph.slugMetadata = slugMetadata;
    setCached(graph);
  }
  const node = graph.nodes.find((n) => n.id === id);
  if (!node) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(node);
}
