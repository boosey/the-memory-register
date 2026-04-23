"use client";
import type { SlugPseudoNode } from "@/core/entities";
import { useProjectFilter } from "@/hooks/useProjectFilter";

interface ProjectSelectProps {
  slugs: readonly SlugPseudoNode[];
}

export function ProjectSelect({ slugs }: ProjectSelectProps) {
  const { activeSlug, set } = useProjectFilter();

  const activeProject = slugs.find((s) => s.name === activeSlug);

  const sortedSlugs = [...slugs]
    .filter((s) => !s.isGhost)
    .map((s) => {
      const parts = s.projectPath.split(/[\\\/]/).filter(Boolean);
      const dirName = parts[parts.length - 1] || s.name;
      return { ...s, dirName };
    })
    .sort((a, b) => a.dirName.localeCompare(b.dirName));

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="smallcaps text-[9px] text-[color:var(--text-muted)]">
          Project
        </span>
        <select
          value={activeSlug ?? ""}
          onChange={(e) => set(e.target.value || null)}
          className="max-w-[120px] cursor-pointer border-0 bg-transparent font-sans text-[11.5px] font-medium text-[color:var(--ink)] outline-none hover:underline"
        >
          <option value="">All Projects</option>
          {sortedSlugs.map((s) => (
            <option key={s.id} value={s.name}>
              {s.dirName}
            </option>
          ))}
        </select>
      </div>
      {activeProject && (
        <div
          title={activeProject.projectPath}
          className="max-w-[200px] truncate font-mono text-[10px] text-[color:var(--ink)] opacity-70"
        >
          {activeProject.projectPath}
        </div>
      )}
    </div>
  );
}
