"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAnonymousSupabaseUser } from "@/lib/auth/user";
import { getSupabaseClient, getSupabaseSessionOrNull } from "@/lib/supabase/client";

export default function TitlePage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState<"/top" | "/garden/me" | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const resolveNextPath = async () => {
      const supabase = getSupabaseClient();
      const session = await getSupabaseSessionOrNull(supabase);
      if (isCancelled) {
        return;
      }

      const user = session?.user ?? null;
      if (user && !isAnonymousSupabaseUser(user)) {
        setNextPath("/garden/me");
      } else {
        setNextPath("/top");
      }
    };

    void resolveNextPath();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (nextPath !== "/garden/me") {
      return;
    }

    const timerId = window.setTimeout(() => {
      router.replace("/garden/me");
    }, 900);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [nextPath, router]);

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

          {nextPath === null ? (
            <p className="text-sm text-wa-black/70">庭を準備しています...</p>
          ) : null}

          {nextPath === "/top" ? (
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

          {nextPath === "/garden/me" ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <p className="text-wa-black/75">ログイン状態を確認しました。あなたの庭へ移動します...</p>
              <button
                type="button"
                onClick={() => router.replace("/garden/me")}
                className="inline-flex items-center rounded-full border border-wa-black/25 bg-white px-4 py-2 text-sm font-semibold transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-wa-red/10 active:translate-y-[1px] active:scale-[0.98]"
              >
                いますぐ移動
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}