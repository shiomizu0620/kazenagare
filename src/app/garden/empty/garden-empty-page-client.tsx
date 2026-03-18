"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GardenEmptyStage } from "@/components/garden/empty/garden-empty-stage";
import {
  GardenOptionsMenu,
  type GardenOptionAction,
} from "@/components/garden/garden-options-menu";
import { GardenLocalStateSync } from "@/components/garden/garden-local-state-sync";
import { getSupabaseClient, getSupabaseSessionOrNull } from "@/lib/supabase/client";
import type { ObjectType } from "@/types/garden";

type GardenEmptyPageClientProps = {
  backgroundId: string;
  seasonId: string;
  seasonName: string;
  timeSlotId: string;
  placementObjectType: ObjectType | null;
  optionActions: GardenOptionAction[];
  darkMode: boolean;
};

export function GardenEmptyPageClient({
  backgroundId,
  seasonId,
  seasonName,
  timeSlotId,
  placementObjectType,
  optionActions,
  darkMode,
}: GardenEmptyPageClientProps) {
  const router = useRouter();
  const [isAccessReady, setIsAccessReady] = useState(false);
  const [grabbedObjectId, setGrabbedObjectId] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const verifyAccess = async () => {
      await Promise.resolve();
      if (isCancelled) {
        return;
      }

      const supabase = getSupabaseClient();
      if (!supabase) {
        if (!isCancelled) {
          setIsAccessReady(true);
        }
        return;
      }

      const session = await getSupabaseSessionOrNull(supabase);
      if (isCancelled) {
        return;
      }

      const user = session?.user;
      if (!user) {
        router.replace("/?login=1");
        return;
      }

      const userMetadata = user.user_metadata as Record<string, unknown> | undefined;
      const displayName = userMetadata?.display_name;
      if (typeof displayName !== "string" || !displayName.trim()) {
        router.replace("/garden/setup");
        return;
      }

      setIsAccessReady(true);
    };

    void verifyAccess();

    return () => {
      isCancelled = true;
    };
  }, [router]);

  if (!isAccessReady) {
    return (
      <main className="relative grid h-[100svh] place-items-center overflow-hidden overscroll-none bg-wa-white text-wa-black font-serif md:h-[100dvh] md:overscroll-auto">
        <p className="rounded-full border border-wa-black/25 bg-wa-white/90 px-4 py-2 text-sm text-wa-black/80 shadow-sm">
          庭へ案内しています...
        </p>
      </main>
    );
  }

  return (
    <main className="relative h-[100svh] overflow-hidden overscroll-none bg-wa-white text-wa-black font-serif md:h-[100dvh] md:overscroll-auto">
      <GardenLocalStateSync
        backgroundId={backgroundId}
        seasonId={seasonId}
        timeSlotId={timeSlotId}
      />

      <GardenEmptyStage
        backgroundId={backgroundId}
        seasonId={seasonId}
        seasonName={seasonName}
        timeSlotId={timeSlotId}
        fullscreen
        allowObjectPlacement
        placementObjectType={placementObjectType}
        objectStorageKey="kazenagare_objects_me"
        ownerName="あなた"
        resolveCurrentUserIdentity
        onGrabbedObjectIdChange={setGrabbedObjectId}
      />

      <GardenOptionsMenu
        actions={optionActions}
        title="自分の庭オプション"
        darkMode={darkMode}
        disableModals={grabbedObjectId !== null}
      />
    </main>
  );
}
