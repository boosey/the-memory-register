"use client";
import Image from "next/image";
import { useMemo, useState } from "react";
import {
  ENTITY_TYPE_ORDER,
  SCOPE_PRECEDENCE,
  type Entity,
  type EntityType,
  type GraphPayload,
  type PseudoNode,
  type Relation,
  type SlugPseudoNode,
} from "@/core/entities";
import { Footer } from "@/components/signal/Footer";
import { HealthRibbon } from "@/components/signal/HealthRibbon";
import { Masthead } from "@/components/signal/Masthead";
import { SchematicHeader } from "@/components/signal/SchematicHeader";
import { SignalRow } from "@/components/signal/SignalRow";
import { TracingBanner } from "@/components/signal/TracingBanner";
import { TracingBlurb, type GroupBy } from "@/components/signal/TracingBlurb";
import { TypeTabs } from "@/components/signal/TypeTabs";
import { EditorDrawer } from "@/components/signal/EditorDrawer";
import { BulkActionBar } from "@/components/signal/BulkActionBar";
import { UndoToaster } from "@/components/signal/UndoToast";
import { BrokenImportModal } from "@/components/signal/BrokenImportModal";
import { GhostSlugModal } from "@/components/signal/GhostSlugModal";
import { PinnedProvider, usePinned } from "@/hooks/usePinned";
import { SelectionProvider, useSelection } from "@/hooks/useSelection";
import {
  HealthFilterProvider,
  groupMatchesFilter,
  useHealthFilter,
} from "@/hooks/useHealthFilter";
import { ProjectFilterProvider, useProjectFilter } from "@/hooks/useProjectFilter";
import { useGraph } from "@/hooks/useGraph";
import { SignalFilterProvider, useSignalFilter, entityMatchesSignalFilter } from "@/hooks/useSignalFilter";

export default function HomePage() {
  return (
    <PinnedProvider>
      <SelectionProvider>
        <HealthFilterProvider>
          <ProjectFilterProvider>
            <SignalFilterProvider>
              <SignalFlowPage />
              <UndoToaster />
            </SignalFilterProvider>
          </ProjectFilterProvider>
        </HealthFilterProvider>
      </SelectionProvider>
    </PinnedProvider>
  );
}

function SignalFlowPage() {
  const { graph, loading, error, refetch } = useGraph();

  if (loading) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-[color:var(--text-muted)]">
          <Image
            src="/app_icon_v2.png"
            alt="The Memory Register Logo"
            width={64}
            height={64}
            className="animate-pulse rounded-xl opacity-20 grayscale"
          />
          <div className="text-[13px] font-medium tracking-tight">
            Scanning configuration…
          </div>
        </div>
      </Shell>
    );
  }
  if (error) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-[color:var(--semantic-error)]">
          <Image
            src="/app_icon_v2.png"
            alt="The Memory Register Logo"
            width={64}
            height={64}
            className="rounded-xl opacity-20 grayscale"
          />
          <div className="text-[13px] font-medium tracking-tight">
            Failed to load graph: {error}
          </div>
        </div>
      </Shell>
    );
  }
  if (!graph) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-[color:var(--text-muted)]">
          <Image
            src="/app_icon_v2.png"
            alt="The Memory Register Logo"
            width={64}
            height={64}
            className="rounded-xl opacity-20 grayscale"
          />
          <div className="text-[13px] font-medium tracking-tight">No data found.</div>
        </div>
      </Shell>
    );
  }
  return <Loaded graph={graph} refetch={refetch} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-full flex-1 flex-col">
      <Masthead />
      {children}
    </main>
  );
}

interface GroupedRow {
  key: string;
  group: Entity[];
  winner: Entity;
}

