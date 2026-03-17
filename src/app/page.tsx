"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";
import {
  OBJECT_VISUALS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "@/components/garden/empty/empty-stage-character/empty-stage-character.constants";
import {
  getSeasonOverlayClass,
  getTimeOverlayClass,
} from "@/components/garden/empty/empty-stage-theme";
import { isAnonymousSupabaseUser } from "@/lib/auth/user";
import { buildGardenBackgroundCandidates } from "@/lib/garden/background-images";
import {
  createGardenCharacterPositionStorageKey,
  parseGardenCharacterPosition,
} from "@/lib/garden/character-position";
import {
  createGardenLocalStateStorageKey,
  getDefaultGardenLocalState,
  parseGardenLocalState,
  type GardenLocalState,
} from "@/lib/garden/local-state";
import { getGardenObjectsStorageKeyForOwner } from "@/lib/garden/placed-objects-storage";
import { getSupabaseClient, getSupabaseSessionOrNull } from "@/lib/supabase/client";
import type { ObjectType } from "@/types/garden";

type AuthState = "loading" | "guest" | "member";

type TitlePlacedObject = {
  id: string;
  objectType: ObjectType;
  x: number;
  y: number;
};

type TitleGardenScene = GardenLocalState & {
  placedObjects: TitlePlacedObject[];
  characterWorldPosition: {
    x: number;
    y: number;
  };
};

const DEFAULT_GARDEN_SCENE: TitleGardenScene = {
  ...getDefaultGardenLocalState(),
  placedObjects: [],
  characterWorldPosition: {
    x: WORLD_WIDTH * 0.5,
    y: WORLD_HEIGHT * 0.5,
  },
};
const PREVIEW_OBJECT_LIMIT = 24;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isObjectType(value: unknown): value is ObjectType {
  return value === "furin" || value === "shishi-odoshi";
}

function parseTitlePlacedObjects(rawValue: string | null): TitlePlacedObject[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is TitlePlacedObject => {
        if (!item || typeof item !== "object") {
          return false;
        }

        const candidate = item as Partial<TitlePlacedObject>;

        return (
          typeof candidate.id === "string" &&
          isObjectType(candidate.objectType) &&
          typeof candidate.x === "number" &&
          Number.isFinite(candidate.x) &&
          typeof candidate.y === "number" &&
          Number.isFinite(candidate.y)
        );
      })
      .slice(-PREVIEW_OBJECT_LIMIT);
  } catch {
    return [];
  }
}

type GardenSceneVisualProps = {
  backgroundSrc: string;
  seasonOverlayClass: string;
  timeOverlayClass: string;
  placedObjects: TitlePlacedObject[];
  characterWorldPosition: {
    x: number;
    y: number;
  };
  isNightScene: boolean;
  onBackgroundLoad: () => void;
  onBackgroundError: () => void;
};

function GardenSceneVisual({
  backgroundSrc,
  seasonOverlayClass,
  timeOverlayClass,
  placedObjects,
  characterWorldPosition,
  isNightScene,
  onBackgroundLoad,
  onBackgroundError,
}: GardenSceneVisualProps) {
  const objectChipFillColor = isNightScene ? "rgba(17,17,17,0.84)" : "rgba(255,255,255,0.87)";
  const objectChipStrokeColor = isNightScene
    ? "rgba(255,255,255,0.55)"
    : "rgba(17,17,17,0.3)";
  const objectChipTextColor = isNightScene ? "#F5F5F5" : "#171717";

  return (
    <>
      <Image
        src={backgroundSrc}
        alt=""
        aria-hidden
        fill
        unoptimized
        sizes="100vw"
        className="select-none object-cover"
        onLoad={onBackgroundLoad}
        onError={onBackgroundError}
      />
      <div className={`absolute inset-0 ${seasonOverlayClass}`} />
      <div className={`absolute inset-0 ${timeOverlayClass}`} />

      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <g
          transform={`translate(${clamp(characterWorldPosition.x, 0, WORLD_WIDTH)} ${clamp(characterWorldPosition.y, 0, WORLD_HEIGHT)})`}
        >
          <circle
            cx="0"
            cy="-20"
            r="14"
            fill={isNightScene ? "rgba(241,245,249,0.22)" : "rgba(255,255,255,0.85)"}
            stroke={isNightScene ? "rgba(241,245,249,0.75)" : "rgba(23,23,23,0.5)"}
            strokeWidth="2"
          />
          <path
            d="M -14 2 Q 0 -6 14 2 L 14 26 L -14 26 Z"
            fill="rgba(185,28,28,0.72)"
            stroke={isNightScene ? "rgba(255,255,255,0.5)" : "rgba(23,23,23,0.4)"}
            strokeWidth="2"
          />
        </g>

        {placedObjects.map((placedObject) => {
          const objectVisual = OBJECT_VISUALS[placedObject.objectType];
          const halfImageSize = objectVisual.stageImageSize * 0.5;
          const worldX = clamp(placedObject.x, 0, WORLD_WIDTH);
          const worldY = clamp(placedObject.y, 0, WORLD_HEIGHT);

          return (
            <g
              key={placedObject.id}
              transform={`translate(${worldX} ${worldY})`}
            >
              <image
                href={objectVisual.imageSrc}
                x={-halfImageSize}
                y={-halfImageSize}
                width={objectVisual.stageImageSize}
                height={objectVisual.stageImageSize}
                preserveAspectRatio="xMidYMid slice"
              />
              <rect
                x="-34"
                y="18"
                width="68"
                height="20"
                rx="10"
                fill={objectChipFillColor}
                stroke={objectChipStrokeColor}
              />
              <text
                x="0"
                y="28"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fill={objectChipTextColor}
              >
                {objectVisual.label}
              </text>
            </g>
          );
        })}
      </svg>
    </>
  );
}

