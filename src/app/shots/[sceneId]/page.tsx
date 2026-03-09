"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Skeleton } from "@/components/ui/Skeleton";
import { ShotListEditor, saveSceneToDB } from "@/app/shots/page";
import type { Scene, SceneSettings } from "@/app/shots/page";
import type { Shot } from "@/types/shots";

// Skeleton that matches the ShotCard layout
function ShotCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        <Skeleton className="h-7 w-12 rounded-md" />
        <Skeleton className="h-5 w-40" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-6 w-12 rounded-md" />
          <Skeleton className="h-6 w-12 rounded-md" />
        </div>
      </div>
      {/* Bento grid */}
      <div className="grid grid-cols-1 border-t border-border lg:grid-cols-[1fr_1fr_auto]">
        {/* Image column */}
        <div className="border-b border-border p-3 space-y-2 lg:border-b-0 lg:border-r">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-20 rounded-lg" />
            <Skeleton className="h-7 w-20 rounded-lg" />
          </div>
        </div>
        {/* Video column */}
        <div className="border-b border-border p-3 space-y-2 lg:border-b-0 lg:border-r">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-7 w-20 rounded-lg" />
        </div>
        {/* Output column */}
        <div className="flex flex-wrap justify-center gap-2.5 p-3 lg:flex-nowrap">
          <div className="space-y-1 text-center">
            <Skeleton className="mx-auto h-2 w-8" />
            <Skeleton className="h-[160px] w-[90px] rounded-md" />
          </div>
          <div className="space-y-1 text-center">
            <Skeleton className="mx-auto h-2 w-8" />
            <Skeleton className="h-[160px] w-[90px] rounded-md" />
          </div>
          <div className="space-y-1 text-center">
            <Skeleton className="mx-auto h-2 w-8" />
            <Skeleton className="h-[160px] w-[90px] rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SceneShotsPage() {
  const { sceneId } = useParams<{ sceneId: string }>();
  const router = useRouter();
  const [scene, setScene] = useState<Scene | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Remember this scene as the last active one
  useEffect(() => {
    try { localStorage.setItem("dreamsun_last_scene", sceneId); } catch {}
  }, [sceneId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/scenes/${sceneId}`);
        if (!res.ok) {
          if (!cancelled) setError("Scene not found");
          return;
        }
        const r = await res.json();
        if (cancelled) return;
        setScene({
          id: r.id,
          name: r.name,
          shots: r.shots || [],
          settings: r.settings,
          createdAt: new Date(r.created_at).getTime(),
          updatedAt: new Date(r.updated_at).getTime(),
        });
      } catch {
        if (!cancelled) setError("Failed to load scene");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sceneId]);

  const onBack = useCallback(() => {
    // Clear last scene so /shots shows the overview
    try { localStorage.removeItem("dreamsun_last_scene"); } catch {}
    router.push("/shots");
  }, [router]);

  const onSave = useCallback((shots: Shot[], settings: SceneSettings) => {
    if (!scene) return;
    const updated: Scene = {
      ...scene,
      shots: shots.map((s) => ({ ...s, refImages: [], endImageRef: null })) as unknown as Record<string, unknown>[],
      settings,
      updatedAt: Date.now(),
    };
    setScene(updated);
    saveSceneToDB(updated);
  }, [scene]);

  const onRename = useCallback((name: string) => {
    if (!scene) return;
    const updated: Scene = { ...scene, name, updatedAt: Date.now() };
    setScene(updated);
    saveSceneToDB(updated);
  }, [scene]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="mx-auto max-w-6xl px-4 py-6">
          {/* Header skeleton */}
          <div className="mb-4 flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-6 w-48" />
            <div className="ml-auto flex gap-2">
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          </div>
          {/* Shot card skeletons */}
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <ShotCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !scene) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
          <p className="text-sm text-muted">{error || "Scene not found"}</p>
          <button
            onClick={() => {
              try { localStorage.removeItem("dreamsun_last_scene"); } catch {}
              router.push("/shots");
            }}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black"
          >
            Back to Scenes
          </button>
        </div>
      </div>
    );
  }

  return (
    <ShotListEditor
      key={scene.id}
      scene={scene}
      onBack={onBack}
      onSave={onSave}
      onRename={onRename}
    />
  );
}
