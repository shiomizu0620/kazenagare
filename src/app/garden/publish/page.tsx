"use client";

import { get as getIdbValue } from "idb-keyval";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseClient, getSupabaseSessionOrNull } from "@/lib/supabase/client";
import {
  GARDEN_OBJECTS_STORAGE_KEY_ME,
  getGardenObjectsStorageKeyForOwner,
} from "@/lib/garden/placed-objects-storage";
import { parseGardenPostPlacedObjects } from "@/lib/garden/posts";
import { isAnonymousSupabaseUser } from "@/lib/auth/user";
import {
  createGardenLocalStateStorageKey,
  getDefaultGardenLocalState,
  parseGardenLocalState,
  type GardenLocalState,
} from "@/lib/garden/local-state";
import { GARDEN_BACKGROUNDS, GARDEN_SEASONS, GARDEN_TIME_SLOTS } from "@/lib/garden/setup/options";
import {
  getLatestRecordingIdByObjectType,
  getVoiceZooRecordingBlobStorageKey,
  getVoiceZooRecordingCatalogStorageKey,
  parseVoiceZooRecordingCatalog,
} from "@/lib/voice-zoo/recordings";

type PublishStatus = "idle" | "publishing" | "success" | "error";

function normalizeOptionId(value: string | null, fallback: string, options: { id: string }[]) {
  if (!value) {
    return fallback;
  }

  return options.some((option) => option.id === value) ? value : fallback;
}

function GardenPublishContent() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const searchParams = useSearchParams();
  const [isAuthLoading, setIsAuthLoading] = useState(Boolean(supabase));
  const [isGuestUser, setIsGuestUser] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<PublishStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(
    supabase ? null : "Supabase設定が不足しています。環境変数を確認してください。",
  );

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

    const syncAuthState = async () => {
      const currentSession = await getSupabaseSessionOrNull(supabase);
      if (isCancelled) {
        return;
      }

      const currentUser = currentSession?.user ?? null;
      setUserId(currentUser?.id ?? null);
      setIsGuestUser(isAnonymousSupabaseUser(currentUser));
      setIsAuthLoading(false);

      if (!currentUser) {
        return;
      }

      const localState = parseGardenLocalState(
        window.localStorage.getItem(createGardenLocalStateStorageKey(currentUser.id)),
      );

      if (localState) {
        setDraft(localState);
      }
    };

    void syncAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUserId(currentUser?.id ?? null);
      setIsGuestUser(isAnonymousSupabaseUser(currentUser));
      setIsAuthLoading(false);

      if (!currentUser) {
        setDraft(defaultState);
        return;
      }

      const localState = parseGardenLocalState(
        window.localStorage.getItem(createGardenLocalStateStorageKey(currentUser.id)),
      );
      if (localState) {
        setDraft(localState);
      }
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

  const canPublish = useMemo(
    () => Boolean(userId) && !isGuestUser && !isAuthLoading && status !== "publishing",
    [isAuthLoading, isGuestUser, status, userId],
  );

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

    const { error } = await supabase.from("garden_posts").upsert(
      {
        user_id: currentUser.id,
        background_id: resolvedDraft.backgroundId,
        season_id: resolvedDraft.seasonId,
        time_slot_id: resolvedDraft.timeSlotId,
        placed_objects: placedObjectsWithRecordingUrls,
        published_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      },
    );

    if (error) {
      setStatus("error");
      setErrorMessage(
        `投稿に失敗しました: ${error.message}。\nSupabaseに garden_posts テーブル、placed_objects 列、RLSポリシーを作成してください。`,
      );
      return;
    }

    setStatus("success");
  };

  return (
    <main className="mx-auto grid min-h-[100dvh] w-full max-w-3xl gap-6 px-4 py-8 text-wa-black sm:px-6">
      <section className="grid gap-3 rounded-2xl border border-wa-black/20 bg-wa-white/90 p-5">
        <h1 className="text-2xl font-semibold">庭を投稿する</h1>
        <p className="text-sm text-wa-black/75">
          現在の庭設定をサーバーに保存して、`/garden/[userId]` で他の人に見せられるようにします。
        </p>
      </section>

      <section className="grid gap-3 rounded-2xl border border-wa-black/20 bg-white/80 p-5 text-sm">
        <p className="font-semibold">投稿予定の設定</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-wa-black/20 px-3 py-1">背景: {draftBackgroundName}</span>
          <span className="rounded-full border border-wa-black/20 px-3 py-1">季節: {draftSeasonName}</span>
          <span className="rounded-full border border-wa-black/20 px-3 py-1">時間帯: {draftTimeSlotName}</span>
        </div>
      </section>

      {isGuestUser ? (
        <section className="grid gap-2 rounded-2xl border border-amber-700/40 bg-amber-50 p-5 text-sm">
          <p className="font-semibold text-amber-900">ゲスト利用中は投稿できません</p>
          <p className="text-amber-800">
            サーバー負荷対策のため、投稿は通常ログインのみ対応です。ログインすると現在のゲストデータを引き継げます。
          </p>
          <Link
            href="/?login=1"
            className="inline-flex w-fit rounded-full border border-amber-900 px-4 py-2 font-semibold text-amber-900 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-amber-100 active:translate-y-[1px] active:scale-[0.98]"
          >
            トップでログインする
          </Link>
        </section>
      ) : null}

      {!isGuestUser ? (
        <section className="grid gap-3 rounded-2xl border border-wa-black/20 bg-white/80 p-5 text-sm">
          <button
            type="button"
            onClick={handlePublish}
            disabled={!canPublish}
            className="inline-flex w-fit items-center rounded-full border-2 border-wa-black bg-wa-black px-5 py-2 font-semibold text-wa-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-wa-red active:translate-y-[1px] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "publishing" ? "投稿中..." : "この庭を投稿する"}
          </button>

          {status === "success" && userId ? (
            <p className="text-emerald-700">
              投稿しました。公開URL: <Link href={`/garden/${userId}`} className="underline">/garden/{userId}</Link>
            </p>
          ) : null}

          {status === "error" && errorMessage ? (
            <p className="whitespace-pre-wrap text-wa-red">{errorMessage}</p>
          ) : null}

          {!userId && !isAuthLoading ? (
            <p className="text-wa-red">投稿にはログインが必要です。トップページからログインしてください。</p>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/?login=1"
          className="rounded-md border border-wa-black px-4 py-2 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-wa-red/10 active:translate-y-[1px] active:scale-[0.98]"
        >
          トップへ戻る
        </Link>
        <Link
          href="/garden/empty"
          className="rounded-md border border-wa-black px-4 py-2 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-wa-red/10 active:translate-y-[1px] active:scale-[0.98]"
        >
          自分の庭に戻る
        </Link>
        <Link
          href="/garden"
          className="rounded-md border border-wa-black px-4 py-2 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-wa-red/10 active:translate-y-[1px] active:scale-[0.98]"
        >
          庭一覧へ
        </Link>
      </div>
    </main>
  );
}

export default function GardenPublishPage() {
  return (
    <Suspense>
      <GardenPublishContent />
    </Suspense>
  );
}