function groupByIdentity(entities: readonly Entity[]): GroupedRow[] {
  const groups = new Map<string, Entity[]>();
  for (const e of entities) {
    const key = e.identity ?? `id:${e.id}`;
    const arr = groups.get(key);
    if (arr) arr.push(e);
    else groups.set(key, [e]);
  }
  const rows: GroupedRow[] = [];
  for (const [key, group] of groups) {
    group.sort(
      (a, b) => SCOPE_PRECEDENCE[a.scope] - SCOPE_PRECEDENCE[b.scope],
    );
    const winner = group[group.length - 1];
    if (!winner) continue;
    rows.push({ key, group, winner });
  }
  rows.sort((a, b) => a.winner.title.localeCompare(b.winner.title));
  return rows;
}

function groupByFile(entities: readonly Entity[]): GroupedRow[] {
  const groups = new Map<string, Entity[]>();
  for (const e of entities) {
    const key = e.sourceFile;
    const arr = groups.get(key);
    if (arr) arr.push(e);
    else groups.set(key, [e]);
  }
  const rows: GroupedRow[] = [];
  for (const [, group] of groups) {
    // When grouping by file, we don't collapse by identity; each entity
    // in the file gets its own row.
    for (const e of group) {
      rows.push({
        key: e.id,
        group: [e],
        winner: e,
      });
    }
  }
  rows.sort((a, b) => {
    const fileComp = a.winner.sourceFile.localeCompare(b.winner.sourceFile);
    if (fileComp !== 0) return fileComp;
    return a.winner.title.localeCompare(b.winner.title);
  });
  return rows;
}

