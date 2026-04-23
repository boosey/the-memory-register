"use client";
import { useEffect, useMemo, useState } from "react";
import type { Entity, Relation } from "@/core/entities";
import type { ParsedTypedMemory } from "@/core/parsers/memory";
import { buildNextContentFor } from "@/lib/buildNextContent";
import { BodyEditor } from "./BodyEditor";
import { FormRow, monoClass, ecBtnClass } from "./shared";
import type { TypedEditorProps } from "./editorTypes";

function structured(entity: Entity): ParsedTypedMemory {
  return (
    (entity.structured as ParsedTypedMemory) ?? {
      name: entity.title,
      description: entity.intent,
      type: "user",
      body: "",
      extraFrontmatter: {},
    }
  );
}

interface MemoryEditorProps extends TypedEditorProps {
  relations?: readonly Relation[];
  onDeleted?: () => void;
  onSaved?: () => void;
}

export function MemoryEditor({
  entity,
  onApiReady,
  onTitleChange,
  relations = [],
  onDeleted,
  onSaved,
}: MemoryEditorProps) {
  const initial = useMemo(() => structured(entity), [entity]);
  const [filename, setFilename] = useState(initial.name || entity.title);
  const [body, setBody] = useState(initial.body ?? "");
  const [busy, setBusy] = useState<"delete" | "dismiss-stale" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const accretesRel = useMemo(
    () =>
      relations.find(
        (r) => r.from === entity.id && r.kind === "accretes-from",
      ),
    [relations, entity.id],
  );

  useEffect(() => {
    onTitleChange?.(filename);
  }, [filename, onTitleChange]);

  useEffect(() => {
    const draft: ParsedTypedMemory = {
      ...initial,
      name: filename,
      body,
    };
    onApiReady({
      currentTitle: filename,
      getSerializedContent: () => buildNextContentFor(entity, draft),
    });
  }, [filename, body, entity, initial, onApiReady]);

  async function handleDelete() {
    if (!window.confirm("Delete this memory file? This cannot be undone.")) return;
    setBusy("delete");
    setNote(null);
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
      if (!j.ok) setNote(String(j.reason ?? "delete failed"));
      else {
        setNote("Memory deleted.");
        onDeleted?.();
      }
    } catch (e) {
      setNote(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleDismissStale() {
    setBusy("dismiss-stale");
    setNote(null);
    try {
      const r = await fetch("/api/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "dismiss-stale",
          entityIds: [entity.id],
          confirm: true,
        }),
      });
      const j = await r.json();
      if (!j.ok) setNote(String(j.reason ?? "dismiss failed"));
      else {
        setNote("Stale flag cleared.");
        onSaved?.(); // Refetch to update stale flag in UI
      }
    } catch (e) {
      setNote(String(e));
    } finally {
      setBusy(null);
    }
  }

  const ghost = ecBtnClass();
  const destructive = ecBtnClass(false, true);

  return (
    <div>
      <FormRow label="File name">
        <input
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          className={monoClass()}
        />
      </FormRow>
      <FormRow
        label="Content"
        hint="Memory contents. Claude re-reads these at session start."
      >
        <BodyEditor
          value={body}
          onChange={setBody}
          allowMarkdownToggle
          unknownFields={initial.extraFrontmatter}
        />
      </FormRow>

      <div
        data-testid="memory-provenance"
        className="mt-[8px] rounded-sm border border-[color:var(--rule-soft)] bg-[color:var(--paper-deep)] px-[14px] py-[12px]"
      >
        <div className="smallcaps mb-[6px] text-[10px] tracking-[0.18em] text-[color:var(--text-muted)]">
          Provenance
        </div>
        <div className="text-[12.5px] leading-[1.6] text-[color:var(--ink)]">
          Accreted from{" "}
          <b>
            {accretesRel
              ? accretesRel.to.replace(/^slug:/, "")
              : entity.slugRef ?? "sessions"}
          </b>
          {accretesRel?.note && (
            <>
              {" "}
              ·{" "}
              <span className="text-[color:var(--text-muted)]">
                {accretesRel.note}
              </span>
            </>
          )}
          {entity.stale && (
            <>
              {" "}
              ·{" "}
              <b style={{ color: "var(--semantic-warn)" }}>stale (14d)</b>
            </>
          )}
        </div>
        <div className="mt-[10px] flex flex-wrap gap-[6px]">
          <button
            type="button"
            onClick={() => setNote("Re-accrete lands in v1.8.")}
            className={ghost.className}
            style={ghost.style}
          >
            Re-accrete from recent sessions
          </button>
          <button
            type="button"
            onClick={() => setNote("Source-turn browsing lands in v1.8.")}
            className={ghost.className}
            style={ghost.style}
          >
            View source turns
          </button>

          {entity.stale && (
            <button
              type="button"
              onClick={handleDismissStale}
              disabled={busy !== null}
              className={ghost.className}
              style={ghost.style}
            >
              {busy === "dismiss-stale" ? "clearing…" : "Dismiss stale flag"}
            </button>
          )}

          <button
            type="button"
            onClick={handleDelete}
            disabled={busy !== null}
            className={destructive.className}
            style={destructive.style}
          >
            {busy === "delete" ? "deleting…" : "Dismiss memory"}
          </button>
        </div>
        {note && (
          <div className="mt-[8px] text-[11.5px] text-[color:var(--text-muted)]">
            {note}
          </div>
        )}
      </div>
    </div>
  );
}
