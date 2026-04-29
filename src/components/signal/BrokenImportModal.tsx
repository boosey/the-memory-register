"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Entity, Relation, PseudoNode } from "@/core/entities";

interface BrokenImportModalProps {
  relation: Relation;
  importer: Entity;
  target: PseudoNode | undefined;
  onClose: () => void;
  onResolved: () => void;
}

export function BrokenImportModal({
  relation,
  importer,
  target,
  onClose,
  onResolved,
}: BrokenImportModalProps) {
  const [newPath, setNewPath] = useState(target?.kind === "path" ? target.path : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const path = target?.kind === "path" ? target.path : relation.to;

  async function handleRemove() {
    setPending(true);
    setError(null);
    try {
      // Implementation logic: read importer content, remove the line with the path, save.
      // This is complex to do purely on client if we want it perfect.
      // v1.8 simplified: we'll use a new bulk action or specialized endpoint if needed.
      // For now, let's assume we have an endpoint that handles this.
      const res = await fetch("/api/resolve-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          entityId: importer.id,
          path,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.message || "Failed to remove import");
      onResolved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function handleCreate() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/resolve-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          entityId: importer.id,
          path,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.message || "Failed to create file");
      onResolved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function handleUpdatePath() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/resolve-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "update",
          entityId: importer.id,
          oldPath: path,
          newPath,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.message || "Failed to update path");
      onResolved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Resolve Broken Import</DialogTitle>
          <DialogDescription>
            The import <code className="text-red-600">{path}</code> in{" "}
            <strong>{importer.title}</strong> could not be resolved.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="new-path">Update Path</Label>
            <div className="flex gap-2">
              <Input
                id="new-path"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="@path/to/file.md"
                className="font-mono text-sm"
              />
              <Button size="sm" onClick={handleUpdatePath} disabled={pending || !newPath || newPath === path}>
                Update
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Actions</Label>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleCreate} disabled={pending}>
                Create missing file
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleRemove} disabled={pending}>
                Remove import
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-[color:var(--semantic-error)]">{error}</p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
