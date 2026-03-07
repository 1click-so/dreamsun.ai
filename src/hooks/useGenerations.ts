"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase-browser";

export interface Generation {
  id: string;
  type: "image" | "video" | "audio";
  url: string;
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
  reference_image_urls: string[] | null;
}

export function useGenerations() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  // Fetch all generations for the current user
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setLoading(false);
        return;
      }
      supabase
        .from("generations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            console.error("[useGenerations] fetch error:", error);
          } else if (data) {
            setGenerations(data as Generation[]);
          }
          setLoading(false);
        });
    });
  }, []);

  // Add a generation optimistically (called after generate completes)
  const addGeneration = useCallback((gen: Generation) => {
    setGenerations((prev) => [gen, ...prev]);
  }, []);

  // Add multiple at once
  const addGenerations = useCallback((gens: Generation[]) => {
    setGenerations((prev) => [...gens, ...prev]);
  }, []);

  // Toggle favorite — optimistic + persist
  const toggleFavorite = useCallback((id: string) => {
    setGenerations((prev) =>
      prev.map((g) => (g.id === id ? { ...g, favorited: !g.favorited } : g))
    );
    // Persist to Supabase
    const supabase = createClient();
    const gen = generations.find((g) => g.id === id);
    if (gen) {
      supabase
        .from("generations")
        .update({ favorited: !gen.favorited })
        .eq("id", id)
        .then(({ error }) => {
          if (error) console.error("[useGenerations] favorite error:", error);
        });
    }
  }, [generations]);

  // Delete — optimistic + persist
  const deleteGeneration = useCallback((id: string) => {
    setGenerations((prev) => prev.filter((g) => g.id !== id));
    const supabase = createClient();
    supabase
      .from("generations")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.error("[useGenerations] delete error:", error);
      });
  }, []);

  return {
    generations,
    loading,
    addGeneration,
    addGenerations,
    toggleFavorite,
    deleteGeneration,
    setGenerations,
  };
}
