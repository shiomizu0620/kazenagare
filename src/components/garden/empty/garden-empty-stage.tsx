"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { EmptyStageDecoration } from "@/components/garden/empty/empty-stage-decoration";
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
import { getSupabaseClient, getSupabaseSessionOrNull } from "@/lib/supabase/client";
import {
  buildGardenBackgroundCandidates,
  preloadGardenBackgroundCandidates,
} from "@/lib/garden/background-images";
import type { PlacedStageObject } from "@/components/garden/empty/empty-stage-character/empty-stage-character.types";
import type { ObjectType } from "@/types/garden";
import { COLLISION_ZONES } from "@/components/garden/empty/empty-stage-character/collision-zones";

type GardenEmptyStageProps = {
  backgroundId: string;
  seasonId: string;
  seasonName: string;
  timeSlotId: string;
  fullscreen?: boolean;
  className?: string;
  showStageBgm?: boolean;
  allowObjectPlacement?: boolean;
  placementObjectType?: ObjectType | null;
  objectStorageKey?: string;
  initialPlacedObjects?: PlacedStageObject[];
  audioOwnerIdOverride?: string | null;
  showDevelopmentPlaceholder?: boolean;
  ownerName?: string | null;
  gardenName?: string | null;
  resolveCurrentUserIdentity?: boolean;
  hideHeaderChips?: boolean;
  hideStageNote?: boolean;
};

const DEFAULT_CHARACTER_START_POSITION = {
  x: WORLD_WIDTH * 0.5,
  y: WORLD_HEIGHT * 0.5,
};

const CHARACTER_START_POSITION_BY_BACKGROUND: Record<string, { x: number; y: number }> = {
  "bamboo-forest": { ...DEFAULT_CHARACTER_START_POSITION },
  "night-pond": { ...DEFAULT_CHARACTER_START_POSITION },
  "misty-temple": { ...DEFAULT_CHARACTER_START_POSITION },
  "garden-all": { ...DEFAULT_CHARACTER_START_POSITION },
};
const BACKGROUND_IMAGE_SCALE = 1;

function normalizeLabel(value: string | null | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
}

function deriveOwnerNameFromUser(user: User | null | undefined) {
  if (!user) {
    return null;
  }

  const userMetadata = user.user_metadata as Record<string, unknown> | undefined;
  const candidateKeys = ["display_name", "displayName", "full_name", "fullName", "name", "user_name", "username"];

  for (const key of candidateKeys) {
    const candidateValue = userMetadata?.[key];
    if (typeof candidateValue === "string") {
      const normalizedValue = normalizeLabel(candidateValue);
      if (normalizedValue) {
        return normalizedValue;
      }
    }
  }

  if (typeof user.email === "string") {
    const emailLocalPart = normalizeLabel(user.email.split("@")[0]);
    if (emailLocalPart) {
      return emailLocalPart;
    }
  }

  return normalizeLabel(user.id);
}

function buildDefaultGardenName(ownerName: string | null) {
  return ownerName ? `${ownerName}の庭` : "わたしの庭";
}

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

