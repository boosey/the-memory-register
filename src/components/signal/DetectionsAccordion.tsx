"use client";
import { useState } from "react";
import type { Detection } from "@/core/entities";

interface DetectionsAccordionProps {
  detections: readonly Detection[];
}

export function DetectionsAccordion({ detections }: DetectionsAccordionProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);

  const totalOccurrences = detections.reduce(
    (n, d) => n + d.occurrences.length,
    0,
  );

  if (detections.length === 0) return null;

  const toggleConvention = (key: string) => {
    setExpanded((curr) => {
      const next = new Set(curr);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  async function handleOpenFollowup(d: Detection) {
    setPending(d.convention);
    try {
      const res = await fetch("/api/followup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(d),
      });
      const j = await res.json();
      if (!j.ok) {
        console.error("Failed to open followup:", j.message);
      }
    } catch (e) {
      console.error("Failed to open followup:", e);
    } finally {
      setPending(null);
    }
  }

  return (
    <div
      data-testid="detections-accordion"
      data-open={open ? "true" : "false"}
      className="rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--paper)]"
    >
      <button
        type="button"
        data-testid="detections-toggle"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[11.5px] font-medium text-[color:var(--ink)]"
      >
        <span className="inline-block w-[10px] text-[color:var(--text-muted)]">
          {open ? "▾" : "▸"}
        </span>
        Detections
        <span className="font-mono text-[10px] text-[color:var(--text-muted)]">
          · {detections.length} convention{detections.length === 1 ? "" : "s"}
          {" · "}
          {totalOccurrences} occurrence{totalOccurrences === 1 ? "" : "s"}
        </span>
      </button>
      {open && (
        <div className="border-t border-[color:var(--rule-soft)]">
          {detections.map((d) => {
            const isExpanded = expanded.has(d.convention);
            const examples = d.occurrences.slice(0, 20);
            return (
              <div
                key={d.convention}
                data-testid="detection-convention"
                data-convention={d.convention}
                data-expanded={isExpanded ? "true" : "false"}
                className="border-t border-[color:var(--rule-soft)] first:border-t-0"
              >
                <div className="flex items-center gap-2 px-3 py-[6px]">
                  <button
                    type="button"
                    data-testid={`detection-toggle-${d.convention}`}
                    onClick={() => toggleConvention(d.convention)}
                    className="flex flex-1 cursor-pointer items-center gap-2 bg-transparent text-left text-[12px] text-[color:var(--ink)]"
                  >
                    <span className="inline-block w-[10px] text-[color:var(--text-muted)]">
                      {isExpanded ? "▾" : "▸"}
                    </span>
                    {d.label}
                    <span className="font-mono text-[10px] text-[color:var(--text-muted)]">
                      {d.occurrences.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={pending === d.convention}
                    onClick={() => handleOpenFollowup(d)}
                    className="smallcaps cursor-pointer rounded-sm border border-[color:var(--rule)] bg-transparent px-[8px] py-[3px] text-[9.5px] tracking-[0.14em] text-[color:var(--text-muted)] disabled:opacity-50"
                  >
                    {pending === d.convention ? "opening..." : "open followup"}
                  </button>
                </div>
                {isExpanded && examples.length > 0 && (
                  <ul
                    data-testid={`detection-examples-${d.convention}`}
                    className="mb-2 list-none px-7 pb-1 text-[11px] text-[color:var(--text-muted)]"
                  >
                    {examples.map((occ, i) => (
                      <li
                        key={`${d.convention}-${i}`}
                        className="truncate font-mono"
                      >
                        {occ.sourceFile}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
