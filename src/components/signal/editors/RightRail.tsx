"use client";
import { useState } from "react";
import type { Entity } from "@/core/entities";
import { describePath } from "@/lib/describePath";
import type {
  SavePreviewRequest,
  SavePreviewResponse,
} from "@/core/apiContracts";
import { TYPE_LABELS } from "../typeLabels";
import { DiffPreviewModal } from "../DiffPreviewModal";
import { showUndoToast } from "../UndoToast";
import { ecBtnClass } from "./shared";
import type { EditorApi } from "./editorTypes";

interface RightRailProps {
  entity: Entity;
  currentFormTitle?: string;
  /** Access to the editor's current state and content. */
  api: EditorApi;
  onSaved: () => void;
  /** Strings that identify the section(s) being edited.
   * Used by DiffPreviewModal to scroll to and highlight the changes. */
  stanzas?: string[];
}

function inferLanguage(sourceFile: string): string {
  if (sourceFile.endsWith(".json")) return "json";
  if (sourceFile.endsWith(".md")) return "markdown";
  return "markdown";
}

export function RightRail({
  entity,
  currentFormTitle,
  api,
  onSaved,
  stanzas,
}: RightRailProps) {
  const [pending, setPending] = useState<"preview" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffData, setDiffData] = useState<{
    before: string;
    after: string;
    noop: boolean;
  } | null>(null);

  const writePath = describePath(entity, {
    ...(currentFormTitle ? { title: currentFormTitle } : {}),
  });
  const typeLabel = TYPE_LABELS[entity.type].label;

  const ghost = ecBtnClass();
  const primary = ecBtnClass(true);
  const destructive = ecBtnClass(false, true);

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete this ${typeLabel.toLowerCase()}? This cannot be undone.`,
      )
    ) {
      return;
    }
    setPending("save");
    setError(null);
    try {
      const r = await fetch("/api/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "delete-entity",
          entityIds: [entity.id],
          confirm: true,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setError(String(j.reason ?? j.message ?? "delete failed"));
        return;
      }
      onSaved();
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setPending(null);
    }
  }

  async function handlePreview() {
    setPending("preview");
    setError(null);
    try {
      const body: SavePreviewRequest = {
        sourceFile: api.sourceFile ?? entity.sourceFile,
        scopeRoot: api.scopeRoot ?? entity.scopeRoot,
        nextContent: api.getSerializedContent(),
        expectedMtimeMs: api.expectedMtimeMs ?? entity.mtimeMs,
      };
      const r = await fetch("/api/save/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as SavePreviewResponse;
      if (!j.ok) {
        setError(String(j.reason ?? j.message ?? "preview failed"));
        return;
      }
      setDiffData({ before: j.before, after: j.after, noop: j.noop });
      setDiffOpen(true);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setPending(null);
    }
  }

  async function handleSave(isNew = false) {
    setPending("save");
    setError(null);
    try {
      const sourceFile = api.sourceFile ?? entity.sourceFile;
      const scopeRoot = api.scopeRoot ?? entity.scopeRoot;
      const r = await fetch("/api/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceFile,
          scopeRoot,
          nextContent: api.getSerializedContent({ isNew }),
          expectedMtimeMs: isNew ? undefined : (api.expectedMtimeMs ?? entity.mtimeMs),
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setError(String(j.reason ?? j.error ?? "save failed"));
        return;
      }
      showUndoToast({
        sourceFile,
        scopeRoot,
        label: isNew
          ? `Added new ${typeLabel.toLowerCase()}`
          : `Saved ${typeLabel.toLowerCase()} · ${entity.title}`,
      });
      onSaved();
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setPending(null);
    }
  }

  const supportsSaveAsNew = entity.type === "permission" || entity.type === "hook";

  return (
    <div
      data-testid="right-rail"
      className="border-l border-[color:var(--rule)] pl-[20px]"
    >
      <div className="smallcaps mb-[8px] text-[10px] tracking-[0.2em] text-[color:var(--text-muted)]">
        Safety
      </div>
      <div className="mb-[12px] text-[12px] leading-[1.5] text-[color:var(--text-muted)]">
        Edits preview a diff, write a timestamped backup, then apply. Undo is
        one click.
      </div>
      <div className="mb-[20px] flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handlePreview}
          disabled={pending !== null}
          className={ghost.className}
          style={ghost.style}
          data-testid="right-rail-preview"
        >
          {pending === "preview" ? "previewing…" : "Preview diff"}
        </button>
        <button
          type="button"
          onClick={() => handleSave(false)}
          disabled={pending !== null}
          className={primary.className}
          style={primary.style}
          data-testid="right-rail-save"
        >
          {pending === "save" ? "saving…" : "Save with backup"}
        </button>
        {supportsSaveAsNew && (
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={pending !== null}
            className={ghost.className}
            style={ghost.style}
            data-testid="right-rail-save-new"
          >
            Save as New
          </button>
        )}
        {!(entity.plugin && entity.type !== "plugin") && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending !== null}
            className={destructive.className}
            style={destructive.style}
            data-testid="right-rail-delete"
          >
            {pending === "save"
              ? "deleting…"
              : `Delete ${entity.type === "memory" ? "memory" : "entity"}`}
          </button>
        )}
      </div>
      {error && (
        <div
          className="mb-[12px] text-[11.5px]"
          style={{ color: "var(--semantic-error)" }}
        >
          {error}
        </div>
      )}
      <div className="smallcaps mb-[6px] text-[10px] tracking-[0.2em] text-[color:var(--text-muted)]">
        Writes to
      </div>
      <div
        data-testid="right-rail-path"
        className="font-mono text-[11px] leading-[1.5] break-all text-[color:var(--ink)]"
      >
        {writePath}
      </div>
      <div className="mt-[3px] font-mono text-[10px] text-[color:var(--text-faint)]">
        {typeLabel.toLowerCase()} · {entity.scope} scope
      </div>

      <DiffPreviewModal
        open={diffOpen}
        before={diffData?.before ?? ""}
        after={diffData?.after ?? ""}
        language={inferLanguage(api.sourceFile ?? entity.sourceFile)}
        {...(diffData?.noop ? { noop: true } : {})}
        onClose={() => setDiffOpen(false)}
        stanzas={stanzas}
      />
    </div>
  );
}
