"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EmptyStageCharacter,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "@/components/garden/empty/empty-stage-character/index";
import { GardenStageBgm } from "@/components/garden/empty/garden-stage-bgm";
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

const CHARACTER_START_POSITION_BY_BACKGROUND: Record<string, { x: number; y: number }> = {
  "bamboo-forest": { x: 0, y: 740 },
  "night-pond": { x: 3680, y: 1850 },
  "misty-temple": { x: 3030, y: 750 },
  "garden-all": { x: 2380, y: 1300 },
};

const GARDEN_ALL_SEASON_IMAGE: Record<string, string> = {
  spring: "/images/garden/backgrounds/garden-all/spring/庭-春.png",
  summer: "/images/garden/backgrounds/garden-all/summer/庭-夏.png",
  autumn: "/images/garden/backgrounds/garden-all/autumn/庭-秋.png",
  winter: "/images/garden/backgrounds/garden-all/winter/庭-冬.png",
};

const BACKGROUND_IMAGE_EXTENSIONS = ["avif", "webp", "png", "jpg", "jpeg"] as const;
const BACKGROUND_IMAGE_SCALE = 1.5;

function getMovementBoundsFromBackgroundScale(scale: number) {
  if (scale <= 1) {
    return {
      minX: 0,
      maxX: WORLD_WIDTH,
      minY: 0,
      maxY: WORLD_HEIGHT,
    };
  }

  const expandedWidth = WORLD_WIDTH * scale;
  const expandedHeight = WORLD_HEIGHT * scale;
  const horizontalOverflow = (expandedWidth - WORLD_WIDTH) * 0.5;
  const verticalOverflow = (expandedHeight - WORLD_HEIGHT) * 0.5;

  return {
    minX: -horizontalOverflow,
    maxX: WORLD_WIDTH + horizontalOverflow,
    minY: -verticalOverflow,
    maxY: WORLD_HEIGHT + verticalOverflow,
  };
}

function buildSeasonTimeBackgroundCandidates(seasonId: string, timeSlotId: string) {
  const candidates: string[] = [];

  for (const extension of BACKGROUND_IMAGE_EXTENSIONS) {
    candidates.push(
      `/images/garden/backgrounds/garden-all/${seasonId}/${timeSlotId}/background.${extension}`,
    );
  }

  const seasonalFallback = GARDEN_ALL_SEASON_IMAGE[seasonId];
  if (seasonalFallback) {
    candidates.push(seasonalFallback);
  }

  candidates.push("/images/garden/backgrounds/garden-all/庭.png");

  return candidates;
}

function SeasonTimeBackgroundLayer({
  seasonId,
  timeSlotId,
}: {
  seasonId: string;
  timeSlotId: string;
}) {
  const candidates = useMemo(
    () => buildSeasonTimeBackgroundCandidates(seasonId, timeSlotId),
    [seasonId, timeSlotId],
  );
  const [candidateIndex, setCandidateIndex] = useState(0);

  const activeImage = candidates[Math.min(candidateIndex, Math.max(0, candidates.length - 1))];

  return (
    // eslint-disable-next-line @next/next/no-img-element -- onError フォールバックが必要なため <img> を使用
    <img
      className="pointer-events-none absolute left-0 top-0 block"
      src={activeImage}
      alt=""
      aria-hidden
      draggable={false}
      width={WORLD_WIDTH}
      height={WORLD_HEIGHT}
      style={{
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT,
        objectFit: "fill",
        objectPosition: "center center",
        transform: `scale(${BACKGROUND_IMAGE_SCALE})`,
        transformOrigin: "center center",
      }}
      onError={() => {
        setCandidateIndex((current) => {
          const lastIndex = candidates.length - 1;
          return current < lastIndex ? current + 1 : current;
        });
      }}
    />
  );
}

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
  const isNight = timeSlotId === "night";
  const theme = getBackgroundTheme(isNight ? "night-pond" : "misty-temple");
  const seasonOverlayClass = getSeasonOverlayClass(seasonId);
  const timeOverlayClass = getTimeOverlayClass(timeSlotId);
  const initialCharacterWorldPosition =
    CHARACTER_START_POSITION_BY_BACKGROUND[backgroundId] ?? { x: 1920, y: 1080 };
  const movementBounds = getMovementBoundsFromBackgroundScale(BACKGROUND_IMAGE_SCALE);
  const stageContainerClass = fullscreen
    ? `relative h-[100dvh] w-full overflow-hidden ${theme.stageClass}`
    : `relative h-[78dvh] min-h-[520px] w-full overflow-hidden rounded-3xl border ${theme.stageClass}`;

  return (
    <section className={stageContainerClass}>
      <GardenStageBgm
        backgroundId={backgroundId}
        seasonId={seasonId}
        timeSlotId={timeSlotId}
      />

      <EmptyStageCharacter
        darkMode={isNight}
        allowObjectPlacement={allowObjectPlacement}
        placementObjectType={placementObjectType}
        objectStorageKey={objectStorageKey}
        initialCharacterWorldPosition={initialCharacterWorldPosition}
        movementBounds={movementBounds}
        collisionZones={COLLISION_ZONES[backgroundId] ?? []}
      >
        <SeasonTimeBackgroundLayer key={`${seasonId}-${timeSlotId}`} seasonId={seasonId} timeSlotId={timeSlotId} />
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

      <p className={`pointer-events-none absolute bottom-4 right-4 z-40 hidden text-xs sm:block ${theme.noteClass}`}>
        和の静けさをベースに、ここから配置を始めます。
      </p>
    </section>
  );
}
