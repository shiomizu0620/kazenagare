"use client";

import { get as getIdbValue, keys as getIdbKeys, set as setIdbValue } from "idb-keyval";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient, getSupabaseSessionOrNull } from "@/lib/supabase/client";
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
type OAuthProvider = "google" | "x" | "twitter";

type AuthCompletedPayload = {
  userId: string | null;
  isAnonymous: boolean;
};

type AuthSectionProps = {
  disableAutoNavigation?: boolean;
  onAuthCompleted?: (payload: AuthCompletedPayload) => void | Promise<void>;
  variant?: "default" | "mist";
  showGuestLogin?: boolean;
  autoFocusEmail?: boolean;
};

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

function resolveAuthErrorMessage(rawMessage: string, isSignUp: boolean) {
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "メールアドレスまたはパスワードが正しくありません。Google / X で登録したアカウントはSNSログインを利用してください。";
  }

  if (normalized.includes("email not confirmed")) {
    return "メール認証が完了していません。確認メール内のリンクを開いてからログインしてください。";
  }

  if (normalized.includes("user already registered")) {
    return "このメールアドレスはすでに登録されています。ログインをお試しください。";
  }

  if (normalized.includes("password should be at least")) {
    return "パスワードは6文字以上で入力してください。";
  }

  if (isSignUp && normalized.includes("signup is disabled")) {
    return "現在、新規登録を受け付けていません。";
  }

  return rawMessage;
}

function resolveOAuthErrorMessage(rawMessage: string, provider: OAuthProvider) {
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes("unsupported provider") || normalized.includes("provider is not enabled")) {
    if (provider === "twitter" || provider === "x") {
      return "Xログインが無効です。Supabaseダッシュボードの Auth > Providers で X (Twitter) を有効化し、Client ID / Secret を設定してください。";
    }

    return "このSNSログインは現在無効です。Supabaseダッシュボードの Auth > Providers で有効化してください。";
  }

  return rawMessage;
}