function Loaded({
  graph,
  refetch,
}: {
  graph: GraphPayload;
  refetch: () => void;
}) {
  const [activeType, setActiveType] = useState<EntityType>(() => {
    for (const t of ENTITY_TYPE_ORDER) {
      if (t === "enabled-plugins") continue;
      if (graph.entities.some((e) => e.type === t)) return t;
    }
    return "standing-instruction";
  });

  const { pinnedId, pin, unpin } = usePinned();
  const selection = useSelection();
  const healthFilter = useHealthFilter();
  const projectFilter = useProjectFilter();
  const signalFilter = useSignalFilter();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("file");
  const [manageGhostsOpen, setManageGhostsOpen] = useState(false);
  const [brokenImport, setBrokenImport] = useState<{
    relation: Relation;
    importer: Entity;
    target: PseudoNode | undefined;
  } | null>(null);

  const winningIds = useMemo(() => {
    const groups = new Map<string, Entity[]>();
    for (const e of graph.entities) {
      const key = e.identity ?? `id:${e.id}`;
      const arr = groups.get(key);
      if (arr) arr.push(e);
      else groups.set(key, [e]);
    }
    const winners = new Set<string>();
    for (const group of groups.values()) {
      group.sort(
        (a, b) => SCOPE_PRECEDENCE[b.scope] - SCOPE_PRECEDENCE[a.scope],
      );
      if (group[0]) winners.add(group[0].id);
    }
    return winners;
  }, [graph.entities]);

  const entitiesById = useMemo(() => {
    const m = new Map<string, Entity>();
    for (const e of graph.entities) m.set(e.id, e);
    return m;
  }, [graph.entities]);

  const entitiesByIdentity = useMemo(() => {
    const m = new Map<string, Entity[]>();
    for (const e of graph.entities) {
      const key = e.identity ?? `id:${e.id}`;
      const arr = m.get(key) ?? [];
      arr.push(e);
      m.set(key, arr);
    }
    return m;
  }, [graph.entities]);

  const targetsById = useMemo(() => {
    const m = new Map<string, Entity | PseudoNode>();
    for (const e of graph.entities) m.set(e.id, e);
    for (const p of graph.pseudoNodes) m.set(p.id, p);
    return m;
  }, [graph.entities, graph.pseudoNodes]);

  const relationsByEntity = useMemo(() => {
    const out = new Map<string, Relation[]>();
    const inb = new Map<string, Relation[]>();
    for (const r of graph.relations) {
      const o = out.get(r.from);
      if (o) o.push(r);
      else out.set(r.from, [r]);
      const i = inb.get(r.to);
      if (i) i.push(r);
      else inb.set(r.to, [r]);
    }
    return { out, inb };
  }, [graph.relations]);

  const activeProject = useMemo(() => {
    if (!projectFilter.activeSlug) return null;
    return graph.pseudoNodes.find(
      (p) => p.kind === "slug" && p.name === projectFilter.activeSlug,
    ) as SlugPseudoNode | undefined;
  }, [graph.pseudoNodes, projectFilter.activeSlug]);

  const filteredEntities = useMemo(() => {
    if (!activeProject) return graph.entities;
    return graph.entities.filter((e) => {
      // Global scope always applies.
      if (e.scope === "global") return true;
      // Slug scope must match the selected slug.
      if (e.scope === "slug") return e.slugRef === activeProject.name;
      // Project and local scopes must match the decoded project path.
      if (e.scope === "project" || e.scope === "local") {
        return e.scopeRoot === activeProject.projectPath;
      }
      return false;
    });
  }, [graph.entities, activeProject]);

  const rows = useMemo(() => {
    const byType = filteredEntities.filter((e) => e.type === activeType);
    return groupBy === "identity" ? groupByIdentity(byType) : groupByFile(byType);
  }, [filteredEntities, activeType, groupBy]);

  const visibleRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          groupMatchesFilter(r.group, healthFilter.active, graph.pseudoNodes) &&
          r.group.some((e) =>
            entityMatchesSignalFilter(
              e,
              signalFilter.source,
              signalFilter.status,
              signalFilter.showInformational,
            ),
          ),
      ),
    [
      rows,
      healthFilter.active,
      graph.pseudoNodes,
      signalFilter.source,
      signalFilter.status,
      signalFilter.showInformational,
    ],
  );

  const pinnedEntity = pinnedId ? entitiesById.get(pinnedId) : undefined;
  const pinnedPseudo = pinnedId
    ? graph.pseudoNodes.find((p) => p.id === pinnedId)
    : undefined;
  const pinnedTarget = pinnedEntity ?? pinnedPseudo;

  const relatedSet = useMemo(() => {
    const s = new Set<string>();
    if (!pinnedId) return s;
    for (const r of graph.relations) {
      if (r.from === pinnedId) s.add(r.to);
      if (r.to === pinnedId) s.add(r.from);
    }
    return s;
  }, [pinnedId, graph.relations]);

  const kindCount = useMemo(() => {
    if (!pinnedId) return 0;
    const kinds = new Set<EntityType>();
    for (const id of relatedSet) {
      const e = entitiesById.get(id);
      if (e) kinds.add(e.type);
    }
    return kinds.size;
  }, [pinnedId, relatedSet, entitiesById]);

  function handleOpenEditor(groupKey: string) {
    setExpandedKey(expandedKey === groupKey ? null : groupKey);
  }

  function handleSaved() {
    setExpandedKey(null);
    refetch();
  }

  function handleOpenEntity(e: Entity) {
    setActiveType(e.type);
    const key = e.identity ?? `id:${e.id}`;
    setExpandedKey(key);
  }

  return (
    <main className="flex min-h-full flex-1 flex-col pb-[72px]">
      <Masthead />
      <HealthRibbon
        graph={graph}
        entities={filteredEntities}
        onManageGhosts={() => setManageGhostsOpen(true)}
      />
      {pinnedTarget && (
        <TracingBanner
          pinned={pinnedTarget}
          relatedCount={relatedSet.size}
          kindCount={kindCount}
          onClear={unpin}
        />
      )}
      <TypeTabs
        entities={filteredEntities}
        relations={graph.relations}
        activeType={activeType}
        pinnedId={pinnedId}
        onSelectType={setActiveType}
      />
      <TracingBlurb
        activeType={activeType}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
      />

      <div className="flex-1 overflow-auto px-7 pt-[14px] pb-[60px]">
        <SchematicHeader />
        <div className="mt-[10px]">
          {visibleRows.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-[color:var(--text-muted)]">
              {rows.length === 0
                ? "No entities of this kind."
                : "No entities match the current filter."}
            </div>
          ) : (
            (() => {
              let lastFile = "";
              return visibleRows.map(({ key, group, winner }) => {
                const out = relationsByEntity.out.get(winner.id) ?? [];
                const inb = relationsByEntity.inb.get(winner.id) ?? [];
                const isPinned = group.some((e) => e.id === pinnedId);
                const isRelated =
                  !isPinned && group.some((e) => relatedSet.has(e.id));
                const isChecked = group.some((e) =>
                  selection.isSelected(e.id),
                );
                const isExpanded = expandedKey === key;
                const showFileHeader = groupBy === "file" && winner.sourceFile !== lastFile;
                if (showFileHeader) lastFile = winner.sourceFile;

                const identityKey = winner.identity ?? `id:${winner.id}`;
                const identityGroup = entitiesByIdentity.get(identityKey);
                
                // In File mode, the 'winner' of the row is just the single entity.
                // But we need to know who the logical winner of the identity group is.
                const globalWinnerId = Array.from(winningIds).find(id => {
                  const e = entitiesById.get(id);
                  return e && (e.identity === winner.identity || e.id === winner.id);
                });
                const globalWinner = globalWinnerId ? entitiesById.get(globalWinnerId) : winner;

                return (
                  <div key={key} data-testid="signal-row-wrapper">
                    {showFileHeader && <FileHeader path={winner.sourceFile} />}
                    <SignalRow
                      group={group}
                      winner={globalWinner!}
                      groupKey={key}
                      identityGroup={identityGroup}
                      relationsOut={out}
                      relationsIn={inb}
                      targetsById={targetsById}
                      isPinned={isPinned}
                      isRelated={isRelated}
                      isChecked={isChecked}
                      isExpanded={isExpanded}
                      onPin={(id) =>
                        pinnedId === id ? unpin() : pin(id)
                      }
                      onPinTarget={(id) => pin(id)}
                      onToggleSelect={selection.toggle}
                      onOpenEditor={handleOpenEditor}
                      onResolveImport={(rel, imp, target) =>
                        setBrokenImport({ relation: rel, importer: imp, target })
                      }
                    />
                    {isExpanded && (
                      <EditorDrawer
                        entity={globalWinner!}
                        group={identityGroup!}
                        allEntities={graph.entities}
                        relations={graph.relations}
                        onClose={() => setExpandedKey(null)}
                        onSaved={handleSaved}
                        onOpenEntity={handleOpenEntity}
                      />
                    )}
                  </div>
                );
              });
            })()
          )}
        </div>
      </div>

      <Footer detections={graph.detections} />
      <BulkActionBar entities={filteredEntities} onApplied={handleSaved} />
      {brokenImport && (
        <BrokenImportModal
          relation={brokenImport.relation}
          importer={brokenImport.importer}
          target={brokenImport.target}
          onClose={() => setBrokenImport(null)}
          onResolved={() => {
            setBrokenImport(null);
            refetch();
          }}
        />
      )}
      {manageGhostsOpen && (
        <GhostSlugModal
          ghosts={graph.pseudoNodes.filter(
            (p) => p.kind === "slug" && p.isGhost,
          ) as SlugPseudoNode[]}
          onClose={() => setManageGhostsOpen(false)}
          onRemoved={() => {
            setManageGhostsOpen(false);
            refetch();
          }}
        />
      )}
    </main>
  );
}

function FileHeader({ path }: { path: string }) {
  return (
    <div className="sticky top-0 z-10 -mx-2 mb-1 mt-6 border-b border-[color:var(--rule)] bg-[color:var(--paper-deep)] px-2 py-1.5">
      <div className="flex items-center gap-2 text-[11px] font-bold tracking-tight text-[color:var(--text-muted)]">
        <span className="opacity-50">FILE:</span>
        <span className="font-mono">{path}</span>
      </div>
    </div>
  );
}
