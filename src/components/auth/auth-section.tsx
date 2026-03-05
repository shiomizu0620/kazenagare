"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

export function AuthSection() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ゲストログイン
  const handleGuestLogin = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setIsLoggingIn(true);
    const { error } = await supabase.auth.signInAnonymously();
    if (error) alert("エラー: " + error.message);
    else alert("ゲストとして入室しました！");
    setIsLoggingIn(false);
  };

  // SNSログイン（Google / X）
  const handleOAuthLogin = async (provider: 'google' | 'twitter') => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setIsLoggingIn(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: { redirectTo: window.location.origin }
    });
    if (error) {
      alert("エラー: " + error.message);
      setIsLoggingIn(false);
    }
  };

  // メアドでログイン・新規登録
  const handleEmailAuth = async (isSignUp: boolean) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    if (!email || !password) {
      alert("メールアドレスとパスワードを入力してください");
      return;
    }
    setIsLoggingIn(true);
    let authError;
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      authError = error;
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      authError = error;
    }
    if (authError) alert("エラー: " + authError.message);
    else alert(isSignUp ? "登録完了しました！" : "ログイン成功！");
    setIsLoggingIn(false);
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