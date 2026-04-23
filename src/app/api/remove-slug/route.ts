import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { resolveHomePaths } from "@/core/paths";
import { invalidate } from "@/lib/graphCache";

export async function POST(req: Request) {
  try {
    const { slug } = await req.json();
    if (!slug) {
      return NextResponse.json({ ok: false, message: "slug required" }, { status: 400 });
    }

    const { projectsDir } = resolveHomePaths();
    const slugPath = path.join(projectsDir, slug);

    // Verify it's actually under projectsDir for safety
    if (!slugPath.startsWith(projectsDir)) {
      return NextResponse.json({ ok: false, message: "invalid slug" }, { status: 400 });
    }

    // Check if it exists
    try {
      await fs.access(slugPath);
    } catch {
      return NextResponse.json({ ok: false, message: "slug directory not found" }, { status: 404 });
    }

    // Delete it recursively
    await fs.rm(slugPath, { recursive: true, force: true });
    invalidate();

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: (e as Error).message },
      { status: 500 }
    );
  }
}
