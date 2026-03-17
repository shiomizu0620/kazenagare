"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";
import { AuthSection } from "@/components/auth/auth-section";
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
const GUEST_ACTION_TEXTS = ["庭の門を叩く", "風の便りを聞く"] as const;
const DEFAULT_GUEST_ACTION_TEXT = GUEST_ACTION_TEXTS[0];
const GARDEN_ENTRY_DELAY_MS = 1300;
const OAUTH_REDIRECT_PENDING_KEY = "kazenagare.oauthRedirectPending";

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

type EntryLoadingOverlayProps = {
  durationMs: number;
};

function EntryLoadingOverlay({ durationMs }: EntryLoadingOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-wa-black/28 backdrop-blur-[1px]">
      <div className="w-[min(88vw,320px)] rounded-2xl border border-white/30 bg-wa-black/60 px-4 py-3 text-white shadow-[0_16px_36px_rgba(0,0,0,0.35)]">
        <div className="mb-2 flex items-center justify-between text-xs tracking-[0.08em] text-white/90">
          <span>庭へ移動中...</span>
          <span>LOADING</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
          <motion.div
            className="h-full origin-left bg-white/90"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: durationMs / 1000, ease: "linear" }}
          />
        </div>
      </div>
    </div>
  );
}

function TitlePageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [memberUserId, setMemberUserId] = useState<string | null>(null);
  const [scene, setScene] = useState<TitleGardenScene>(DEFAULT_GARDEN_SCENE);
  const [backgroundErrorState, setBackgroundErrorState] = useState<{
    sceneKey: string;
    index: number;
  }>({ sceneKey: "", index: 0 });
  const [tapPoint, setTapPoint] = useState<{ x: number; y: number } | null>(null);
  const [showTitleText, setShowTitleText] = useState(true);
  const [guestIntroActivated, setGuestIntroActivated] = useState(false);
  const [isEnteringGarden, setIsEnteringGarden] = useState(false);
  const [loadedBackgroundSrc, setLoadedBackgroundSrc] = useState<string | null>(null);
  const isTransitioningRef = useRef(false);
  const transitionTimerRef = useRef<number | null>(null);
  const shouldOpenLoginPanel = searchParams.get("login") === "1";
  const isLoginPanelVisible = shouldOpenLoginPanel || (authState === "guest" && guestIntroActivated);
  const shouldSkipGuestLoginAnimation = shouldOpenLoginPanel;

  const playRippleTransitionSound = async () => {
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
  };

  const playGateChimeSound = async () => {
    await Tone.start();

    const reverb = new Tone.Reverb({ decay: 3.4, wet: 0.35 }).toDestination();
    const synth = new Tone.FMSynth({
      harmonicity: 3.01,
      modulationIndex: 10,
      oscillator: { type: "sine" },
      envelope: { attack: 0.002, decay: 0.9, sustain: 0, release: 1.8 },
      modulation: { type: "square" },
      modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.6 },
    }).connect(reverb);

    synth.triggerAttackRelease("G5", "16n", undefined, 0.45);
    window.setTimeout(() => {
      synth.triggerAttackRelease("D6", "16n", undefined, 0.36);
    }, 130);

    window.setTimeout(() => {
      synth.dispose();
      reverb.dispose();
    }, 1900);
  };

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

  const scheduleGardenEntry = useCallback(() => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
    }

    transitionTimerRef.current = window.setTimeout(() => {
      router.push("/garden/me");
    }, GARDEN_ENTRY_DELAY_MS);
  }, [router]);

  useEffect(() => {
    if (!isLoginPanelVisible || tapPoint) {
      return;
    }

    const openLoginTimerId = window.setTimeout(() => {
      setTapPoint({
        x: window.innerWidth * 0.5,
        y: window.innerHeight * 0.72,
      });
    }, 0);

    return () => {
      window.clearTimeout(openLoginTimerId);
    };
  }, [isLoginPanelVisible, tapPoint]);

  const handlePointerDown = async (event: ReactPointerEvent<HTMLElement>) => {
    if (authState !== "member" || isTransitioningRef.current) {
      return;
    }

    isTransitioningRef.current = true;
    setIsEnteringGarden(true);

    const nextPoint = { x: event.clientX, y: event.clientY };
    setTapPoint(nextPoint);
    setShowTitleText(false);

    void playRippleTransitionSound().catch(() => {
      // Continue visual transition even if audio setup fails.
    });
    scheduleGardenEntry();
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

  function startGardenEntryTransition(nextUserId: string) {
    if (!nextUserId || isTransitioningRef.current) {
      return;
    }

    isTransitioningRef.current = true;
    setMemberUserId(nextUserId);
    setAuthState("member");
    setShowTitleText(false);
    setIsEnteringGarden(true);
    setTapPoint((currentTapPoint) =>
      currentTapPoint ?? {
        x: window.innerWidth * 0.5,
        y: window.innerHeight * 0.62,
      },
    );

    void playRippleTransitionSound().catch(() => {
      // Continue visual transition even if audio setup fails.
    });
    scheduleGardenEntry();
  }

  useEffect(() => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      return;
    }

    const hasPendingOAuthRedirect = () =>
      window.sessionStorage.getItem(OAUTH_REDIRECT_PENDING_KEY) === "1";

    const clearPendingOAuthRedirect = () => {
      window.sessionStorage.removeItem(OAUTH_REDIRECT_PENDING_KEY);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        (event === "INITIAL_SESSION" || event === "SIGNED_IN") &&
        session &&
        hasPendingOAuthRedirect() &&
        !isAnonymousSupabaseUser(session.user)
      ) {
        clearPendingOAuthRedirect();
        startGardenEntryTransition(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [scheduleGardenEntry]);

  const handleGuestIntroTap = async (event: ReactPointerEvent<HTMLElement>) => {
    if (authState !== "guest" || isTransitioningRef.current || isLoginPanelVisible) {
      return;
    }

    setTapPoint({ x: event.clientX, y: event.clientY });
    setGuestIntroActivated(true);

    try {
      await playGateChimeSound();
    } catch {
      // Keep intro transition even if audio setup fails.
    }
  };

  const handleAuthCompletedOnTitle = async ({
    userId,
    isAnonymous,
  }: {
    userId: string | null;
    isAnonymous: boolean;
  }) => {
    if (!userId || isAnonymous) {
      return;
    }

    startGardenEntryTransition(userId);
  };

  const handleCloseLoginPanel = () => {
    setGuestIntroActivated(false);
    setTapPoint(null);

    if (!shouldOpenLoginPanel) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete("login");
    const nextSearch = nextSearchParams.toString();
    const nextHref = nextSearch.length > 0 ? `${pathname}?${nextSearch}` : pathname;
    router.replace(nextHref, { scroll: false });
  };

  const seasonOverlayClass = getSeasonOverlayClass(scene.seasonId);
  const timeOverlayClass = getTimeOverlayClass(scene.timeSlotId);
  const isNightScene = scene.timeSlotId === "night";

  if (authState === "member" && !shouldOpenLoginPanel) {
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

        {isEnteringGarden ? <EntryLoadingOverlay durationMs={GARDEN_ENTRY_DELAY_MS} /> : null}

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

        <button
          type="button"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            router.push("/?login=1", { scroll: false });
          }}
          className="absolute bottom-5 right-5 z-40 inline-flex items-center rounded-full border border-white/45 bg-black/55 px-4 py-2 text-xs font-semibold tracking-[0.08em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.35)] backdrop-blur-sm transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-black/70 active:translate-y-[1px] active:scale-[0.98]"
        >
          ログイン画面を開く
        </button>
      </main>
    );
  }

  return (
    <main
      className="relative h-screen w-full overflow-hidden bg-wa-black text-wa-white font-serif [touch-action:manipulation]"
      onPointerDown={(event) => {
        void handleGuestIntroTap(event);
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

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(255,255,255,0.2),transparent_42%),linear-gradient(to_bottom,rgba(5,8,12,0.3),rgba(5,8,12,0.55))]" />

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

      {isEnteringGarden ? <EntryLoadingOverlay durationMs={GARDEN_ENTRY_DELAY_MS} /> : null}

      <motion.div
        className="pointer-events-none absolute inset-x-0 top-[42%] z-20 flex -translate-y-1/2 flex-col items-center gap-3 px-6 text-center"
        initial={false}
        animate={
          isLoginPanelVisible
            ? {
                top: "20%",
              }
            : {
                top: "42%",
              }
        }
        transition={{ duration: shouldSkipGuestLoginAnimation ? 0 : 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="font-serif text-6xl font-bold tracking-[0.22em] text-wa-white drop-shadow-[0_8px_30px_rgba(0,0,0,0.55)] sm:text-7xl">
          風流
        </h1>
        <p className="text-xs tracking-[0.3em] text-wa-white/80 sm:text-sm">
          {isLoginPanelVisible ? "風の便りに耳を澄ます" : DEFAULT_GUEST_ACTION_TEXT}
        </p>
      </motion.div>

      <AnimatePresence>
        {!isLoginPanelVisible && authState === "guest" ? (
          <motion.p
            className="pointer-events-none absolute bottom-[16%] left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/35 bg-white/10 px-4 py-2 text-xs tracking-[0.16em] text-white/90 backdrop-blur-sm"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            画面をタップ
          </motion.p>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isLoginPanelVisible ? (
          <motion.section
            className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-4 pb-6 sm:px-6 sm:pb-8"
            initial={shouldSkipGuestLoginAnimation ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: shouldSkipGuestLoginAnimation ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="pointer-events-auto relative mx-auto w-full max-w-2xl rounded-3xl border border-white/25 bg-white/10 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-6">
              <button
                type="button"
                aria-label="ログイン画面を閉じる"
                onClick={handleCloseLoginPanel}
                className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-black/40 text-base font-semibold text-white transition-colors hover:bg-black/65"
              >
                ×
              </button>
              <p className="mb-3 text-[11px] font-semibold tracking-[0.18em] text-white/80">
                GATE LOGIN
              </p>
              <AuthSection
                variant="mist"
                disableAutoNavigation
                onAuthCompleted={handleAuthCompletedOnTitle}
                showGuestLogin
                autoFocusEmail={shouldOpenLoginPanel}
              />

              <div className="mt-4 border-t border-white/15 pt-4">
                <Link
                  href="/garden"
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-white/30 bg-white/12 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                >
                  庭一覧へ
                </Link>
              </div>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </main>
  );
}

export default function TitlePage() {
  return (
    <Suspense fallback={null}>
      <TitlePageContent />
    </Suspense>
  );
}