"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { Page, Project } from "@/lib/types";

// Module-level cache so filter dropdowns across pages don't re-fetch on every mount.
let cache: Project[] | null = null;
let inflight: Promise<Project[]> | null = null;

export function useProjects(): { projects: Project[]; loading: boolean } {
  const [items, setItems] = useState<Project[]>(cache ?? []);
  const [loading, setLoading] = useState(cache == null);

  useEffect(() => {
    if (cache) {
      setItems(cache);
      setLoading(false);
      return;
    }
    if (!inflight) {
      // Fetch a full page — 30 projects at full-scale seed, well under
      // the 1000-row cap. If this grows large we can page later.
      inflight = apiFetch<Page<Project>>("/api/v1/projects?limit=200")
        .then((p) => {
          cache = p.items;
          return p.items;
        })
        .catch(() => [])
        .finally(() => {
          inflight = null;
        });
    }
    let cancelled = false;
    inflight.then((rows) => {
      if (!cancelled) {
        setItems(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { projects: items, loading };
}

export function invalidateProjectCache() {
  cache = null;
  inflight = null;
}
