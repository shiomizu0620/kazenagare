"use client";

import { useState } from "react";
import { GardenEmptyStage } from "@/components/garden/empty/garden-empty-stage";
import {
  GardenOptionsMenu,
  type GardenOptionAction,
} from "@/components/garden/garden-options-menu";
import { GardenLocalStateSync } from "@/components/garden/garden-local-state-sync";
import type { ObjectType } from "@/types/garden";

type GardenUserPageMyGardenClientProps = {
  backgroundId: string;
  seasonId: string;
  seasonName: string;
  timeSlotId: string;
  placementObjectType: ObjectType | null;
  optionActions: GardenOptionAction[];
  darkMode: boolean;
};

export function GardenUserPageMyGardenClient({
  backgroundId,
  seasonId,
  seasonName,
  timeSlotId,
  placementObjectType,
  optionActions,
  darkMode,
}: GardenUserPageMyGardenClientProps) {
  const [grabbedObjectId, setGrabbedObjectId] = useState<string | null>(null);

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-wa-white text-wa-black font-serif">
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
