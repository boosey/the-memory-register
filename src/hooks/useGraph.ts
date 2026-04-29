"use client";
import { useCallback, useEffect, useState } from "react";
import type { GraphPayload } from "@/core/entities";

export function useGraph() {
  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => {
    setLoading(true);
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/graph", { cache: "no-store" })
      .then((r) => r.json())
      .then((g: GraphPayload) => {
        if (!cancelled) {
          setGraph(g);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(String(e));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { graph, loading, error, refetch };
}
