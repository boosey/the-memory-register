import { NextResponse } from "next/server";
import { z } from "zod";
import { dispatchBulk } from "@/core/save/bulkOps";
import { resolveHomePaths } from "@/core/paths";
import { getOrBuildGraph, invalidate } from "@/lib/graphCache";
import type { BulkRequest } from "@/core/apiContracts";

const Schema = z.object({
  action: z.enum([
    "resolve-to-winner",
    "delete-shadowed",
    "promote-scope",
    "demote-scope",
    "dismiss-stale",
    "flag-for-review",
    "delete-entity",
    "merge-into-winner",
    "keep-as-override",
  ]),
  entityIds: z.array(z.string()),
  confirm: z.boolean().optional(),
  targetScope: z
    .enum(["global", "plugin", "slug", "project", "local"])
    .optional(),
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { backupsDir, claudeHome } = resolveHomePaths();
  const { payload } = await getOrBuildGraph();
  const res = await dispatchBulk(parsed.data as BulkRequest, {
    backupsDir,
    claudeHome,
    knownEntities: payload.entities,
  });
  if (res.ok) invalidate();
  return NextResponse.json(res, { status: res.ok ? 200 : 409 });
}
