"use client";
import { useState } from "react";
import { useGraph } from "@/hooks/useGraph";
import { TopBar } from "@/components/TopBar";
import { InventoryView } from "@/components/InventoryView";
import { ConnectionOverlay } from "@/components/ConnectionOverlay";
import { GraphView } from "@/components/GraphView";
import { EditorPanel } from "@/components/editor/EditorPanel";

export default function HomePage() {
  const { graph, loading, error } = useGraph();
  const [tab, setTab] = useState<"inventory" | "graph">("inventory");
  const [showConnections, setShowConnections] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-neutral-100">
      <TopBar
        activeTab={tab}
        onTabChange={setTab}
        showConnections={showConnections}
        onToggleConnections={setShowConnections}
      />
      {loading && <div className="p-6 text-neutral-500">Loading…</div>}
      {error && <div className="p-6 text-red-600">Error: {error}</div>}
      {graph && tab === "inventory" && (
        <>
          <InventoryView
            graph={graph}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <ConnectionOverlay graph={graph} enabled={showConnections} />
        </>
      )}
      {graph && tab === "graph" && (
        <GraphView graph={graph} onSelect={setSelectedId} />
      )}
      <EditorPanel id={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
