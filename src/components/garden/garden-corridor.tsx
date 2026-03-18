"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type WheelEvent,
} from "react";

export type GardenCorridorPost = {
  userId: string;
  ownerDisplayName?: string | null;
  backgroundName: string;
  seasonName: string;
  timeSlotName: string;
  seasonId: string;
  timeSlotId: string;
  thumbnailSrc: string;
  remainingTimeLabel: string;
};

type DecoratedCorridorPost = GardenCorridorPost & {
  ownerLabel: string;
  motionClass: string;
};

type GardenCorridorProps = {
  posts: GardenCorridorPost[];
  nextMyGardenHref: string;
};

type TransitionState = {
  originX: number;
  originY: number;
  radius: number;
};

type Atmosphere = {
  seasonGlow: string;
  timeGlow: string;
  depth: string;
  haze: string;
};

const DEFAULT_ATMOSPHERE: Atmosphere = {
  seasonGlow: "rgba(98, 122, 158, 0.18)",
  timeGlow: "rgba(64, 80, 112, 0.32)",
  depth: "#04070f",
  haze: "rgba(15, 24, 40, 0.66)",
};

const SEASON_ATMOSPHERE: Record<string, Pick<Atmosphere, "seasonGlow" | "depth">> = {
  spring: {
    seasonGlow: "rgba(139, 177, 154, 0.28)",
    depth: "#101a20",
  },
  summer: {
    seasonGlow: "rgba(78, 146, 120, 0.3)",
    depth: "#0a1716",
  },
  autumn: {
    seasonGlow: "rgba(170, 112, 92, 0.32)",
    depth: "#151423",
  },
  winter: {
    seasonGlow: "rgba(124, 151, 176, 0.26)",
    depth: "#0f1625",
  },
};

const TIME_ATMOSPHERE: Record<string, Pick<Atmosphere, "timeGlow" | "haze">> = {
  morning: {
    timeGlow: "rgba(157, 180, 205, 0.32)",
    haze: "rgba(50, 74, 105, 0.4)",
  },
  daytime: {
    timeGlow: "rgba(102, 136, 175, 0.3)",
    haze: "rgba(42, 61, 89, 0.38)",
  },
  evening: {
    timeGlow: "rgba(190, 122, 88, 0.34)",
    haze: "rgba(66, 42, 54, 0.5)",
  },
  night: {
    timeGlow: "rgba(75, 96, 143, 0.4)",
    haze: "rgba(16, 26, 45, 0.72)",
  },
};

function hashSeed(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function resolveOwnerLabel(ownerDisplayName: string | null | undefined, userId: string) {
  return ownerDisplayName?.trim() || userId;
}

function resolveAtmosphere(post: GardenCorridorPost | null): Atmosphere {
  if (!post) {
    return DEFAULT_ATMOSPHERE;
  }

  const seasonAtmosphere = SEASON_ATMOSPHERE[post.seasonId] ?? DEFAULT_ATMOSPHERE;
  const timeAtmosphere = TIME_ATMOSPHERE[post.timeSlotId] ?? DEFAULT_ATMOSPHERE;

  return {
    seasonGlow: seasonAtmosphere.seasonGlow,
    timeGlow: timeAtmosphere.timeGlow,
    depth: seasonAtmosphere.depth,
    haze: timeAtmosphere.haze,
  };
}

function resolveActivationPoint(
  event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
) {
  const rect = event.currentTarget.getBoundingClientRect();

  if (
    "clientX" in event &&
    (event.clientX !== 0 || event.clientY !== 0 || event.detail !== 0)
  ) {
    return {
      x: event.clientX,
      y: event.clientY,
    };
  }

  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function playGateTone() {
  if (typeof window === "undefined") {
    return;
  }

  const AudioContextClass =
    window.AudioContext ||
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  const context = new AudioContextClass();
  const now = context.currentTime;

  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1800, now);
  filter.frequency.exponentialRampToValueAtTime(420, now + 1.8);

  const body = context.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(392, now);
  body.frequency.exponentialRampToValueAtTime(196, now + 1.7);

  const bodyGain = context.createGain();
  bodyGain.gain.setValueAtTime(0.0001, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.24, now + 0.05);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.75);

  const shimmer = context.createOscillator();
  shimmer.type = "triangle";
  shimmer.frequency.setValueAtTime(784, now);
  shimmer.frequency.exponentialRampToValueAtTime(392, now + 1.25);

  const shimmerGain = context.createGain();
  shimmerGain.gain.setValueAtTime(0.0001, now);
  shimmerGain.gain.exponentialRampToValueAtTime(0.08, now + 0.04);
  shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

  body.connect(bodyGain);
  shimmer.connect(shimmerGain);
  bodyGain.connect(filter);
  shimmerGain.connect(filter);
  filter.connect(context.destination);

  body.start(now);
  shimmer.start(now + 0.01);
  body.stop(now + 1.8);
  shimmer.stop(now + 1.2);

  window.setTimeout(() => {
    void context.close().catch(() => undefined);
  }, 2300);
}

