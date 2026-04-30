"use client";

import { get as getIdbValue } from "idb-keyval";
import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, Loader2, SendHorizontal, Trash2 } from "lucide-react";
import {
  OBJECT_VISUALS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "@/components/garden/empty/empty-stage-character/empty-stage-character.constants";
import {
  getSeasonOverlayClass,
  getTimeOverlayClass,
} from "@/components/garden/empty/empty-stage-theme";
import { getSupabaseClient, getSupabaseSessionOrNull } from "@/lib/supabase/client";
import {
  GARDEN_OBJECTS_STORAGE_KEY_ME,
  getGardenObjectsStorageKeyForOwner,
} from "@/lib/garden/placed-objects-storage";
import { parseGardenPostPlacedObjects } from "@/lib/garden/posts";
import { isAnonymousSupabaseUser } from "@/lib/auth/user";
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
import { GARDEN_BACKGROUNDS, GARDEN_SEASONS, GARDEN_TIME_SLOTS } from "@/lib/garden/setup/options";
import { buildGardenBackgroundCandidates } from "@/lib/garden/background-images";
import {
  getLatestRecordingIdByObjectType,
  getVoiceZooRecordingBlobStorageKey,
  getVoiceZooRecordingCatalogStorageKey,
  parseVoiceZooRecordingCatalog,
} from "@/lib/voice-zoo/recordings";
import { type GardenPostPlacedObject } from "@/lib/garden/posts";

type PublishStatus = "idle" | "publishing" | "success" | "error";
type DeleteStatus = "idle" | "deleting" | "success" | "error";

const DEFAULT_PREVIEW_CHARACTER_WORLD_POSITION = {
  x: WORLD_WIDTH * 0.5,
  y: WORLD_HEIGHT * 0.5,
};

function normalizeOptionId(value: string | null, fallback: string, options: { id: string }[]) {
  if (!value) {
    return fallback;
  }

  return options.some((option) => option.id === value) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeDisplayNameCandidate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function resolveOwnerDisplayNameFromUser(currentUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const userMetadata = currentUser.user_metadata;
  const candidateKeys = [
    "display_name",
    "displayName",
    "full_name",
    "fullName",
    "name",
    "user_name",
    "username",
  ];

  for (const key of candidateKeys) {
    const resolvedName = normalizeDisplayNameCandidate(userMetadata?.[key]);
    if (resolvedName) {
      return resolvedName;
    }
  }

  if (typeof currentUser.email === "string") {
    const emailLocalPart = normalizeDisplayNameCandidate(
      currentUser.email.split("@")[0],
    );
    if (emailLocalPart) {
      return emailLocalPart;
    }
  }

  return currentUser.id;
}

function GardenPublishContent() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const searchParams = useSearchParams();
  const [isAuthLoading, setIsAuthLoading] = useState(Boolean(supabase));
  const [isGuestUser, setIsGuestUser] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<PublishStatus>("idle");
  const [deleteStatus, setDeleteStatus] = useState<DeleteStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(
    supabase ? null : "Supabase設定が不足しています。環境変数を確認してください。",
  );
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [previewBackgroundErrorState, setPreviewBackgroundErrorState] = useState<{
    sceneKey: string;
    index: number;
  }>({ sceneKey: "", index: 0 });
  const [loadedPreviewBackgroundState, setLoadedPreviewBackgroundState] = useState<{
    sceneKey: string;
    src: string | null;
  }>({ sceneKey: "", src: null });
  const [allowHarmonyOverlays, setAllowHarmonyOverlays] = useState(true);

  const defaultState = getDefaultGardenLocalState();
  const [draft, setDraft] = useState<GardenLocalState>(defaultState);

  const queryDraft = useMemo<GardenLocalState | null>(() => {
    const hasAnyQuery = Boolean(
      searchParams.get("background") || searchParams.get("season") || searchParams.get("time"),
    );

    if (!hasAnyQuery) {
      return null;
    }

    return {
      backgroundId: normalizeOptionId(
        searchParams.get("background"),
        defaultState.backgroundId,
        GARDEN_BACKGROUNDS,
      ),
      seasonId: normalizeOptionId(
        searchParams.get("season"),
        defaultState.seasonId,
        GARDEN_SEASONS,
      ),
      timeSlotId: normalizeOptionId(
        searchParams.get("time"),
        defaultState.timeSlotId,
        GARDEN_TIME_SLOTS,
      ),
    };
  }, [defaultState.backgroundId, defaultState.seasonId, defaultState.timeSlotId, searchParams]);

  const resolvedDraft = queryDraft ?? draft;

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isCancelled = false;

    const syncDraftAndPublishPreference = async (currentUser: { id: string } | null) => {
      if (!currentUser) {
        if (!isCancelled) {
          setDraft(defaultState);
          setAllowHarmonyOverlays(true);
        }
        return;
      }

      const localState = parseGardenLocalState(
        window.localStorage.getItem(createGardenLocalStateStorageKey(currentUser.id)),
      );

      if (!isCancelled && localState) {
        setDraft(localState);
      }

      const { data: currentPost } = await supabase
        .from("garden_posts")
        .select("allow_harmony_overlays")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (isCancelled) {
        return;
      }

      setAllowHarmonyOverlays(
        typeof currentPost?.allow_harmony_overlays === "boolean"
          ? currentPost.allow_harmony_overlays
          : true,
      );
    };

    const syncAuthState = async () => {
      const currentSession = await getSupabaseSessionOrNull(supabase);
      if (isCancelled) {
        return;
      }

      const currentUser = currentSession?.user ?? null;
      setUserId(currentUser?.id ?? null);
      setIsGuestUser(isAnonymousSupabaseUser(currentUser));
      setIsAuthLoading(false);

      await syncDraftAndPublishPreference(currentUser);
    };

    void syncAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUserId(currentUser?.id ?? null);
      setIsGuestUser(isAnonymousSupabaseUser(currentUser));
      setIsAuthLoading(false);

      void syncDraftAndPublishPreference(currentUser);
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, [defaultState, supabase]);

  const draftBackgroundName =
    GARDEN_BACKGROUNDS.find((option) => option.id === resolvedDraft.backgroundId)?.name ?? resolvedDraft.backgroundId;
  const draftSeasonName =
    GARDEN_SEASONS.find((option) => option.id === resolvedDraft.seasonId)?.name ?? resolvedDraft.seasonId;
  const draftTimeSlotName =
    GARDEN_TIME_SLOTS.find((option) => option.id === resolvedDraft.timeSlotId)?.name ?? resolvedDraft.timeSlotId;
  const seasonOverlayClass = getSeasonOverlayClass(resolvedDraft.seasonId);
  const timeOverlayClass = getTimeOverlayClass(resolvedDraft.timeSlotId);
  const isNightScene = resolvedDraft.timeSlotId === "night";
  const objectChipFillColor = isNightScene ? "rgba(17,17,17,0.84)" : "rgba(255,255,255,0.9)";
  const objectChipStrokeColor = isNightScene ? "rgba(255,255,255,0.55)" : "rgba(17,17,17,0.28)";
  const objectChipTextColor = isNightScene ? "#F5F5F5" : "#171717";
  const previewBackgroundCandidates = useMemo(
    () => buildGardenBackgroundCandidates(resolvedDraft.backgroundId, resolvedDraft.seasonId, resolvedDraft.timeSlotId),
    [resolvedDraft.backgroundId, resolvedDraft.seasonId, resolvedDraft.timeSlotId],
  );
  const previewSceneKey = `${resolvedDraft.backgroundId}:${resolvedDraft.seasonId}:${resolvedDraft.timeSlotId}`;
  const activePreviewBackgroundIndex =
    previewBackgroundErrorState.sceneKey === previewSceneKey ? previewBackgroundErrorState.index : 0;
  const previewBackgroundSrc =
    previewBackgroundCandidates[Math.min(activePreviewBackgroundIndex, Math.max(0, previewBackgroundCandidates.length - 1))];
  const isPreviewBackgroundLoading =
    loadedPreviewBackgroundState.sceneKey !== previewSceneKey ||
    loadedPreviewBackgroundState.src !== previewBackgroundSrc;

  const canPublish = useMemo(
    () => Boolean(userId) && !isGuestUser && !isAuthLoading && status !== "publishing",
    [isAuthLoading, isGuestUser, status, userId],
  );
  const canDeletePost = useMemo(
    () => Boolean(userId) && !isGuestUser && !isAuthLoading && deleteStatus !== "deleting",
    [deleteStatus, isAuthLoading, isGuestUser, userId],
  );

  const previewStorageSnapshot = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        placedObjects: [] as GardenPostPlacedObject[],
        characterWorldPosition: DEFAULT_PREVIEW_CHARACTER_WORLD_POSITION,
      };
    }

    const storageValue = userId
      ? (window.localStorage.getItem(getGardenObjectsStorageKeyForOwner(userId)) ??
        window.localStorage.getItem(GARDEN_OBJECTS_STORAGE_KEY_ME))
      : window.localStorage.getItem(GARDEN_OBJECTS_STORAGE_KEY_ME);
    const characterPositionStorageKey = userId
      ? createGardenCharacterPositionStorageKey(userId)
      : null;
    const storedCharacterWorldPosition = characterPositionStorageKey
      ? parseGardenCharacterPosition(window.localStorage.getItem(characterPositionStorageKey))
      : null;

    return {
      placedObjects: parseGardenPostPlacedObjects(storageValue),
      characterWorldPosition:
        storedCharacterWorldPosition ?? DEFAULT_PREVIEW_CHARACTER_WORLD_POSITION,
    };
  }, [userId]);

  const previewPlacedObjects = previewStorageSnapshot.placedObjects;
  const previewCharacterWorldPosition = previewStorageSnapshot.characterWorldPosition;

  const handlePreviewBackgroundError = () => {
    setPreviewBackgroundErrorState((current) => {
      const currentIndex = current.sceneKey === previewSceneKey ? current.index : 0;
      const lastIndex = Math.max(0, previewBackgroundCandidates.length - 1);
      const nextIndex = currentIndex < lastIndex ? currentIndex + 1 : currentIndex;

      return {
        sceneKey: previewSceneKey,
        index: nextIndex,
      };
    });
  };

  const handlePreviewBackgroundLoad = () => {
    setLoadedPreviewBackgroundState({ sceneKey: previewSceneKey, src: previewBackgroundSrc });
  };

  const handlePublish = async () => {
    if (!supabase) {
      setErrorMessage("Supabase設定が不足しています。環境変数を確認してください。");
      setStatus("error");
      return;
    }

    const currentSession = await getSupabaseSessionOrNull(supabase);
    const currentUser = currentSession?.user ?? null;

    if (!currentUser) {
      setErrorMessage("投稿にはログインが必要です。");
      setStatus("error");
      return;
    }

    if (isAnonymousSupabaseUser(currentUser)) {
      setErrorMessage("ゲスト利用中は投稿できません。データ引き継ぎログインを行ってください。");
      setStatus("error");
      return;
    }

    setStatus("publishing");
    setErrorMessage(null);
    setDeleteStatus("idle");
    setDeleteMessage(null);

    const placedObjectsStorageKey = getGardenObjectsStorageKeyForOwner(currentUser.id);
    const placedObjects = parseGardenPostPlacedObjects(
      window.localStorage.getItem(placedObjectsStorageKey) ??
      window.localStorage.getItem(GARDEN_OBJECTS_STORAGE_KEY_ME),
    );

    const recordingCatalog = parseVoiceZooRecordingCatalog(
      window.localStorage.getItem(getVoiceZooRecordingCatalogStorageKey(currentUser.id)),
    );
    const latestRecordingIdByObjectType = getLatestRecordingIdByObjectType(recordingCatalog);

    const uploadTargets = new Map<string, Blob>();
    const normalizedPlacedObjects = await Promise.all(
      placedObjects.map(async (placedObject) => {
        const resolvedRecordingId =
          placedObject.recordingId ?? latestRecordingIdByObjectType[placedObject.objectType] ?? null;

        if (!resolvedRecordingId) {
          return {
            ...placedObject,
            recordingId: null,
          };
        }

        const recordingBlob = await getIdbValue(
          getVoiceZooRecordingBlobStorageKey(currentUser.id, resolvedRecordingId),
        );
        if (recordingBlob instanceof Blob) {
          uploadTargets.set(resolvedRecordingId, recordingBlob);
        }

        return {
          ...placedObject,
          recordingId: resolvedRecordingId,
        };
      }),
    );

    const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB per file
    for (const [, blob] of uploadTargets.entries()) {
      if (blob.size > MAX_AUDIO_BYTES) {
        setStatus("error");
        setErrorMessage("録音ファイルのサイズが大きすぎます（上限10MB）。録音し直してください。");
        return;
      }
    }

    const recordingUrlById = new Map<string, string>();
    for (const [recordingId, blob] of uploadTargets.entries()) {
      const objectPath = `${currentUser.id}/${recordingId}.webm`;
      const uploadResult = await supabase.storage
        .from("garden-voices")
        .upload(objectPath, blob, {
          contentType: blob.type || "audio/webm",
          upsert: true,
        });

      if (uploadResult.error) {
        setStatus("error");
        setErrorMessage(
          `録音音声の投稿に失敗しました: ${uploadResult.error.message}。\nSupabaseに public bucket "garden-voices" を作成してください。`,
        );
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("garden-voices")
        .getPublicUrl(objectPath);
      if (publicUrlData.publicUrl) {
        recordingUrlById.set(recordingId, publicUrlData.publicUrl);
      }
    }

    const placedObjectsWithRecordingUrls = normalizedPlacedObjects.map((placedObject) => ({
      ...placedObject,
      recordingUrl: placedObject.recordingId
        ? (recordingUrlById.get(placedObject.recordingId) ?? undefined)
        : undefined,
    }));

    const ownerDisplayName = resolveOwnerDisplayNameFromUser({
      id: currentUser.id,
      email: currentUser.email,
      user_metadata: currentUser.user_metadata as Record<string, unknown> | undefined,
    });

    const { error } = await supabase.from("garden_posts").upsert(
      {
        user_id: currentUser.id,
        background_id: resolvedDraft.backgroundId,
        season_id: resolvedDraft.seasonId,
        time_slot_id: resolvedDraft.timeSlotId,
        allow_harmony_overlays: allowHarmonyOverlays,
        placed_objects: placedObjectsWithRecordingUrls,
        owner_display_name: ownerDisplayName,
        published_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      },
    );

    if (error) {
      setStatus("error");
      setErrorMessage(
        `投稿に失敗しました: ${error.message}。\nSupabaseに garden_posts テーブル、placed_objects / allow_harmony_overlays 列、RLSポリシーを作成してください。`,
      );
      return;
    }

    setStatus("success");
  };

  const handleDeletePost = async () => {
    if (!supabase) {
      setDeleteStatus("error");
      setDeleteMessage("Supabase設定が不足しています。環境変数を確認してください。");
      return;
    }

    const currentSession = await getSupabaseSessionOrNull(supabase);
    const currentUser = currentSession?.user ?? null;

    if (!currentUser) {
      setDeleteStatus("error");
      setDeleteMessage("投稿削除にはログインが必要です。");
      return;
    }

    if (isAnonymousSupabaseUser(currentUser)) {
      setDeleteStatus("error");
      setDeleteMessage("ゲスト利用中は投稿削除できません。通常ログイン後に操作してください。");
      return;
    }

    setDeleteStatus("deleting");
    setDeleteMessage(null);
    setStatus("idle");
    setErrorMessage(null);

    const { error } = await supabase.from("garden_posts").delete().eq("user_id", currentUser.id);

    if (error) {
      setDeleteStatus("error");
      setDeleteMessage(`投稿削除に失敗しました: ${error.message}`);
      return;
    }

    setDeleteStatus("success");
    setDeleteMessage("自分の庭投稿を削除しました。");
    setIsDeleteDialogOpen(false);
  };

  const handleRequestDelete = () => {
    if (!canDeletePost) {
      return;
    }

    setIsDeleteDialogOpen(true);
  };

  const handleCancelDelete = () => {
    if (deleteStatus === "deleting") {
      return;
    }
    setIsDeleteDialogOpen(false);
  };

  return (
    <>
      <main className="min-h-[100dvh] bg-[#FDFCF8] text-wa-black md:h-[100dvh] md:overflow-hidden">
        <div className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-8 sm:px-6 md:h-full md:grid-rows-[auto_1fr] md:gap-6 md:py-6">
          <header className="grid gap-2 text-center">
            <h1 className="font-serif text-3xl tracking-[0.12em] text-wa-black md:text-4xl">庭をお披露目する</h1>
            <p className="text-sm text-wa-black/70">あなたの作り上げた空間を、回廊に展示します。</p>
          </header>

          <section className="grid gap-6 md:min-h-0 md:grid-cols-2 md:items-start">
            <article className="grid gap-3 md:min-h-0">
              <p className="font-serif text-sm tracking-[0.08em] text-wa-black/70 md:hidden">庭のプレビュー</p>
              <div className="relative aspect-video overflow-hidden rounded-md border border-wa-black/10 bg-wa-white shadow-[0_10px_24px_rgba(42,42,42,0.08)] md:h-[min(54vh,420px)] md:aspect-auto">
                <Image
                  src={previewBackgroundSrc}
                  alt="現在の庭プレビュー"
                  fill
                  unoptimized
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="select-none object-cover"
                  onLoad={handlePreviewBackgroundLoad}
                  onError={handlePreviewBackgroundError}
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
                    transform={`translate(${clamp(previewCharacterWorldPosition.x, 0, WORLD_WIDTH)} ${clamp(previewCharacterWorldPosition.y, 0, WORLD_HEIGHT)})`}
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

                  {previewPlacedObjects.map((placedObject) => {
                    const objectVisual = OBJECT_VISUALS[placedObject.objectType];
                    const halfImageSize = objectVisual.stageImageSize * 0.5;
                    const worldX = clamp(placedObject.x, 0, WORLD_WIDTH);
                    const worldY = clamp(placedObject.y, 0, WORLD_HEIGHT);

                    return (
                      <g key={placedObject.id} transform={`translate(${worldX} ${worldY})`}>
                        <circle
                          cx="0"
                          cy="0"
                          r={Math.max(18, halfImageSize * 0.85)}
                          fill={isNightScene ? "rgba(255,255,255,0.16)" : "rgba(17,17,17,0.12)"}
                        />
                        <image
                          href={objectVisual.imageSrc}
                          x={-halfImageSize}
                          y={-halfImageSize}
                          width={objectVisual.stageImageSize}
                          height={objectVisual.stageImageSize}
                          preserveAspectRatio="xMidYMid slice"
                        />
                        <rect
                          x="-36"
                          y={halfImageSize + 3}
                          width="72"
                          height="20"
                          rx="10"
                          fill={objectChipFillColor}
                          stroke={objectChipStrokeColor}
                        />
                        <text
                          x="0"
                          y={halfImageSize + 14}
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

                <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-full border border-white/45 bg-wa-black/45 px-3 py-1 text-xs tracking-[0.05em] text-white backdrop-blur-sm">
                  オブジェクト {previewPlacedObjects.length}個
                </div>

                {previewPlacedObjects.length === 0 ? (
                  <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
                    <p className="rounded-full border border-white/45 bg-wa-black/50 px-3 py-1 text-xs text-white/95 backdrop-blur-sm">
                      まだ音オブジェクトは置かれていません
                    </p>
                  </div>
                ) : null}

                {isPreviewBackgroundLoading ? (
                  <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-wa-black/25 backdrop-blur-[2px]">
                    <p className="rounded-full border border-white/40 bg-wa-black/55 px-3 py-1 text-xs tracking-[0.08em] text-white/95 animate-pulse">
                      情景を読み込み中...
                    </p>
                  </div>
                ) : null}

                <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap gap-2 text-[11px] text-wa-black/90 sm:text-xs">
                  <span className="rounded-full border border-wa-black/10 bg-white/65 px-3 py-1 backdrop-blur-sm">
                    {draftBackgroundName}-{draftSeasonName}
                  </span>
                  <span className="rounded-full border border-wa-black/10 bg-white/65 px-3 py-1 backdrop-blur-sm">
                    {draftSeasonName}
                  </span>
                  <span className="rounded-full border border-wa-black/10 bg-white/65 px-3 py-1 backdrop-blur-sm">
                    {draftTimeSlotName}
                  </span>
                </div>
              </div>

              <div className="grid gap-2 md:hidden">
                {!isGuestUser ? (
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={!canPublish}
                    className="relative z-10 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#2B2B2B] bg-[#2B2B2B] px-5 py-2.5 font-serif text-sm text-white shadow-[0_8px_20px_rgba(43,43,43,0.22)] transition-all duration-150 hover:bg-[#232323] active:translate-y-[1px] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {status === "publishing" ? (
                      <>
                        公開しています...
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      </>
                    ) : (
                      <>
                        <SendHorizontal className="h-4 w-4" aria-hidden />
                        この庭を公開する
                      </>
                    )}
                  </button>
                ) : (
                  <Link
                    href="/?login=1"
                    className="inline-flex w-full items-center justify-center rounded-full border border-indigo-900/60 bg-indigo-50 px-5 py-2.5 text-sm text-indigo-950"
                  >
                    ログインして公開する
                  </Link>
                )}

                <div className="flex items-center justify-center gap-5 text-sm text-wa-black/70">
                  <Link href="/garden" className="underline-offset-4 transition-colors hover:text-wa-black hover:underline">
                    回廊へ向かう
                  </Link>
                  <Link href="/?login=1" className="underline-offset-4 transition-colors hover:text-wa-black hover:underline">
                    トップへ戻る
                  </Link>
                </div>
              </div>

              <div className="hidden items-center justify-center gap-5 border-t border-wa-black/10 pt-3 text-sm text-wa-black/70 md:flex">
                <Link href="/garden" className="underline-offset-4 transition-colors hover:text-wa-black hover:underline">
                  回廊へ向かう
                </Link>
                <Link href="/?login=1" className="underline-offset-4 transition-colors hover:text-wa-black hover:underline">
                  トップへ戻る
                </Link>
              </div>
            </article>

            <article className="grid gap-4 rounded-2xl border border-wa-black/10 bg-white/65 p-4 text-center shadow-[0_10px_20px_rgba(42,42,42,0.05)] backdrop-blur-[1px] md:max-h-[min(68vh,520px)] md:overflow-y-auto md:p-5">
              <div className="grid gap-3 border-b border-wa-black/10 pb-4">
                <p className="font-serif text-lg tracking-[0.08em] text-wa-black">公開の準備</p>
                <p className="text-sm leading-relaxed text-wa-black/75">
                  庭の背景・季節・時間帯を確認し、整ったら回廊へ公開できます。公開後は、
                  あなたの庭ページとして訪れた人に見てもらえます。
                </p>
              </div>

              {isGuestUser ? (
                <section className="grid justify-items-center gap-3 rounded-xl border border-indigo-300/60 bg-indigo-50/80 p-4 text-sm">
                  <p className="font-serif text-base text-indigo-950">回廊に飾るには、旅の記録（ログイン）が必要です</p>
                  <p className="text-indigo-900/80">ゲストの庭はそのまま引き継げます。トップページから旅の記録を残してください。</p>
                  <Link
                    href="/?login=1"
                    className="group inline-flex w-fit items-center gap-2 rounded-full border border-indigo-900/60 px-5 py-2 text-indigo-950 transition-all duration-150 hover:-translate-y-1 hover:bg-indigo-100/70 active:translate-y-[1px] active:scale-[0.98]"
                  >
                    トップページへ
                    <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </section>
              ) : (
                <section className="grid justify-items-center gap-3 text-sm">
                  <p className="text-xs text-wa-black/60">※公開した庭は回廊に展示され、3日間経過すると自然に消えゆきます。</p>

                  <div className="w-full rounded-xl border border-wa-black/10 bg-wa-white/85 p-3 text-left">
                    <p className="text-xs font-semibold tracking-[0.04em] text-wa-black/80">
                      ハーモニー受付
                    </p>
                    <label className="mt-2 flex items-center gap-2 text-sm text-wa-black/85">
                      <input
                        type="checkbox"
                        checked={allowHarmonyOverlays}
                        disabled={status === "publishing"}
                        onChange={(event) => {
                          setAllowHarmonyOverlays(event.target.checked);
                        }}
                        className="h-4 w-4 rounded border-wa-black/30 text-wa-black focus:ring-wa-black"
                      />
                      ほかの人がこの庭にハーモニーを重ねられるようにする
                    </label>
                    <p className="mt-2 text-xs text-wa-black/65">
                      {allowHarmonyOverlays
                        ? "ON: 訪問者はオブジェクトをタップして、3秒のハーモニーを追加できます。"
                        : "OFF: 訪問者はハーモニーを追加できません。"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={!canPublish}
                    className="group relative z-10 hidden w-full items-center justify-center gap-2 rounded-full border border-[#2B2B2B] bg-[#2B2B2B] px-6 py-3 font-serif text-base text-white shadow-[0_10px_24px_rgba(43,43,43,0.24)] transition-all duration-150 hover:-translate-y-1 hover:bg-[#232323] active:translate-y-[1px] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 md:inline-flex"
                  >
                    {status === "publishing" ? (
                      <>
                        公開しています...
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      </>
                    ) : (
                      <>
                        <SendHorizontal className="h-4 w-4" aria-hidden />
                        この庭を公開する
                        <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" aria-hidden />
                      </>
                    )}
                  </button>

                  <Link
                    href="/garden/empty"
                    className="group hidden w-full items-center justify-center gap-2 rounded-full border border-wa-black/30 bg-transparent px-6 py-3 text-sm text-wa-black/80 transition-all duration-150 hover:-translate-y-1 hover:border-wa-black/60 hover:bg-wa-black/5 hover:text-wa-black active:translate-y-[1px] active:scale-[0.99] md:inline-flex"
                  >
                    庭の手入れに戻る
                    <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" aria-hidden />
                  </Link>

                  <div className="mt-2 w-full rounded-xl border border-[#A64A3B]/30 bg-[#A64A3B]/5 p-3 text-left">
                    <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.04em] text-[#8B3A2A]">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                      公開の取り下げ
                    </p>
                    <p className="mt-1 text-xs text-wa-black/65">
                      回廊に展示中の庭を取り下げます。必要なときに再公開できます。
                    </p>
                    <button
                      type="button"
                      onClick={handleRequestDelete}
                      disabled={!canDeletePost}
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#A64A3B]/65 bg-white/85 px-4 py-2 text-sm text-[#8B3A2A] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#A64A3B]/10 active:translate-y-[1px] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      公開中の庭を取り下げる
                    </button>
                  </div>

                  {!userId && !isAuthLoading ? (
                    <p className="text-sm text-wa-red">公開にはログインが必要です。トップページからログインしてください。</p>
                  ) : null}
                </section>
              )}

              {status === "success" && userId ? (
                <p className="text-sm text-emerald-700">
                  公開しました。URL: <Link href={`/garden/${userId}`} className="underline">/garden/{userId}</Link>
                </p>
              ) : null}

              {status === "error" && errorMessage ? (
                <p className="whitespace-pre-wrap text-sm text-wa-red">{errorMessage}</p>
              ) : null}

              {deleteMessage ? (
                <p className={deleteStatus === "success" ? "text-sm text-emerald-700" : "text-sm text-wa-red"}>{deleteMessage}</p>
              ) : null}
            </article>
          </section>

        </div>
      </main>

      {isDeleteDialogOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-wa-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-wa-black/10 bg-[#FDFCF8] p-6 shadow-2xl">
            <p className="font-serif text-lg text-wa-black">公開中の庭を回廊から取り下げますか？</p>
            <p className="mt-2 text-sm text-wa-black/70">この操作はあとで再公開できます。</p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelDelete}
                disabled={deleteStatus === "deleting"}
                className="rounded-md border border-wa-black/20 px-4 py-2 text-sm text-wa-black transition-colors hover:bg-wa-black/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                やめる
              </button>
              <button
                type="button"
                onClick={handleDeletePost}
                disabled={deleteStatus === "deleting"}
                className="inline-flex items-center gap-2 rounded-md border border-[#A64A3B] px-4 py-2 text-sm text-[#A64A3B] transition-colors hover:bg-[#A64A3B]/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteStatus === "deleting" ? (
                  <>
                    取り下げ中...
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#A64A3B]/30 border-t-[#A64A3B]" aria-hidden />
                  </>
                ) : (
                  "取り下げる"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function GardenPublishPage() {
  return (
    <Suspense>
      <GardenPublishContent />
    </Suspense>
  );
}
