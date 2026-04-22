import { NextResponse } from "next/server";
import { loadViewPrefs, saveViewPrefs, type ViewPrefs } from "@/lib/viewPrefs";

export const runtime = "nodejs";

export async function GET() {
  const prefs = await loadViewPrefs();
  return NextResponse.json(prefs);
}

export async function POST(req: Request) {
  const body = (await req.json()) as ViewPrefs;
  await saveViewPrefs(body);
  return NextResponse.json({ ok: true });
}
