import type { ArtifactKind } from "../types";

interface InputLike {
  kind: ArtifactKind;
  structuredData?: unknown;
  rawContent: string;
}

export function deriveIntentSummary(input: InputLike): string {
  const sd = input.structuredData as Record<string, unknown> | null | undefined;

  if (input.kind === "plugin-manifest" && sd) {
    const desc = typeof sd.description === "string" ? sd.description : "";
    const ver = typeof sd.version === "string" ? sd.version : "";
    const summary = ver ? `v${ver}${desc ? ` · ${desc}` : ""}` : desc;
    return truncate(summary.trim(), 120);
  }

  if (sd && typeof sd.description === "string" && sd.description.trim()) {
    return truncate(sd.description.trim(), 120);
  }

  if (input.kind === "settings-entry" && sd) {
    return summarizeSettingsEntry(sd);
  }

  if (
    input.kind === "keybindings" &&
    sd &&
    Array.isArray(sd.entries) &&
    sd.entries.length > 0
  ) {
    return `${sd.entries.length} bindings`;
  }

  const body =
    (sd && typeof sd.body === "string" ? sd.body : undefined) ??
    input.rawContent;
  if (body) {
    const sentence = firstSentence(body);
    if (sentence) return truncate(sentence, 120);
  }

  return "";
}

function summarizeSettingsEntry(sd: Record<string, unknown>): string {
  if (sd.kind === "permission") return `${sd.entryKey} → "${sd.value}"`;
  if (sd.kind === "hook") return `${sd.event} / ${sd.matcher}`;
  if (sd.kind === "env") {
    const val =
      typeof sd.value === "object" && sd.value !== null
        ? JSON.stringify(sd.value)
        : String(sd.value);
    return `${sd.name}=${val}`;
  }
  if (sd.kind === "other") return `${sd.key}`;
  return "";
}

function firstSentence(body: string): string | null {
  const trimmed = body.replace(/^\s+/, "");
  const m = /[^.!?\n]*[.!?]/.exec(trimmed);
  if (m) return m[0].trim();
  const line = trimmed.split(/\r?\n/)[0]?.trim() ?? "";
  return line || null;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";
}
