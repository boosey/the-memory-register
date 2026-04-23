"use client";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface ProjectFilterContextValue {
  activeSlug: string | null;
  set: (slug: string | null) => void;
  clear: () => void;
}

const ProjectFilterContext = createContext<ProjectFilterContextValue | null>(
  null,
);

export function ProjectFilterProvider({ children }: { children: ReactNode }) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const set = useCallback((slug: string | null) => setActiveSlug(slug), []);
  const clear = useCallback(() => setActiveSlug(null), []);

  const value = useMemo<ProjectFilterContextValue>(
    () => ({ activeSlug, set, clear }),
    [activeSlug, set, clear],
  );
  return createElement(ProjectFilterContext.Provider, { value }, children);
}

export function useProjectFilter(): ProjectFilterContextValue {
  const ctx = useContext(ProjectFilterContext);
  if (!ctx) {
    throw new Error(
      "useProjectFilter must be used within a ProjectFilterProvider",
    );
  }
  return ctx;
}
