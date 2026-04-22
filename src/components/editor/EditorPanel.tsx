"use client";
import { useArtifact } from "@/hooks/useArtifact";
import { StructuredEditor } from "./StructuredEditor";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { MonacoEscapeHatch } from "./MonacoEscapeHatch";

export function EditorPanel({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const { node, loading } = useArtifact(id);
  const [showRaw, setShowRaw] = useState(false);
  if (!id) return null;

  return (
    <aside className="fixed top-12 right-0 bottom-0 w-[420px] bg-white border-l border-neutral-200 shadow-xl z-20 flex flex-col">
      <header className="flex items-center gap-2 border-b px-4 py-2">
        <div className="font-medium text-sm truncate">
          {node?.title ?? "…"}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          onClick={() => setShowRaw((s) => !s)}
        >
          {showRaw ? "Structured" : "Raw"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          ✕
        </Button>
      </header>
      <div className="flex-1 overflow-auto p-3">
        {loading && <div className="text-neutral-500">Loading…</div>}
        {node && !showRaw && <StructuredEditor node={node} readOnly />}
        {node && showRaw && (
          <MonacoEscapeHatch value={node.rawContent} readOnly />
        )}
      </div>
    </aside>
  );
}