function SeasonTimeBackgroundLayer({
  backgroundId,
  seasonId,
  timeSlotId,
}: {
  backgroundId: string;
  seasonId: string;
  timeSlotId: string;
}) {
  const candidates = useMemo(
    () => buildGardenBackgroundCandidates(backgroundId, seasonId, timeSlotId),
    [backgroundId, seasonId, timeSlotId],
  );
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [hasResolvedBackgroundImage, setHasResolvedBackgroundImage] = useState(false);

  // 背景画像をマウント時にプリロード
  useEffect(() => {
    void preloadGardenBackgroundCandidates(backgroundId, seasonId, timeSlotId);
  }, [backgroundId, seasonId, timeSlotId]);

  const activeImage = candidates[Math.min(candidateIndex, Math.max(0, candidates.length - 1))];
  const isLoading = !hasResolvedBackgroundImage;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <Image
        src={activeImage}
        alt=""
        aria-hidden
        fill
        priority
        sizes="100vw"
        quality={85}
        loading="eager"
        className="select-none object-cover"
        onLoad={() => {
          setHasResolvedBackgroundImage(true);
        }}
        onError={() => {
          setCandidateIndex((current) => {
            const lastIndex = candidates.length - 1;
            if (current >= lastIndex) {
              // Stop showing the loading indicator once all candidates are exhausted.
              setHasResolvedBackgroundImage(true);
              return current;
            }

            return current + 1;
          });
        }}
      />
      {isLoading ? (
        <div className="absolute inset-0 grid place-items-center bg-wa-black/20 backdrop-blur-[2px]">
          <p className="rounded-full border border-white/40 bg-wa-black/55 px-3 py-1 text-xs tracking-[0.08em] text-white/95 animate-pulse">
            背景を読み込み中...
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function GardenEmptyStage({
  backgroundId,
  seasonId,
  seasonName,
  timeSlotId,
  fullscreen = false,
  className,
  showStageBgm = true,
  allowObjectPlacement = false,
  placementObjectType = null,
  objectStorageKey,
  initialPlacedObjects = [],
  audioOwnerIdOverride = null,
  showDevelopmentPlaceholder = false,
  ownerName = null,
  gardenName = null,
  resolveCurrentUserIdentity = false,
  hideHeaderChips = false,
  hideStageNote = false,
}: GardenEmptyStageProps) {
  const [resolvedOwnerName, setResolvedOwnerName] = useState<string | null>(
    normalizeLabel(ownerName),
  );
  const isNight = timeSlotId === "night";
  const theme = getBackgroundTheme(isNight ? "night-pond" : "misty-temple");
  const seasonOverlayClass = getSeasonOverlayClass(seasonId);
  const timeOverlayClass = getTimeOverlayClass(timeSlotId);
  const initialCharacterWorldPosition =
    CHARACTER_START_POSITION_BY_BACKGROUND[backgroundId] ?? DEFAULT_CHARACTER_START_POSITION;
  const movementBounds = getMovementBoundsFromBackgroundScale(BACKGROUND_IMAGE_SCALE);
  const hitmapUrl = "/images/garden/backgrounds/garden-all/hitmap1.png";
  const stageContainerClass = fullscreen
    ? `relative h-[100dvh] w-full overflow-hidden ${theme.stageClass} ${className ?? ""}`
    : `relative h-[78dvh] min-h-[520px] w-full overflow-hidden rounded-3xl border ${theme.stageClass} ${className ?? ""}`;
  const showCollisionDebug = process.env.NODE_ENV !== "production";
  const fallbackOwnerName = normalizeLabel(ownerName) ?? "あなた";
  const visibleOwnerName = resolvedOwnerName ?? fallbackOwnerName;
  const visibleGardenName = normalizeLabel(gardenName) ?? buildDefaultGardenName(visibleOwnerName);

  useEffect(() => {
    setResolvedOwnerName(normalizeLabel(ownerName));
  }, [ownerName]);

  useEffect(() => {
    if (!resolveCurrentUserIdentity) {
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }

    let isCancelled = false;

    const syncOwnerName = async () => {
      const session = await getSupabaseSessionOrNull(supabase);
      if (isCancelled) {
        return;
      }

      const nextOwnerName = deriveOwnerNameFromUser(session?.user);
      if (nextOwnerName) {
        setResolvedOwnerName(nextOwnerName);
      }
    };

    void syncOwnerName();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextOwnerName = deriveOwnerNameFromUser(session?.user);
      setResolvedOwnerName(nextOwnerName ?? normalizeLabel(ownerName));
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, [ownerName, resolveCurrentUserIdentity]);

  return (
    <section className={stageContainerClass}>
      {showStageBgm ? (
        <GardenStageBgm
          backgroundId={backgroundId}
          seasonId={seasonId}
          timeSlotId={timeSlotId}
        />
      ) : null}

      <EmptyStageCharacter
        darkMode={isNight}
        showCollisionDebug={showCollisionDebug}
        hitmapUrl={hitmapUrl}
        allowObjectPlacement={allowObjectPlacement}
        placementObjectType={placementObjectType}
        objectStorageKey={objectStorageKey}
        initialPlacedObjects={initialPlacedObjects}
        audioOwnerIdOverride={audioOwnerIdOverride}
        initialCharacterWorldPosition={initialCharacterWorldPosition}
        movementBounds={movementBounds}
        collisionZones={COLLISION_ZONES[backgroundId] ?? COLLISION_ZONES["garden-all"] ?? []}
      >
        <SeasonTimeBackgroundLayer
          key={`${backgroundId}-${seasonId}-${timeSlotId}`}
          backgroundId={backgroundId}
          seasonId={seasonId}
          timeSlotId={timeSlotId}
        />
        {backgroundId !== "garden-all" ? (
          <EmptyStageDecoration backgroundId={backgroundId} />
        ) : null}
        <div className={`absolute inset-0 ${seasonOverlayClass}`} />
        <div className={`absolute inset-0 ${timeOverlayClass}`} />

        {showDevelopmentPlaceholder ? (
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

      {hideHeaderChips ? null : (
        <div className="pointer-events-none absolute left-4 top-4 z-40 flex max-w-[min(92vw,28rem)] flex-wrap gap-2 text-xs">
          <span className={`rounded-full border px-3 py-1 ${theme.chipClass}`}>
            {visibleOwnerName}
          </span>
          <span className={`rounded-full border px-3 py-1 ${theme.chipClass}`}>
            {visibleGardenName}
          </span>
          <span className={`rounded-full border px-3 py-1 ${theme.chipClass}`}>
            {seasonName}
          </span>
        </div>
      )}

      {hideStageNote ? null : (
        <p className={`pointer-events-none absolute bottom-4 right-4 z-40 hidden text-xs sm:block ${theme.noteClass}`}>
          和の静けさをベースに、ここから配置を始めます。
        </p>
      )}
    </section>
  );
}
