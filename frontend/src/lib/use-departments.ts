"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { Department } from "@/lib/types";

// Simple module-level cache so different pages don't refetch on every mount.
let cache: Department[] | null = null;
let inflight: Promise<Department[]> | null = null;

// Curated fallback used if the endpoint fails (e.g. new deploy without seed).
const FALLBACK: Department[] = [
  "Engineering",
  "Product",
  "Design",
  "QA",
  "Data",
  "Sales",
  "Ops",
  "HR",
  "Finance",
].map((name, i) => ({
  id: -(i + 1),
  name,
  description: null,
  employee_count: 0,
}));

export function useDepartments(): {
  departments: Department[];
  loading: boolean;
} {
  const [items, setItems] = useState<Department[]>(cache ?? FALLBACK);
  const [loading, setLoading] = useState(cache == null);

  useEffect(() => {
    if (cache) {
      setItems(cache);
      setLoading(false);
      return;
    }
    if (!inflight) {
      inflight = apiFetch<Department[]>("/api/v1/departments")
        .then((rows) => {
          cache = rows;
          return rows;
        })
        .catch(() => FALLBACK)
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

  return { departments: items, loading };
}

/** Force a re-fetch on the next mount (e.g. after admin creates one). */
export function invalidateDepartmentCache() {
  cache = null;
  inflight = null;
}
