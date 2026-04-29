import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { DetectionOccurrence } from "@/core/entities";

export async function POST(req: Request) {
  try {
    const { convention, label, occurrences } = await req.json();
    
    // In a real npx-distributed app, the repo path might not be easily locatable.
    // However, the PRD says it's a local-only web app running on the user's machine.
    // For this implementation, we'll try to locate the followups.md in the current working dir's docs folder.
    const followupsPath = path.join(process.cwd(), "docs", "superpowers", "followups.md");
    
    const timestamp = new Date().toISOString().split("T")[0];
    const newEntry = `
## Detection followup: ${label} (${timestamp})

**Convention:** \`${convention}\`
**Occurrences:** ${occurrences.length}
**Example files:**
${occurrences.slice(0, 5).map((o: DetectionOccurrence) => `- \`${o.sourceFile}\``).join("\n")}

**Proposed v2 fix:** [TBD]
`;

    try {
      await fs.mkdir(path.dirname(followupsPath), { recursive: true });
      await fs.appendFile(followupsPath, newEntry, "utf8");
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json(
        { ok: false, message: `Failed to write to followups.md: ${(e as Error).message}` },
        { status: 500 }
      );
    }
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: (e as Error).message },
      { status: 500 }
    );
  }
}
