"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

const GARDEN_SETUP_PATH = "/garden/setup";
const OAUTH_REDIRECT_PENDING_KEY = "kazenagare.oauthRedirectPending";

export function AuthSection() {
  const router = useRouter();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const hasNavigatedRef = useRef(false);

  const navigateToGardenSetup = useCallback(() => {
    if (hasNavigatedRef.current) {
      return;
    }

    hasNavigatedRef.current = true;
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
        clearPendingOAuthRedirect();
        navigateToGardenSetup();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session && hasPendingOAuthRedirect()) {
        clearPendingOAuthRedirect();
        navigateToGardenSetup();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigateToGardenSetup]);

  // ゲストログイン
  const handleGuestLogin = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      alert("Supabase設定が見つかりません。");
      return;
    }

    setIsLoggingIn(true);

    try {
      const { error } = await supabase.auth.signInAnonymously();

      if (error) {
        alert("エラー: " + error.message);
        return;
      }

      navigateToGardenSetup();
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
      let authError;
      let shouldNavigate = false;

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        authError = error;
        shouldNavigate = Boolean(data.session);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        authError = error;
        shouldNavigate = !error;
      }

      if (authError) {
        alert("エラー: " + authError.message);
        return;
      }

      if (shouldNavigate) {
        navigateToGardenSetup();
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