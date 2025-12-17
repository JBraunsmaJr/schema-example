import React, { createContext, useContext, useMemo, useState } from "react";
import type { Artifact, ArtifactFolder, ArtifactsContextValue } from "./types";
import { sampleArtifacts } from "./sampleArtifacts";

const ArtifactsContext = createContext<ArtifactsContextValue | null>(null);

function cloneTree(node: Artifact): Artifact {
  if (node.type === "folder") {
    return {
      ...node,
      children: node.children.map(cloneTree),
      tags: node.tags ? [...node.tags] : [],
    } as ArtifactFolder;
  }
  return { ...node, tags: node.tags ? [...node.tags] : [] };
}

function collectAll(node: Artifact, map: Map<string, Artifact>): void {
  map.set(node.id, node);
  if (node.type === "folder") {
    for (const c of node.children) collectAll(c, map);
  }
}

/**
 * Local storage key which stores the tags
 */
const LS_KEY = "artifacts.tags";

function loadTagMap(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

function saveTagMap(tags: Record<string, string[]>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(tags));
  } catch {
    // ignore
  }
}

export function ArtifactsProvider({ children }: { children: React.ReactNode }) {
  const [root, setRoot] = useState<ArtifactFolder>(() => {
    const tree = cloneTree(sampleArtifacts) as ArtifactFolder;

    const tagMap = loadTagMap();
    const byId = new Map<string, Artifact>();
    collectAll(tree, byId);
    for (const [id, tags] of Object.entries(tagMap)) {
      const node = byId.get(id);
      if (node) node.tags = [...new Set([...(node.tags || []), ...tags])];
    }
    return tree;
  });

  /**
   * Retrieve artifact by ID
   */
  const getById = useMemo(() => {
    return (artifactId: string) => {
      const map = new Map<string, Artifact>();
      collectAll(root, map);
      return map.get(artifactId);
    };
  }, [root]);

  /**
   * All tags
   */
  const allTags = useMemo(() => {
    const set = new Set<string>();
    const stack: Artifact[] = [root];
    while (stack.length) {
      const n = stack.pop()!;
      (n.tags || []).forEach((t) => set.add(t));
      if (n.type === "folder") stack.push(...n.children);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [root]);

  function updateTag(
    artifactId: string,
    updater: (tags: string[]) => string[],
  ) {
    setRoot((prev) => {
      const copy = cloneTree(prev) as ArtifactFolder;
      const map = new Map<string, Artifact>();
      collectAll(copy, map);
      const node = map.get(artifactId);
      if (!node) return prev;
      node.tags = updater([...(node.tags || [])]);
      const tagsPersist: Record<string, string[]> = {};
      for (const [id, n] of map.entries()) {
        if (n.tags && n.tags.length) tagsPersist[id] = [...n.tags];
      }
      saveTagMap(tagsPersist);
      return copy;
    });
  }

  const addTag = (artifactId: string, tag: string) => {
    const t = tag.trim();
    if (!t) return;
    updateTag(artifactId, (tags) => [...new Set([...tags, t])]);
  };

  const removeTag = (artifactId: string, tag: string) => {
    updateTag(artifactId, (tags) => tags.filter((x) => x !== tag));
  };

  const value = useMemo<ArtifactsContextValue>(
    () => ({ root, addTag, removeTag, getById, allTags }),
    [root, getById, allTags],
  );

  return (
    <ArtifactsContext.Provider value={value}>
      {children}
    </ArtifactsContext.Provider>
  );
}

export function useArtifacts(): ArtifactsContextValue {
  const ctx = useContext(ArtifactsContext);
  if (!ctx)
    throw new Error("useArtifacts must be used within ArtifactsProvider");
  return ctx;
}