export default function TitlePage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [memberUserId, setMemberUserId] = useState<string | null>(null);
  const [scene, setScene] = useState<TitleGardenScene>(DEFAULT_GARDEN_SCENE);
  const [backgroundErrorState, setBackgroundErrorState] = useState<{
    sceneKey: string;
    index: number;
  }>({ sceneKey: "", index: 0 });
  const [tapPoint, setTapPoint] = useState<{ x: number; y: number } | null>(null);
  const [showTitleText, setShowTitleText] = useState(true);
  const [loadedBackgroundSrc, setLoadedBackgroundSrc] = useState<string | null>(null);
  const isTransitioningRef = useRef(false);
  const transitionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const resolveAuthState = async () => {
      const supabase = getSupabaseClient();
      const session = await getSupabaseSessionOrNull(supabase);
      if (isCancelled) {
        return;
      }

      const user = session?.user ?? null;
      if (user && !isAnonymousSupabaseUser(user)) {
        setMemberUserId(user.id);
        setAuthState("member");
      } else {
        setMemberUserId(null);
        setAuthState("guest");
      }
    };

    void resolveAuthState();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authState !== "member" || !memberUserId) {
      return;
    }

    const localStateStorageKey = createGardenLocalStateStorageKey(memberUserId);
    const objectStorageKey = getGardenObjectsStorageKeyForOwner(memberUserId);
    const characterPositionStorageKey =
      createGardenCharacterPositionStorageKey(memberUserId);

    const applyScene = () => {
      const localState =
        parseGardenLocalState(window.localStorage.getItem(localStateStorageKey)) ??
        getDefaultGardenLocalState();
      const placedObjects = parseTitlePlacedObjects(
        window.localStorage.getItem(objectStorageKey),
      );
      const characterWorldPosition =
        parseGardenCharacterPosition(
          window.localStorage.getItem(characterPositionStorageKey),
        ) ?? DEFAULT_GARDEN_SCENE.characterWorldPosition;

      setScene({
        ...localState,
        placedObjects,
        characterWorldPosition,
      });
    };

    const loadTimerId = window.setTimeout(() => {
      applyScene();
    }, 0);

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key !== localStateStorageKey &&
        event.key !== objectStorageKey &&
        event.key !== characterPositionStorageKey
      ) {
        return;
      }

      applyScene();
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.clearTimeout(loadTimerId);
      window.removeEventListener("storage", handleStorage);
    };
  }, [authState, memberUserId]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  const handlePointerDown = async (event: ReactPointerEvent<HTMLElement>) => {
    if (authState !== "member" || isTransitioningRef.current) {
      return;
    }

    isTransitioningRef.current = true;

    const nextPoint = { x: event.clientX, y: event.clientY };
    setTapPoint(nextPoint);
    setShowTitleText(false);

    try {
      // Start and play one-shot ripple sound inside this gesture handler.
      await Tone.start();
      const reverb = new Tone.Reverb({ decay: 5.2, wet: 0.62 }).toDestination();
      const synth = new Tone.MembraneSynth({
        pitchDecay: 0.08,
        octaves: 4,
        envelope: { attack: 0.001, decay: 1.2, sustain: 0, release: 2.1 },
      }).connect(reverb);

      synth.triggerAttackRelease("C2", "8n", undefined, 0.9);

      window.setTimeout(() => {
        synth.dispose();
        reverb.dispose();
      }, 1800);
    } catch {
      // Continue visual transition even if audio setup fails.
    }

    transitionTimerRef.current = window.setTimeout(() => {
      router.push("/garden/me");
    }, 2000);
  };

  const backgroundCandidates = useMemo(
    () =>
      buildGardenBackgroundCandidates(
        scene.backgroundId,
        scene.seasonId,
        scene.timeSlotId,
      ),
    [scene.backgroundId, scene.seasonId, scene.timeSlotId],
  );
  const sceneKey = `${scene.backgroundId}:${scene.seasonId}:${scene.timeSlotId}`;
  const activeBackgroundIndex =
    backgroundErrorState.sceneKey === sceneKey ? backgroundErrorState.index : 0;
  const backgroundSrc =
    backgroundCandidates[
      Math.min(activeBackgroundIndex, Math.max(0, backgroundCandidates.length - 1))
    ];
  const isBackgroundLoading = loadedBackgroundSrc !== backgroundSrc;

  const handleBackgroundError = () => {
    setBackgroundErrorState((current) => {
      const currentIndex = current.sceneKey === sceneKey ? current.index : 0;
      const lastIndex = Math.max(0, backgroundCandidates.length - 1);
      const nextIndex = currentIndex < lastIndex ? currentIndex + 1 : currentIndex;

      return {
        sceneKey,
        index: nextIndex,
      };
    });
  };

  const handleBackgroundLoad = () => {
    setLoadedBackgroundSrc(backgroundSrc);
  };

  const seasonOverlayClass = getSeasonOverlayClass(scene.seasonId);
  const timeOverlayClass = getTimeOverlayClass(scene.timeSlotId);
  const isNightScene = scene.timeSlotId === "night";

  if (authState === "member") {
    return (
      <main
        className="relative h-screen w-full cursor-pointer overflow-hidden bg-wa-black [touch-action:manipulation]"
        onPointerDown={(event) => {
          void handlePointerDown(event);
        }}
      >
        <div className="pointer-events-none absolute inset-0 scale-[1.05] [filter:blur(20px)_brightness(0.7)]">
          <GardenSceneVisual
            backgroundSrc={backgroundSrc}
            seasonOverlayClass={seasonOverlayClass}
            timeOverlayClass={timeOverlayClass}
            placedObjects={scene.placedObjects}
            characterWorldPosition={scene.characterWorldPosition}
            isNightScene={isNightScene}
            onBackgroundLoad={handleBackgroundLoad}
            onBackgroundError={handleBackgroundError}
          />
        </div>

        {tapPoint ? (
          <motion.div
            className="pointer-events-none absolute inset-0 [will-change:clip-path]"
            initial={{ clipPath: `circle(0% at ${tapPoint.x}px ${tapPoint.y}px)` }}
            animate={{ clipPath: `circle(150% at ${tapPoint.x}px ${tapPoint.y}px)` }}
            transition={{
              duration: 1.5,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            <GardenSceneVisual
              backgroundSrc={backgroundSrc}
              seasonOverlayClass={seasonOverlayClass}
              timeOverlayClass={timeOverlayClass}
              placedObjects={scene.placedObjects}
              characterWorldPosition={scene.characterWorldPosition}
              isNightScene={isNightScene}
              onBackgroundLoad={handleBackgroundLoad}
              onBackgroundError={handleBackgroundError}
            />
          </motion.div>
        ) : null}

        {isBackgroundLoading ? (
          <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-wa-black/25 backdrop-blur-[2px]">
            <p className="rounded-full border border-white/40 bg-wa-black/55 px-3 py-1 text-xs tracking-[0.08em] text-white/95 animate-pulse">
              情景を読み込み中...
            </p>
          </div>
        ) : null}

        <AnimatePresence>
          {showTitleText ? (
            <motion.div
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3"
              initial={{ opacity: 1 }}
              exit={{
                opacity: 0,
                transition: {
                  duration: 0.55,
                  ease: "easeOut",
                },
              }}
            >
              <h1 className="font-serif text-6xl font-bold tracking-[0.22em] text-wa-white drop-shadow-[0_8px_30px_rgba(0,0,0,0.55)] sm:text-7xl">
                風流
              </h1>
              <p className="text-xs tracking-[0.45em] text-wa-white/70 sm:text-sm">水面に触れる</p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
    );
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[radial-gradient(circle_at_12%_18%,rgba(217,156,88,0.22),transparent_34%),radial-gradient(circle_at_88%_82%,rgba(165,33,117,0.16),transparent_36%),linear-gradient(160deg,#f9f4ea_0%,#fbf8f2_55%,#f0e6d7_100%)] px-6 py-12 text-wa-black font-serif">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(43,43,43,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(43,43,43,0.04)_1px,transparent_1px)] bg-[size:28px_28px]" />

      <section className="relative w-full max-w-2xl rounded-3xl border border-wa-black/20 bg-white/90 p-8 shadow-[0_24px_64px_rgba(43,43,43,0.14)] sm:p-10">
        <div className="grid gap-6">
          <p className="w-fit rounded-full border border-wa-black/20 bg-white px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-wa-black/70">
            TITLE SCREEN
          </p>

          <div className="grid gap-3">
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl">風流 - Kazenagare</h1>
            <p className="text-sm leading-relaxed text-wa-black/75 sm:text-base">
              声を和の情景へ溶け込ませる、ささやかな庭あそび。
            </p>
          </div>

          {authState === "loading" ? (
            <p className="text-sm text-wa-black/70">庭を準備しています...</p>
          ) : null}

          {authState === "guest" ? (
            <div className="flex flex-wrap gap-3">
              <Link
                href="/top"
                className="inline-flex items-center rounded-full border-2 border-wa-black bg-wa-black px-6 py-2.5 text-sm font-semibold text-wa-white transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-wa-red active:translate-y-[1px] active:scale-[0.98]"
              >
                タイトルからはじめる
              </Link>
              <Link
                href="/garden"
                className="inline-flex items-center rounded-full border border-wa-black/25 bg-white px-6 py-2.5 text-sm font-semibold transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-wa-red/10 active:translate-y-[1px] active:scale-[0.98]"
              >
                庭一覧へ
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}