export function AuthSection({
  disableAutoNavigation = false,
  onAuthCompleted,
  variant = "default",
  showGuestLogin = true,
  autoFocusEmail = false,
}: AuthSectionProps) {
  const router = useRouter();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const hasNavigatedRef = useRef(false);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const isMistVariant = variant === "mist";

  useEffect(() => {
    if (!autoFocusEmail) {
      return;
    }

    const focusTimerId = window.setTimeout(() => {
      emailInputRef.current?.focus();
      emailInputRef.current?.select();
    }, 0);

    return () => {
      window.clearTimeout(focusTimerId);
    };
  }, [autoFocusEmail]);

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

    const currentSession = await getSupabaseSessionOrNull(supabase);
    if (isAnonymousSupabaseUser(currentSession?.user)) {
      window.sessionStorage.setItem(
        OAUTH_PENDING_GUEST_USER_ID_KEY,
        currentSession?.user.id ?? LEGACY_LOCAL_GUEST_USER_ID,
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

    const supabase = getSupabaseClient();

    if (nextUserId) {
      // 0. display_name をチェック（なければ季節設定画面で入力）
      if (supabase) {
        const session = await getSupabaseSessionOrNull(supabase);
        const user = session?.user;
        if (user) {
          const userMetadata = user.user_metadata as Record<string, unknown> | undefined;
          const displayName = userMetadata?.display_name;
          
          if (!displayName || typeof displayName !== "string" || !displayName.trim()) {
            router.push("/garden/setup");
            return;
          }
        }
      }

      // 1. DBから復元（アカウント単位データを優先）
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

      // 2. ローカルストレージから復元（DB未保存時のフォールバック）
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
    }

    router.push(GARDEN_SETUP_PATH);
  }, [router]);

  const handleAuthCompleted = useCallback(
    async ({
      userId,
      isAnonymous,
    }: AuthCompletedPayload) => {
      await onAuthCompleted?.({ userId, isAnonymous });

      if (!disableAutoNavigation || isAnonymous) {
        await navigateAfterAuth(userId);
      }
    },
    [disableAutoNavigation, navigateAfterAuth, onAuthCompleted],
  );

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
        hasPendingOAuthRedirect()
      ) {
        void migratePendingGuestData(session.user.id).finally(() => {
          clearPendingOAuthRedirect();
          void handleAuthCompleted({
            userId: session.user.id,
            isAnonymous: isAnonymousSupabaseUser(session.user),
          });
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [handleAuthCompleted, migratePendingGuestData]);

  // ゲストログイン
  const handleGuestLogin = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      alert("Supabase設定が見つかりません。");
      return;
    }

    setIsLoggingIn(true);

    try {
      const currentSession = await getSupabaseSessionOrNull(supabase);
      if (currentSession && !isAnonymousSupabaseUser(currentSession.user)) {
        const { error: signOutError } = await supabase.auth.signOut({
          scope: "local",
        });
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

      void handleAuthCompleted({
        userId: data.user?.id ?? null,
        isAnonymous: true,
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  // SNSログイン（Google / X）
  const handleOAuthLogin = async (provider: OAuthProvider) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      alert("Supabase設定が見つかりません。");
      return;
    }

    setIsLoggingIn(true);

    await cacheCurrentGuestIdForTransfer();

    window.sessionStorage.setItem(OAUTH_REDIRECT_PENDING_KEY, "1");

    let { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        // Return to the current page so pending OAuth state can be consumed reliably.
        redirectTo: window.location.href,
      },
    });

    const oauthErrorMessage = error?.message?.toLowerCase() ?? "";
    const shouldRetryWithLegacyTwitter =
      provider === "x" &&
      Boolean(error) &&
      (oauthErrorMessage.includes("unsupported provider") ||
        oauthErrorMessage.includes("provider is not enabled"));

    if (shouldRetryWithLegacyTwitter) {
      const retryResult = await supabase.auth.signInWithOAuth({
        provider: "twitter",
        options: {
          redirectTo: window.location.href,
        },
      });
      error = retryResult.error;
    }

    if (error) {
      window.sessionStorage.removeItem(OAUTH_REDIRECT_PENDING_KEY);
      const resolvedMessage = resolveOAuthErrorMessage(error.message, provider);
      alert("エラー: " + resolvedMessage);
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

    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
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
        const { data, error } = await supabase.auth.signUp({ email: normalizedEmail, password });
        authError = error;
        shouldNavigate = Boolean(data.session);
        nextUserId = data.user?.id ?? data.session?.user.id ?? null;
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        authError = error;
        shouldNavigate = !error;
        nextUserId = data.user?.id ?? data.session?.user.id ?? null;
      }

      if (authError) {
        const actionLabel = isSignUp ? "新規登録" : "ログイン";
        const resolvedMessage = resolveAuthErrorMessage(authError.message, isSignUp);
        alert(`${actionLabel}に失敗しました。\n${resolvedMessage}`);
        return;
      }

      if (shouldNavigate) {
        await migratePendingGuestData(nextUserId);
        await handleAuthCompleted({
          userId: nextUserId,
          isAnonymous: false,
        });
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
      <div
        className={
          isMistVariant
            ? "flex flex-col gap-2 rounded-2xl border border-white/30 bg-white/15 p-4 shadow-[0_18px_46px_rgba(0,0,0,0.24)] backdrop-blur-xl"
            : "flex flex-col gap-2 rounded-md border border-gray-300 bg-gray-50 p-4"
        }
      >
        <p className={`text-sm font-bold ${isMistVariant ? "text-white" : ""}`}>
          メールアドレスでログイン / 登録
        </p>
        <input
          ref={emailInputRef}
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus={autoFocusEmail}
          className={
            isMistVariant
              ? "rounded-md border border-white/55 bg-white/90 p-2 text-sm text-wa-black placeholder:text-wa-black/50"
              : "rounded-md border p-2 text-sm"
          }
        />
        <input
          type="password"
          placeholder="パスワード (6文字以上)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={
            isMistVariant
              ? "rounded-md border border-white/55 bg-white/90 p-2 text-sm text-wa-black placeholder:text-wa-black/50"
              : "rounded-md border p-2 text-sm"
          }
        />
        <div className="flex gap-2">
          <button
            onClick={() => handleEmailAuth(false)}
            disabled={isLoggingIn}
            className={
              isMistVariant
                ? "flex-1 rounded-md border border-sky-200/40 bg-sky-700 px-4 py-2 text-sm text-white shadow-sm transition-colors hover:bg-sky-800 disabled:opacity-50"
                : "flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            }
          >
            ログイン
          </button>
          <button
            onClick={() => handleEmailAuth(true)}
            disabled={isLoggingIn}
            className={
              isMistVariant
                ? "flex-1 rounded-md border border-emerald-200/40 bg-emerald-700 px-4 py-2 text-sm text-white shadow-sm transition-colors hover:bg-emerald-800 disabled:opacity-50"
                : "flex-1 rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
            }
          >
            新規登録
          </button>
        </div>
      </div>

      {/* SNS & ゲストボタングループ */}
      <div className="flex flex-wrap w-full gap-3">
        {showGuestLogin ? (
          <button
            onClick={handleGuestLogin}
            disabled={isLoggingIn}
            className={
              isMistVariant
                ? "flex-1 rounded-md border border-white/40 bg-white/15 px-4 py-2 text-sm text-white transition-colors hover:bg-white/25 disabled:opacity-50"
                : "flex-1 rounded-md bg-gray-500 px-4 py-2 text-sm text-white hover:bg-gray-600 disabled:opacity-50"
            }
          >
            ゲスト体験
          </button>
        ) : null}
        <button
          onClick={() => handleOAuthLogin('google')}
          disabled={isLoggingIn}
          className={
            isMistVariant
              ? "flex-1 rounded-md border border-white/45 bg-white/90 px-4 py-2 text-sm text-wa-black transition-colors hover:bg-white disabled:opacity-50"
              : "flex-1 rounded-md border border-gray-400 bg-white px-4 py-2 text-sm disabled:opacity-50"
          }
        >
          Google
        </button>
        <button
          onClick={() => handleOAuthLogin('x')}
          disabled={isLoggingIn}
          className={
            isMistVariant
              ? "flex-1 rounded-md border border-white/40 bg-black/85 px-4 py-2 text-sm text-white transition-colors hover:bg-black disabled:opacity-50"
              : "flex-1 rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          }
        >
          X (Twitter)
        </button>
      </div>
    </div>
  );
}