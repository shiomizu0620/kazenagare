"use client";

import { get as getIdbValue, keys as getIdbKeys, set as setIdbValue } from "idb-keyval";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  createGardenLocalStateStorageKey,
  parseGardenLocalState,
} from "@/lib/garden/local-state";
import { isAnonymousSupabaseUser } from "@/lib/auth/user";

const GARDEN_SETUP_PATH = "/garden/setup";
const EMPTY_GARDEN_PATH = "/garden/empty";
const OAUTH_REDIRECT_PENDING_KEY = "kazenagare.oauthRedirectPending";
const OAUTH_PENDING_GUEST_USER_ID_KEY = "kazenagare.oauthPendingGuestUserId";
const LEGACY_LOCAL_GUEST_USER_ID = "local_guest";
const AUDIO_CATALOG_STORAGE_PREFIX = "kazenagare_audio_catalog_";
const AUDIO_BLOB_STORAGE_PREFIX = "kazenagare_audio_blob_";

function replaceOwnerInStorageKey(storageKey: string, previousOwnerId: string, nextOwnerId: string) {
  if (!storageKey.includes(previousOwnerId)) {
    return null;
  }

  if (storageKey.startsWith(AUDIO_BLOB_STORAGE_PREFIX)) {
    return storageKey.replace(`_${previousOwnerId}_`, `_${nextOwnerId}_`);
  }

  return storageKey.replace(previousOwnerId, nextOwnerId);
}

async function migrateGuestDataToUser(previousOwnerId: string, nextOwnerId: string) {
  if (!previousOwnerId || !nextOwnerId || previousOwnerId === nextOwnerId) {
    return;
  }

  const previousGardenKey = createGardenLocalStateStorageKey(previousOwnerId);
  const nextGardenKey = createGardenLocalStateStorageKey(nextOwnerId);
  const previousGardenData = window.localStorage.getItem(previousGardenKey);
  const nextGardenData = window.localStorage.getItem(nextGardenKey);

  if (previousGardenData && !nextGardenData) {
    window.localStorage.setItem(nextGardenKey, previousGardenData);
  }

  const previousAudioCatalogKey = `${AUDIO_CATALOG_STORAGE_PREFIX}${previousOwnerId}`;
  const nextAudioCatalogKey = `${AUDIO_CATALOG_STORAGE_PREFIX}${nextOwnerId}`;
  const previousAudioCatalog = window.localStorage.getItem(previousAudioCatalogKey);
  const nextAudioCatalog = window.localStorage.getItem(nextAudioCatalogKey);

  if (previousAudioCatalog && !nextAudioCatalog) {
    window.localStorage.setItem(nextAudioCatalogKey, previousAudioCatalog);
  }

  const idbKeys = await getIdbKeys();
  for (const idbKey of idbKeys) {
    if (typeof idbKey !== "string") {
      continue;
    }

    if (
      !idbKey.startsWith(AUDIO_BLOB_STORAGE_PREFIX) &&
      !idbKey.startsWith(`kazenagare_audio_${previousOwnerId}_`)
    ) {
      continue;
    }

    const nextIdbKey = replaceOwnerInStorageKey(idbKey, previousOwnerId, nextOwnerId);
    if (!nextIdbKey) {
      continue;
    }

    const [previousBlob, existingNextBlob] = await Promise.all([
      getIdbValue(idbKey),
      getIdbValue(nextIdbKey),
    ]);
    if (!(previousBlob instanceof Blob) || existingNextBlob instanceof Blob) {
      continue;
    }

    await setIdbValue(nextIdbKey, previousBlob);
  }
}

