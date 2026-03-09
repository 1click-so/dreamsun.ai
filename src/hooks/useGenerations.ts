"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";

export interface Generation {
  id: string;
  type: "image" | "video" | "audio";
  url: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  prompt: string | null;
  negative_prompt: string | null;
  model_id: string;
  model_name: string | null;
  seed: number | null;
  request_id: string | null;
  aspect_ratio: string | null;
  resolution: string | null;
  settings: Record<string, unknown> | null;
  batch_id: string | null;
  favorited: boolean;
  created_at: string;
  scene_id: string | null;
  shot_number: string | null;
  project_id: string | null;
  source_image_url: string | null;
  thumbnail_url: string | null;
  reference_image_urls: string[] | null;
}

// Module-level cache — survives client-side navigation between pages
let cache: Generation[] | null = null;
let cachePromise: Promise<void> | null = null;

function fetchGenerations(): Promise<void> {
  if (cachePromise) return cachePromise;
  cachePromise = (async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("generations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("[useGenerations] fetch error:", error);
      cache = [];
    } else {
      cache = (data as Generation[]) ?? [];
    }
  })();
  return cachePromise;
}

export function useGenerations() {
  const [generations, setGenerations] = useState<Generation[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    fetchGenerations().then(() => {
      setGenerations(cache ?? []);
      setLoading(false);
    });
  }, []);

  // Sync module cache helper
  const updateCache = useCallback((updater: (prev: Generation[]) => Generation[]) => {
    setGenerations((prev) => {
      const next = updater(prev);
      cache = next;
      return next;
    });
  }, []);

  // Add a generation optimistically (called after generate completes)
  const addGeneration = useCallback((gen: Generation) => {
    updateCache((prev) => [gen, ...prev]);
  }, [updateCache]);

  // Add multiple at once
  const addGenerations = useCallback((gens: Generation[]) => {
    updateCache((prev) => [...gens, ...prev]);
  }, [updateCache]);

  // Toggle favorite — optimistic + persist
  const toggleFavorite = useCallback((id: string) => {
    updateCache((prev) =>
      prev.map((g) => (g.id === id ? { ...g, favorited: !g.favorited } : g))
    );
    const supabase = createClient();
    const gen = cache?.find((g) => g.id === id);
    if (gen) {
      supabase
        .from("generations")
        .update({ favorited: gen.favorited })
        .eq("id", id)
        .then(({ error }) => {
          if (error) console.error("[useGenerations] favorite error:", error);
        });
    }
  }, [updateCache]);

  // Delete — optimistic + persist
  const deleteGeneration = useCallback((id: string) => {
    updateCache((prev) => prev.filter((g) => g.id !== id));
    const supabase = createClient();
    supabase
      .from("generations")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.error("[useGenerations] delete error:", error);
      });
  }, [updateCache]);

  // Update a generation (e.g., when pending generation completes)
  const updateGeneration = useCallback((id: string, updates: Partial<Generation>) => {
    updateCache((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...updates } : g))
    );
  }, [updateCache]);

  // Bulk delete — optimistic + persist
  const deleteGenerations = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    updateCache((prev) => prev.filter((g) => !idSet.has(g.id)));
    const supabase = createClient();
    supabase
      .from("generations")
      .delete()
      .in("id", ids)
      .then(({ error }) => {
        if (error) console.error("[useGenerations] bulk delete error:", error);
      });
  }, [updateCache]);

  return {
    generations,
    loading,
    addGeneration,
    addGenerations,
    updateGeneration,
    toggleFavorite,
    deleteGeneration,
    deleteGenerations,
    setGenerations,
  };
}
