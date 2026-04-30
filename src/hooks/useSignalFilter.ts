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
import type { Entity, AuthorBucket } from "@/core/entities";

export type SourceFilter = AuthorBucket | "all";
export type ProviderFilter = "all" | "plugin" | "standalone";
export type StatusFilter = "enabled" | "disabled" | "all";

interface SignalFilterContextValue {
  source: SourceFilter;
  provider: ProviderFilter;
  status: StatusFilter;
  showInformational: boolean;
  setSource: (s: SourceFilter) => void;
  setProvider: (p: ProviderFilter) => void;
  setStatus: (s: StatusFilter) => void;
  setShowInformational: (s: boolean) => void;
  clear: () => void;
}

const SignalFilterContext = createContext<SignalFilterContextValue | null>(null);

export function SignalFilterProvider({ children }: { children: ReactNode }) {
  const [source, setSourceState] = useState<SourceFilter>("all");
  const [provider, setProviderState] = useState<ProviderFilter>("all");
  const [status, setStatusState] = useState<StatusFilter>("all");
  const [showInformational, setShowInformationalState] = useState(false);

  const setSource = useCallback((s: SourceFilter) => setSourceState(s), []);
  const setProvider = useCallback((p: ProviderFilter) => setProviderState(p), []);
  const setStatus = useCallback((s: StatusFilter) => setStatusState(s), []);
  const setShowInformational = useCallback((s: boolean) => setShowInformationalState(s), []);
  const clear = useCallback(() => {
    setSourceState("all");
    setProviderState("all");
    setStatusState("all");
    setShowInformationalState(false);
  }, []);

  const value = useMemo<SignalFilterContextValue>(
    () => ({
      source,
      provider,
      status,
      showInformational,
      setSource,
      setProvider,
      setStatus,
      setShowInformational,
      clear,
    }),
    [
      source,
      provider,
      status,
      showInformational,
      setSource,
      setProvider,
      setStatus,
      setShowInformational,
      clear,
    ],
  );

  return createElement(SignalFilterContext.Provider, { value }, children);
}

export function useSignalFilter(): SignalFilterContextValue {
  const ctx = useContext(SignalFilterContext);
  if (!ctx) {
    throw new Error("useSignalFilter must be used within a SignalFilterProvider");
  }
  return ctx;
}

export function entityMatchesSignalFilter(
  entity: Entity,
  source: SourceFilter,
  provider: ProviderFilter,
  status: StatusFilter,
  showInformational: boolean,
): boolean {
  if (!showInformational && entity.isInformational) {
    return false;
  }

  if (source !== "all") {
    if (entity.author !== source) return false;
  }

  if (provider !== "all") {
    if (provider === "plugin") {
      if (!entity.plugin) return false;
    } else if (provider === "standalone") {
      if (entity.plugin) return false;
    }
  }

  if (status !== "all") {
    const isEnabled = entity.enabled !== false;
    if (status === "enabled" && !isEnabled) return false;
    if (status === "disabled" && isEnabled) return false;
  }

  return true;
}
