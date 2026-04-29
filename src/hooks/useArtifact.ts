"use client";
import { useEffect, useState } from "react";
import type { ArtifactNode } from "@/core/types";

export function useArtifact(id: string | null) {
  const [node, setNode] = useState<ArtifactNode | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNode((prev) => (prev === null ? prev : null));
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/artifact/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((n: ArtifactNode) => {
        if (!cancelled) {
          setNode(n);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { node, loading };
}