export function AuthSection() {
  const router = useRouter();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const hasNavigatedRef = useRef(false);

  const migratePendingGuestData = useCallback(async (nextUserId?: string | null) => {
    if (!nextUserId) {
      return;
    }

    const pendingGuestId = window.sessionStorage.getItem(OAUTH_PENDING_GUEST_USER_ID_KEY);
    if (pendingGuestId) {
      await migrateGuestDataToUser(pendingGuestId, nextUserId);
      window.sessionStorage.removeItem(OAUTH_PENDING_GUEST_USER_ID_KEY);
    }

    await migrateGuestDataToUser(LEGACY_LOCAL_GUEST_USER_ID, nextUserId);
  }, []);

  const cacheCurrentGuestIdForTransfer = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }

    const { data } = await supabase.auth.getSession();
    if (isAnonymousSupabaseUser(data.session?.user)) {
      window.sessionStorage.setItem(
        OAUTH_PENDING_GUEST_USER_ID_KEY,
        data.session?.user.id ?? LEGACY_LOCAL_GUEST_USER_ID,
      );
      return;
    }

    const legacyGuestState = parseGardenLocalState(
      window.localStorage.getItem(createGardenLocalStateStorageKey(LEGACY_LOCAL_GUEST_USER_ID)),
    );

    if (legacyGuestState) {
      window.sessionStorage.setItem(
        OAUTH_PENDING_GUEST_USER_ID_KEY,
        LEGACY_LOCAL_GUEST_USER_ID,
      );
      return;
    }

    window.sessionStorage.removeItem(OAUTH_PENDING_GUEST_USER_ID_KEY);
  }, []);

  const navigateAfterAuth = useCallback(async (nextUserId?: string | null) => {
    if (hasNavigatedRef.current) {
      return;
    }

    hasNavigatedRef.current = true;

    if (nextUserId) {
      // 1. ローカルストレージから復元（同じデバイスなら高速）
      const localState = parseGardenLocalState(
        window.localStorage.getItem(createGardenLocalStateStorageKey(nextUserId)),
      );

      if (localState) {
        const params = new URLSearchParams({
          background: localState.backgroundId,
          season: localState.seasonId,
          time: localState.timeSlotId,
        });
        router.push(`${EMPTY_GARDEN_PATH}?${params.toString()}`);
        return;
      }

      // 2. DBから復元（別デバイスなどローカルに無い場合）
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data } = await supabase
          .from("garden_posts")
          .select("background_id,season_id,time_slot_id")
          .eq("user_id", nextUserId)
          .maybeSingle();

        if (data?.background_id && data?.season_id && data?.time_slot_id) {
          const params = new URLSearchParams({
            background: data.background_id as string,
            season: data.season_id as string,
            time: data.time_slot_id as string,
          });
          router.push(`${EMPTY_GARDEN_PATH}?${params.toString()}`);
          return;
        }
      }
    }

    router.push(GARDEN_SETUP_PATH);
  }, [router]);

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

    void supabase.auth.getSession().then(({ data }) => {
      if (!hasPendingOAuthRedirect()) {
        return;
      }

      if (data.session) {
        void migratePendingGuestData(data.session.user.id).finally(() => {
          clearPendingOAuthRedirect();
          void navigateAfterAuth(data.session.user.id);
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session && hasPendingOAuthRedirect()) {
        void migratePendingGuestData(session.user.id).finally(() => {
          clearPendingOAuthRedirect();
          void navigateAfterAuth(session.user.id);
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [migratePendingGuestData, navigateAfterAuth]);

  // ゲストログイン
  const handleGuestLogin = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      alert("Supabase設定が見つかりません。");
      return;
    }

    setIsLoggingIn(true);

    try {
      const { data: currentSessionData } = await supabase.auth.getSession();
      if (currentSessionData.session && !isAnonymousSupabaseUser(currentSessionData.session.user)) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          alert("ログアウトに失敗しました: " + signOutError.message);
          return;
        }
      }

      window.sessionStorage.removeItem(OAUTH_PENDING_GUEST_USER_ID_KEY);
      const { data, error } = await supabase.auth.signInAnonymously();

      if (error) {
        alert("エラー: " + error.message);
        return;
      }

      void navigateAfterAuth(data.user?.id);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // SNSログイン（Google / X）
  const handleOAuthLogin = async (provider: 'google' | 'twitter') => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      alert("Supabase設定が見つかりません。");
      return;
    }

    setIsLoggingIn(true);

    await cacheCurrentGuestIdForTransfer();

    window.sessionStorage.setItem(OAUTH_REDIRECT_PENDING_KEY, "1");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: { redirectTo: window.location.origin }
    });

    if (error) {
      window.sessionStorage.removeItem(OAUTH_REDIRECT_PENDING_KEY);
      alert("エラー: " + error.message);
      setIsLoggingIn(false);
    }
  };

  // メアドでログイン・新規登録
  const handleEmailAuth = async (isSignUp: boolean) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      alert("Supabase設定が見つかりません。");
      return;
    }

    if (!email || !password) {
      alert("メールアドレスとパスワードを入力してください");
      return;
    }

    setIsLoggingIn(true);

    try {
      await cacheCurrentGuestIdForTransfer();

      let authError;
      let shouldNavigate = false;
      let nextUserId: string | null = null;

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        authError = error;
        shouldNavigate = Boolean(data.session);
        nextUserId = data.user?.id ?? data.session?.user.id ?? null;
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        authError = error;
        shouldNavigate = !error;
        nextUserId = data.user?.id ?? data.session?.user.id ?? null;
      }

      if (authError) {
        alert("エラー: " + authError.message);
        return;
      }

      if (shouldNavigate) {
        await migratePendingGuestData(nextUserId);
        await navigateAfterAuth(nextUserId);
        return;
      }

      if (isSignUp) {
        alert("登録完了しました。確認メールをご確認ください。");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* メアドログインフォーム */}
      <div className="flex flex-col gap-2 p-4 border border-gray-300 rounded-md bg-gray-50">
        <p className="text-sm font-bold">メールアドレスでログイン / 登録</p>
        <input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 rounded-md text-sm"
        />
        <input
          type="password"
          placeholder="パスワード (6文字以上)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 rounded-md text-sm"
        />
        <div className="flex gap-2">
          <button
            onClick={() => handleEmailAuth(false)}
            disabled={isLoggingIn}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm flex-1 hover:bg-blue-700 disabled:opacity-50"
          >
            ログイン
          </button>
          <button
            onClick={() => handleEmailAuth(true)}
            disabled={isLoggingIn}
            className="bg-green-600 text-white px-4 py-2 rounded-md text-sm flex-1 hover:bg-green-700 disabled:opacity-50"
          >
            新規登録
          </button>
        </div>
      </div>

      {/* SNS & ゲストボタングループ */}
      <div className="flex flex-wrap w-full gap-3">
        <button
          onClick={handleGuestLogin}
          disabled={isLoggingIn}
          className="rounded-md bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 text-sm disabled:opacity-50 flex-1"
        >
          ゲスト体験
        </button>
        <button
          onClick={() => handleOAuthLogin('google')}
          disabled={isLoggingIn}
          className="rounded-md border border-gray-400 bg-white px-4 py-2 text-sm disabled:opacity-50 flex-1"
        >
          Google
        </button>
        <button
          onClick={() => handleOAuthLogin('twitter')}
          disabled={isLoggingIn}
          className="rounded-md bg-black text-white px-4 py-2 text-sm disabled:opacity-50 flex-1"
        >
          X (Twitter)
        </button>
      </div>
    </div>
  );
}