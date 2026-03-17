"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GardenSetupForm } from "@/components/garden/setup/garden-setup-form";
import { PageShell } from "@/components/ui/page-shell";
import { getSupabaseClient, getSupabaseSessionOrNull } from "@/lib/supabase/client";

export default function GardenSetupPage() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (hasCheckedRef.current) {
      return;
    }

    hasCheckedRef.current = true;

    const checkDisplayName = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setIsReady(true);
        return;
      }

      try {
        const session = await getSupabaseSessionOrNull(supabase);
        const user = session?.user;

        if (!user) {
          router.push("/?login=1");
          return;
        }

        setIsReady(true);
      } catch {
        setIsReady(true);
      }
    };

    void checkDisplayName();
  }, [router]);

  if (!isReady) {
    return (
      <PageShell title="読み込み中..." subtitle="">
        <div className="grid place-items-center gap-4 py-8">
          <p className="text-sm text-wa-black/75">初期化中...</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="庭の初期設定"
      subtitle="季節を選んで、庭の空気感を決めます"
    >
      <GardenSetupForm nextPath="/garden/empty" />
    </PageShell>
  );
}