export function GardenCorridor({ posts, nextMyGardenHref }: GardenCorridorProps) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [transitionState, setTransitionState] = useState<TransitionState | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [ambientMotionReady, setAmbientMotionReady] = useState(false);
  const [settledThumbnailKeyMap, setSettledThumbnailKeyMap] = useState<Record<string, true>>({});
  const transitionTimerRef = useRef<number | null>(null);
  const sceneRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyPreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    applyPreference();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", applyPreference);

      return () => {
        mediaQuery.removeEventListener("change", applyPreference);
      };
    }

    mediaQuery.addListener(applyPreference);

    return () => {
      mediaQuery.removeListener(applyPreference);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setAmbientMotionReady(true);
    }, 220);

    return () => {
      window.clearTimeout(timerId);
    };
  }, []);

  const decoratedPosts = useMemo<DecoratedCorridorPost[]>(() => {
    return posts.map((post, index) => ({
      ...post,
      ownerLabel: resolveOwnerLabel(post.ownerDisplayName, post.userId),
      motionClass: `kazenagare-tanzaku-motion-${hashSeed(`${post.userId}-${index}`) % 8}`,
    }));
  }, [posts]);

  const postsSignature = useMemo(
    () => posts.map((post, index) => `${post.userId}:${post.thumbnailSrc}:${index}`).join("|"),
    [posts],
  );

  const handleThumbnailSettled = useCallback((thumbnailKey: string) => {
    setSettledThumbnailKeyMap((current) => {
      if (current[thumbnailKey]) {
        return current;
      }

      return {
        ...current,
        [thumbnailKey]: true,
      };
    });
  }, []);

  const activePost = activeIndex !== null ? decoratedPosts[activeIndex] ?? null : null;
  const atmosphere = useMemo(() => resolveAtmosphere(activePost), [activePost]);
  const settledThumbnailCount = useMemo(() => {
    if (!postsSignature) {
      return 0;
    }

    const currentPrefix = `${postsSignature}::`;
    return Object.keys(settledThumbnailKeyMap).filter((key) => key.startsWith(currentPrefix)).length;
  }, [postsSignature, settledThumbnailKeyMap]);
  const totalThumbnailCount = decoratedPosts.length;
  const thumbnailProgressPercent =
    totalThumbnailCount === 0
      ? 100
      : Math.min(100, Math.round((settledThumbnailCount / totalThumbnailCount) * 100));
  const shouldShowThumbnailProgress = totalThumbnailCount > 0 && settledThumbnailCount < totalThumbnailCount;

  useEffect(() => {
    if (!sceneRef.current) {
      return;
    }

    sceneRef.current.style.setProperty("--kz-scene-season-glow", atmosphere.seasonGlow);
    sceneRef.current.style.setProperty("--kz-scene-time-glow", atmosphere.timeGlow);
    sceneRef.current.style.setProperty("--kz-scene-haze", atmosphere.haze);
    sceneRef.current.style.setProperty("--kz-scene-depth", atmosphere.depth);
  }, [atmosphere]);

  useEffect(() => {
    if (!activePost || transitionState) {
      return;
    }

    void router.prefetch(`/garden/${activePost.userId}`);
  }, [activePost, router, transitionState]);

  const handleCorridorWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (transitionState) {
        event.preventDefault();
        return;
      }

      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return;
      }

      event.preventDefault();
      event.currentTarget.scrollLeft += event.deltaY;
    },
    [transitionState],
  );

  const activatePost = useCallback(
    (
      post: GardenCorridorPost,
      index: number,
      event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
    ) => {
      if (transitionState) {
        return;
      }

      event.preventDefault();

      const point = resolveActivationPoint(event);
      const maxDistanceX = Math.max(point.x, window.innerWidth - point.x);
      const maxDistanceY = Math.max(point.y, window.innerHeight - point.y);
      const radius = Math.hypot(maxDistanceX, maxDistanceY) + 20;

      if (sceneRef.current) {
        sceneRef.current.style.setProperty("--kz-ripple-x", `${point.x}px`);
        sceneRef.current.style.setProperty("--kz-ripple-y", `${point.y}px`);
        sceneRef.current.style.setProperty("--kz-ripple-size", `${radius * 2}px`);
        sceneRef.current.style.setProperty(
          "--kz-ripple-duration",
          `${prefersReducedMotion ? 180 : 880}ms`,
        );
      }

      setActiveIndex(index);
      setTransitionState({
        originX: point.x,
        originY: point.y,
        radius,
      });

      playGateTone();

      transitionTimerRef.current = window.setTimeout(() => {
        router.push(`/garden/${post.userId}`);
      }, prefersReducedMotion ? 120 : 940);
    },
    [prefersReducedMotion, router, transitionState],
  );

  return (
    <main ref={sceneRef} className="kazenagare-washitsu-scene relative h-[100svh] overflow-hidden overscroll-none text-[#f4ecde] md:h-[100dvh] md:overscroll-auto">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(252,226,176,0.09),rgba(19,14,13,0.78))]" />
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(239,220,186,0.05)_0_2px,transparent_2px_140px)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 border-b border-[#d8be94]/28 bg-[linear-gradient(180deg,rgba(42,26,17,0.95),rgba(28,18,13,0.88))]" />

      {shouldShowThumbnailProgress && !transitionState ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-4 pt-2 sm:px-8">
          <div className="mx-auto w-full max-w-5xl">
            <div className="h-1.5 overflow-hidden rounded-full border border-[#d6bb90]/45 bg-[#2a1c13]/68">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#cfe9ff,#f2d6a8,#c7e6ff)] transition-[width] duration-300 ease-out"
                style={{ width: `${thumbnailProgressPercent}%` }}
              />
            </div>
            <p className="mt-1 text-right text-[10px] tracking-[0.12em] text-[#ead7bc]/74">
              掛け軸を準備中 {settledThumbnailCount}/{totalThumbnailCount}
            </p>
          </div>
        </div>
      ) : null}

      <div
        className={`relative z-10 flex h-full flex-col ${
          transitionState ? "pointer-events-none select-none" : ""
        }`}
      >
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-6 sm:px-8 sm:pt-8">
          <div className="space-y-2">
            <p className="text-[11px] tracking-[0.42em] text-[#ecd7b7]/58">TOKONOMA GALLERY</p>
            <h1 className="text-2xl font-semibold tracking-[0.08em] text-[#f4e8d2] sm:text-3xl">座敷の掛け軸</h1>
            <p className="text-xs text-[#dcc7aa]/76 sm:text-sm">畳の縁に沿ってなぞり、気になる景色の掛け軸を開く</p>
          </div>

          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Link
              href="/?login=1"
              className="rounded-full border border-[#ebd3af]/35 bg-[#2f1d15]/68 px-4 py-2 tracking-[0.1em] text-[#f0e1c8]/90 transition-colors hover:border-[#f0dec1]/58 hover:bg-[#442a1d]/74"
            >
              トップへ戻る
            </Link>
            <Link
              href={nextMyGardenHref}
              className="rounded-full border border-[#ebd3af]/35 bg-[#2f1d15]/68 px-4 py-2 tracking-[0.1em] text-[#f0e1c8]/90 transition-colors hover:border-[#f0dec1]/58 hover:bg-[#442a1d]/74"
            >
              自分の庭へ
            </Link>
          </div>
        </header>

        {posts.length === 0 ? (
          <section className="flex flex-1 items-center justify-center px-6 pb-14">
            <p className="max-w-xl rounded-3xl border border-[#e8d2b0]/26 bg-[#20150f]/62 px-6 py-6 text-center text-sm leading-7 text-[#e8dbc8]/82 sm:text-base">
              今はまだ静寂だけが漂っています。
              <br />
              自分の庭を公開すると、この床の間に掛け軸が並びます。
            </p>
          </section>
        ) : (
          <section className="relative flex flex-1 flex-col pb-4">
            <div
              className="kazenagare-hide-scrollbar relative flex-1 overflow-x-auto overflow-y-hidden overscroll-y-none pb-8 pt-7 touch-pan-x sm:pt-9"
              onWheel={handleCorridorWheel}
            >
              <ul className="flex h-full w-max items-end gap-6 px-[max(7vw,2rem)] pb-6 sm:gap-9 sm:px-[max(8vw,3rem)] sm:pb-8">
                {decoratedPosts.map((post, index) => {
                  const isActive = activeIndex === index;
                  const shouldAnimate = ambientMotionReady && !prefersReducedMotion;

                  return (
                    <li
                      key={post.userId}
                      className={`kazenagare-kakejiku-shell ${post.motionClass} ${
                        shouldAnimate ? "kazenagare-tanzaku-drift" : "kazenagare-tanzaku-static"
                      } ${
                        isActive ? "kazenagare-tanzaku-drift-paused" : ""
                      }`}
                    >
                      <button
                        type="button"
                        className={`group relative flex h-[27rem] w-[11.3rem] flex-col items-center rounded-[1.65rem] px-2 py-3 text-left transition-all duration-500 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ecdcc4]/72 sm:h-[28.2rem] sm:w-[11.8rem] ${
                          isActive ? "-translate-y-3 scale-[1.03]" : "hover:-translate-y-1.5"
                        }`}
                        aria-label={`${post.ownerLabel} の庭へ訪れる`}
                        onMouseEnter={() => {
                          if (!transitionState) {
                            setActiveIndex(index);
                          }
                        }}
                        onMouseLeave={() => {
                          if (!transitionState) {
                            setActiveIndex(null);
                          }
                        }}
                        onFocus={() => {
                          if (!transitionState) {
                            setActiveIndex(index);
                          }
                        }}
                        onBlur={() => {
                          if (!transitionState) {
                            setActiveIndex(null);
                          }
                        }}
                        onClick={(event) => {
                          activatePost(post, index, event);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") {
                            return;
                          }

                          activatePost(post, index, event);
                        }}
                      >
                        <span
                          className={`pointer-events-none absolute top-2 h-[11px] w-[88%] rounded-full border border-[#c9a97d]/80 bg-[linear-gradient(180deg,#dac39f,#b08658)] shadow-[0_2px_7px_rgba(0,0,0,0.35)] ${
                            isActive ? "opacity-100" : "opacity-92"
                          }`}
                        />
                        <span className="pointer-events-none absolute bottom-[10px] h-[11px] w-[80%] rounded-full border border-[#8c6b45]/80 bg-[linear-gradient(180deg,#b38c61,#7a5a3b)] shadow-[0_2px_7px_rgba(0,0,0,0.3)]" />

                        <div
                          className={`relative mt-3 flex h-full w-full flex-col overflow-hidden rounded-[1rem] border transition-all duration-500 ${
                            isActive
                              ? "border-[#f3e3cb]/82 bg-[#f8eedb]/96 shadow-[0_0_36px_rgba(230,192,143,0.32)]"
                              : "border-[#d9c0a0]/52 bg-[#f3e5cd]/90"
                          }`}
                        >
                          <span className="mx-auto mt-2 text-[10px] tracking-[0.34em] text-[#6f5a42]/68">掛け軸</span>

                          <div className="relative mx-2 mt-2 h-28 overflow-hidden rounded-[0.58rem] border border-[#c8ae8a]/56 bg-[#d8c3a1]">
                            <Image
                              src={post.thumbnailSrc}
                              alt={`${post.ownerLabel}の庭の景色`}
                              fill
                              sizes="(max-width: 640px) 180px, 190px"
                              priority={index < 2}
                              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.08] group-focus-visible:scale-[1.08]"
                              onLoadingComplete={() => {
                                handleThumbnailSettled(`${postsSignature}::${post.userId}-${index}`);
                              }}
                              onError={() => {
                                handleThumbnailSettled(`${postsSignature}::${post.userId}-${index}`);
                              }}
                            />
                            <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#120d08]/44 via-transparent to-[#f6ebda]/16" />
                          </div>

                          <div className="mx-2 mt-2 border-t border-[#b99d79]/55" />

                          <div className="mt-2 flex flex-1 items-center justify-center px-3 text-[#3e3223] [text-orientation:upright] [writing-mode:vertical-rl]">
                            <p className="text-center text-[1.1rem] leading-[1.66] tracking-[0.13em]">{post.ownerLabel}の庭</p>
                          </div>

                          <p className="mx-2 mt-2 rounded-[0.45rem] border border-[#ba9f7a]/54 bg-[#f7ecd8]/84 px-2 py-1 text-center text-[11px] tracking-[0.08em] text-[#5f4a32]">
                            消去まで {post.remainingTimeLabel}
                          </p>

                          <span
                            className={`mb-3 mt-2 text-center text-sm tracking-[0.3em] text-[#5f4932] transition-all duration-400 ${
                              isActive ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                            }`}
                          >
                            訪れる
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#140f0e] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#140f0e] to-transparent" />
          </section>
        )}
      </div>

      {transitionState ? (
        <div className="pointer-events-none absolute inset-0 z-40 bg-[#050912]/38">
          <span className="kazenagare-ink-ripple" />
        </div>
      ) : null}
    </main>
  );
}