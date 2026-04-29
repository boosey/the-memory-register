"use client";
import type { Entity, GraphPayload, PseudoNode } from "@/core/entities";
import {
  useHealthFilter,
  type HealthFilterKey,
} from "@/hooks/useHealthFilter";
import { useSignalFilter, type SourceFilter, type StatusFilter } from "@/hooks/useSignalFilter";
import { ProjectSelect } from "./ProjectSelect";

interface HealthRibbonProps {
  graph: GraphPayload;
  entities: readonly Entity[];
  onManageGhosts?: () => void;
}

type Severity = "error" | "warn" | "info";

interface Chip {
  key: HealthFilterKey;
  label: string;
  severity: Severity;
  count: number;
}

function countContested(entities: readonly Entity[]): number {
  const groups = new Map<string, number>();
  for (const e of entities) {
    if (!e.identity) continue;
    groups.set(e.identity, (groups.get(e.identity) ?? 0) + 1);
  }
  let contested = 0;
  for (const n of groups.values()) if (n > 1) contested += 1;
  return contested;
}

function countStale(entities: readonly Entity[]): number {
  let n = 0;
  for (const e of entities) if (e.stale) n += 1;
  return n;
}

function countUnknown(entities: readonly Entity[]): number {
  let n = 0;
  for (const e of entities) if (e.author === "unknown" || e.warn) n += 1;
  return n;
}

function countDeadImports(
  entities: readonly Entity[],
  pseudoNodes: readonly PseudoNode[],
): number {
  let n = 0;
  for (const e of entities) if (e.hasDeadImports) n += 1;
  for (const p of pseudoNodes) if (p.kind === "path" && p.broken) n += 1;
  return n;
}

function countGhostSlugs(pseudoNodes: readonly PseudoNode[]): number {
  let n = 0;
  for (const p of pseudoNodes) if (p.kind === "slug" && p.isGhost) n += 1;
  return n;
}

const SEV_BG: Record<Severity, string> = {
  error: "var(--semantic-error)",
  warn: "var(--semantic-warn)",
  info: "oklch(0.60 0.05 240)",
};

export function HealthRibbon({
  graph,
  entities,
  onManageGhosts,
}: HealthRibbonProps) {
  const filter = useHealthFilter();
  const signalFilter = useSignalFilter();

  const chips: Chip[] = [
    {
      key: "contested",
      label: "Contested",
      severity: "warn",
      count: countContested(entities),
    },
    {
      key: "stale",
      label: "Stale memory",
      severity: "info",
      count: countStale(entities),
    },
    {
      key: "unknown",
      label: "Unknown author",
      severity: "warn",
      count: countUnknown(entities),
    },
    {
      key: "broken-import",
      label: "Dead imports",
      severity: "error",
      count: countDeadImports(entities, graph.pseudoNodes),
    },
  ];

  const ghosts = countGhostSlugs(graph.pseudoNodes);
  const totalIssues = chips.reduce((n, c) => n + c.count, 0);

  const slugs = (
    graph.pseudoNodes.filter((p) => p.kind === "slug") as SlugPseudoNode[]
  ).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div
      data-testid="health-ribbon"
      className="flex items-center gap-[10px] border-y border-[color:var(--rule)] bg-[color:var(--paper-deep)] px-[18px] py-2"
    >
      <div className="flex items-center gap-6">
        <ProjectSelect slugs={slugs} />
        <div className="flex items-center gap-2 border-l border-[color:var(--rule)] pl-6">
          <span className="smallcaps text-[9.5px] text-[color:var(--text-muted)]">Source</span>
          <select
            value={signalFilter.source}
            onChange={(e) => signalFilter.setSource(e.target.value as SourceFilter)}
            className="rounded-sm border border-[color:var(--rule)] bg-[color:var(--paper)] px-1 py-0.5 font-mono text-[11px] outline-none"
          >
            <option value="all">All</option>
            <option value="anthropic">Anthropic</option>
            <option value="community">Community</option>
            <option value="you">You</option>
            <option value="plugin">Plugin (any)</option>
          </select>
        </div>
        <div className="flex items-center gap-2 border-l border-[color:var(--rule)] pl-6">
          <span className="smallcaps text-[9.5px] text-[color:var(--text-muted)]">Status</span>
          <select
            value={signalFilter.status}
            onChange={(e) => signalFilter.setStatus(e.target.value as StatusFilter)}
            className="rounded-sm border border-[color:var(--rule)] bg-[color:var(--paper)] px-1 py-0.5 font-mono text-[11px] outline-none"
          >
            <option value="all">All</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
        <div className="flex items-center gap-2 border-l border-[color:var(--rule)] pl-6">
          <span className="smallcaps text-[9.5px] text-[color:var(--text-muted)]">Informational</span>
          <select
            value={signalFilter.showInformational ? "show" : "hide"}
            onChange={(e) => signalFilter.setShowInformational(e.target.value === "show")}
            className="rounded-sm border border-[color:var(--rule)] bg-[color:var(--paper)] px-1 py-0.5 font-mono text-[11px] outline-none"
          >
            <option value="hide">Hide</option>
            <option value="show">Show</option>
          </select>
        </div>
        <div className="smallcaps ml-4 text-[9.5px] text-[color:var(--text-muted)]">
          Health
        </div>
      </div>
      {chips.map((c) => {
        const active = filter.active === c.key;
        return (
          <button
            key={c.key}
            type="button"
            data-testid={`health-chip-${c.key}`}
            data-active={active ? "true" : "false"}
            onClick={() => filter.toggle(c.key)}
            disabled={c.count === 0}
            className={[
              "flex cursor-pointer items-center gap-[6px] rounded-sm border px-[9px] py-[3px] text-[11.5px] font-medium",
              c.count === 0 ? "opacity-50" : "",
            ].join(" ")}
            style={
              active
                ? {
                    background: "var(--ink)",
                    borderColor: "var(--ink)",
                    color: "var(--paper)",
                  }
                : {
                    background: "transparent",
                    borderColor: "var(--rule)",
                    color: "var(--ink)",
                  }
            }
          >
            <span
              aria-hidden="true"
              className="size-[6px] rounded-full"
              style={{ background: SEV_BG[c.severity] }}
            />
            {c.label}
            <span className="font-mono text-[10px] opacity-70">{c.count}</span>
          </button>
        );
      })}
      <span className="flex-1" />
      {(filter.active ||
        signalFilter.source !== "all" ||
        signalFilter.status !== "all" ||
        signalFilter.showInformational) && (
        <button
          type="button"
          onClick={() => {
            filter.clear();
            signalFilter.clear();
          }}
          data-testid="health-clear-filter"
          className="cursor-pointer border-none bg-transparent text-[11px] text-[color:var(--text-muted)] underline"
        >
          clear filters
        </button>
      )}
      <button
        type="button"
        onClick={onManageGhosts}
        disabled={ghosts === 0}
        className={[
          "cursor-pointer border-none bg-transparent font-mono text-[10px]",
          ghosts > 0
            ? "text-[color:var(--ink)] hover:underline"
            : "text-[color:var(--text-muted)] opacity-50",
        ].join(" ")}
        style={{ letterSpacing: "0.08em" }}
      >
        {ghosts} ghost slug{ghosts === 1 ? "" : "s"}
      </button>
      <span
        className="font-mono text-[10px] text-[color:var(--ink)]"
        style={{ letterSpacing: "0.08em" }}
      >
        {" · "}
        {totalIssues} issue
        {totalIssues === 1 ? "" : "s"}
      </span>
    </div>
  );
}
