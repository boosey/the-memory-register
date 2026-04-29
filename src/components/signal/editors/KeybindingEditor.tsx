"use client";
import { useEffect, useMemo, useState } from "react";
import type { Entity } from "@/core/entities";
import type { ParsedKeybindings } from "@/core/parsers/keybindings";
import { buildNextContentFor } from "@/lib/buildNextContent";
import { FormRow, ecBtnClass, monoClass } from "./shared";
import type { TypedEditorProps } from "./editorTypes";

interface Row {
  chord: string;
  action: string;
}

function structured(entity: Entity): ParsedKeybindings {
  return (
    (entity.structured as ParsedKeybindings) ?? {
      raw: {},
      entries: [],
    }
  );
}

function formatChord(e: KeyboardEvent | React.KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey) parts.push("⌘");
  if (e.ctrlKey) parts.push("⌃");
  if (e.altKey) parts.push("⌥");
  if (e.shiftKey) parts.push("⇧");
  let key = e.key;
  if (key === " ") key = "Space";
  if (key.length === 1) key = key.toUpperCase();
  if (
    key !== "Meta" &&
    key !== "Control" &&
    key !== "Alt" &&
    key !== "Shift"
  ) {
    parts.push(key);
  }
  return parts.join(" ");
}

export function KeybindingEditor({ entity, onApiReady }: TypedEditorProps) {
  const initial = useMemo(() => structured(entity), [entity]);
  const [rows, setRows] = useState<Row[]>(() =>
    initial.entries.map((e) => ({ chord: e.chord, action: e.action })),
  );
  const [capturingIdx, setCapturingIdx] = useState<number | null>(null);

  useEffect(() => {
    const draft: ParsedKeybindings = {
      raw: Object.fromEntries(
        rows.filter((r) => r.chord && r.action).map((r) => [r.chord, r.action]),
      ),
      entries: rows,
    };
    onApiReady({
      getSerializedContent: () => buildNextContentFor(entity, draft),
    });
  }, [rows, entity, onApiReady]);

  function update(i: number, patch: Partial<Row>) {
    setRows((curr) => {
      const next = [...curr];
      const existing = next[i];
      if (!existing) return curr;
      next[i] = { ...existing, ...patch };
      return next;
    });
  }
  function remove(i: number) {
    setRows((curr) => curr.filter((_, j) => j !== i));
  }
  function add() {
    setRows((curr) => [...curr, { chord: "", action: "" }]);
  }

  function handleChordKeyDown(i: number) {
    return (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (capturingIdx !== i) return;
      e.preventDefault();
      const chord = formatChord(e);
      if (chord) {
        update(i, { chord });
        setCapturingIdx(null);
      }
    };
  }

  return (
    <div>
      <FormRow
        label="Chords"
        hint="Click a chord cell and press the keys you want. Chords are captured, not typed."
      >
        <div
          data-testid="keybinding-table"
          className="overflow-hidden rounded-sm border border-[color:var(--rule)] bg-[color:var(--paper)]"
        >
          <div
            className="grid gap-2 border-b border-[color:var(--rule-soft)] bg-[color:var(--paper-deep)] px-[10px] py-[6px]"
            style={{ gridTemplateColumns: "160px 1fr 30px" }}
          >
            <span className="smallcaps text-[9.5px] tracking-[0.18em] text-[color:var(--text-muted)]">
              Chord
            </span>
            <span className="smallcaps text-[9.5px] tracking-[0.18em] text-[color:var(--text-muted)]">
              Action
            </span>
            <span />
          </div>
          {rows.map((r, i) => {
            const capturing = capturingIdx === i;
            return (
              <div
                key={i}
                className="grid items-center gap-2 border-t border-[color:var(--rule-soft)] px-[10px] py-[4px] first:border-t-0"
                style={{ gridTemplateColumns: "160px 1fr 30px" }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  aria-pressed={capturing}
                  onFocus={() => setCapturingIdx(i)}
                  onBlur={() => setCapturingIdx((v) => (v === i ? null : v))}
                  onClick={(e) => {
                    (e.currentTarget as HTMLDivElement).focus();
                  }}
                  onKeyDown={handleChordKeyDown(i)}
                  className="cursor-pointer rounded-[3px] border border-[color:var(--rule)] bg-[color:var(--paper-deep)] px-[10px] py-[4px] text-center font-mono text-[12.5px] text-[color:var(--ink)] outline-none"
                  style={{
                    borderColor: capturing
                      ? "var(--ink)"
                      : "var(--rule)",
                  }}
                >
                  {r.chord || (
                    <span className="text-[color:var(--text-faint)]">
                      {capturing ? "listening…" : "press chord…"}
                    </span>
                  )}
                </div>
                <input
                  value={r.action}
                  onChange={(e) => update(i, { action: e.target.value })}
                  className={`${monoClass()} px-2 py-1 text-[11.5px]`}
                  placeholder="action id"
                />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="cursor-pointer border-none bg-transparent text-[14px] text-[color:var(--text-muted)]"
                >
                  ×
                </button>
              </div>
            );
          })}
          <div className="border-t border-[color:var(--rule-soft)] px-[10px] py-[8px]">
            <button
              type="button"
              onClick={add}
              className={ecBtnClass().className}
              style={ecBtnClass().style}
            >
              add chord
            </button>
          </div>
        </div>
      </FormRow>
    </div>
  );
}
