import { NextResponse } from "next/server";
import { restoreLastBackup } from "@/core/save/undo";
import { resolveHomePaths } from "@/core/paths";
import { invalidate } from "@/lib/graphCache";
import { z } from "zod";

const Schema = z.object({ sourceFile: z.string(), scopeRoot: z.string() });

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { backupsDir } = resolveHomePaths();
  const res = await restoreLastBackup({ ...parsed.data, backupsDir });
  if (res.ok) invalidate();
  return NextResponse.json(res, { status: res.ok ? 200 : 404 });
}
