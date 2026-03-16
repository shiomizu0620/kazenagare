"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/page-shell";
import Link from "next/link";
import { AuthSection } from "@/components/auth/auth-section"; // 作ったファイルを読み込む
import { getSupabaseClient } from "@/lib/supabase/client";
import { isAnonymousSupabaseUser } from "@/lib/auth/user";

export default function Home() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    const shouldStayOnTop =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("top") === "1";

    if (!supabase || shouldStayOnTop) {
      const timerId = window.setTimeout(() => {
        setIsCheckingSession(false);
      }, 0);

      return () => {
        window.clearTimeout(timerId);
      };
    }

    let isCancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (isCancelled) {
        return;
      }

      const user = data.session?.user ?? null;
      if (user && !isAnonymousSupabaseUser(user)) {
        router.replace("/garden/me");
      } else {
        setIsCheckingSession(false);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [router, supabase]);

  if (isCheckingSession) {
    return null;
  }

  return (
    <PageShell
      title="風流 - Kazenagare"
      subtitle="声を和の情景へ溶け込ませるインタラクティブ体験"
    >
      <div className="flex flex-col gap-6">
        {/* === ここにログイン機能をガサッと表示 === */}
        <AuthSection />
        {/* ==================================== */}

        <div className="border-t border-wa-black/10 pt-4">
          <Link
            href="/garden"
            className="rounded-md border border-wa-black px-4 py-3 text-sm transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-wa-red/10 active:translate-y-[1px] active:scale-[0.98]"
          >
            庭一覧へ
          </Link>
        </div>
      </div>
    </PageShell>
  );
}