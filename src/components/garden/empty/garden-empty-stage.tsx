"use client";

import { EmptyStageDecoration } from "@/components/garden/empty/empty-stage-decoration";
import {
  EmptyStageCharacter,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "@/components/garden/empty/empty-stage-character/index";
import {
  getBackgroundTheme,
  getSeasonOverlayClass,
  getTimeOverlayClass,
} from "@/components/garden/empty/empty-stage-theme";
import type { ObjectType } from "@/types/garden";
import { COLLISION_ZONES } from "@/components/garden/empty/empty-stage-character/collision-zones";

type GardenEmptyStageProps = {
  backgroundId: string;
  backgroundName: string;
  seasonId: string;
  seasonName: string;
  timeSlotId: string;
  timeSlotName: string;
  fullscreen?: boolean;
  allowObjectPlacement?: boolean;
  placementObjectType?: ObjectType | null;
  objectStorageKey?: string;
};

export function GardenEmptyStage({
  backgroundId,
  backgroundName,
  seasonId,
  seasonName,
  timeSlotId,
  timeSlotName,
  fullscreen = false,
  allowObjectPlacement = false,
  placementObjectType = null,
  objectStorageKey,
}: GardenEmptyStageProps) {
  const theme = getBackgroundTheme(backgroundId);
  const seasonOverlayClass = getSeasonOverlayClass(seasonId);
  const timeOverlayClass = getTimeOverlayClass(timeSlotId);
  const isNightPond = backgroundId === "night-pond";
  const stageContainerClass = fullscreen
    ? `relative h-[100dvh] w-full overflow-hidden ${theme.stageClass}`
    : `relative h-[78dvh] min-h-[520px] w-full overflow-hidden rounded-3xl border ${theme.stageClass}`;

  return (
    <section className={stageContainerClass}>
      <EmptyStageCharacter
        darkMode={isNightPond}
        allowObjectPlacement={allowObjectPlacement}
        placementObjectType={placementObjectType}
        objectStorageKey={objectStorageKey}
        collisionZones={COLLISION_ZONES[backgroundId] ?? []}
      >
        {backgroundId === "garden-all" ? (
          <div
            className="pointer-events-none absolute left-0 top-0"
            style={{
              width: WORLD_WIDTH,
              height: WORLD_HEIGHT,
              backgroundImage: "url('/images/garden/backgrounds/garden-all/庭.png')",
              backgroundSize: "100% 100%",
              backgroundPosition: "left top",
            }}
          />
        ) : null}
        {backgroundId !== "garden-all" ? (
          <EmptyStageDecoration backgroundId={backgroundId} />
        ) : null}
        <div className={`absolute inset-0 ${seasonOverlayClass}`} />
        <div className={`absolute inset-0 ${timeOverlayClass}`} />

        {!allowObjectPlacement ? (
          <div
            className={`absolute left-1/2 top-1/2 flex h-[360px] w-[620px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-dashed ${theme.panelClass}`}
          >
            <div className="grid gap-2 px-4 text-center">
              <p className="text-2xl font-semibold">仮キャラクターを配置しました</p>
              <p className="text-sm">まずは移動だけできる状態です。ここから庭の配置機能を足します。</p>
              <p className="text-xs">庭サイズ（仮想）: {WORLD_WIDTH} × {WORLD_HEIGHT}</p>
            </div>
          </div>
        ) : null}
      </EmptyStageCharacter>

      <div className="pointer-events-none absolute left-4 top-4 z-40 flex flex-wrap gap-2 text-xs">
        <span className={`rounded-full border px-3 py-1 ${theme.chipClass}`}>
          背景: {backgroundName}
        </span>
        <span className={`rounded-full border px-3 py-1 ${theme.chipClass}`}>
          季節: {seasonName}
        </span>
        <span className={`rounded-full border px-3 py-1 ${theme.chipClass}`}>
          時間帯: {timeSlotName}
        </span>
      </div>

      <p className={`pointer-events-none absolute bottom-4 right-4 z-40 text-xs ${theme.noteClass}`}>
        和の静けさをベースに、ここから配置を始めます。
      </p>
    </section>
  );
}
