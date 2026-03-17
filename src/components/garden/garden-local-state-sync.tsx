"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect } from "react";
import { isAnonymousSupabaseUser } from "@/lib/auth/user";
import {
  createGardenLocalStateStorageKey,
  type GardenLocalState,
} from "@/lib/garden/local-state";
import { getSupabaseClient, getSupabaseSessionOrNull } from "@/lib/supabase/client";

type GardenLocalStateSyncProps = GardenLocalState;

const LEGACY_LOCAL_GUEST_USER_ID = "local_guest";

function resolveStorageOwnerId(userId: string | null, isAnonymous: boolean) {
  if (!userId || isAnonymous) {
    return LEGACY_LOCAL_GUEST_USER_ID;
  }

  return userId;
}

export function GardenLocalStateSync({
  backgroundId,
  seasonId,
  timeSlotId,
}: GardenLocalStateSyncProps) {
  useEffect(() => {
    const supabase = getSupabaseClient();

    const saveState = (user: User | null) => {
      const isAnon = isAnonymousSupabaseUser(user);
      const ownerId = resolveStorageOwnerId(user?.id ?? null, isAnon);

      // ローカルへ常に保存
      window.localStorage.setItem(
        createGardenLocalStateStorageKey(ownerId),
        JSON.stringify({ backgroundId, seasonId, timeSlotId }),
      );

      // 通常ログイン中はDBにも自動保存（クロスデバイス対応）
      if (supabase && user && !isAnon) {
        void supabase.from("garden_posts").upsert(
          {
            user_id: user.id,
            background_id: backgroundId,
            season_id: seasonId,
            time_slot_id: timeSlotId,
          },
          { onConflict: "user_id" },
        );
      }
    };

    if (!supabase) {
      saveState(null);
      return;
    }

    let isCancelled = false;

    void getSupabaseSessionOrNull(supabase).then((session) => {
      if (isCancelled) {
        return;
      }

      saveState(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      saveState(session?.user ?? null);
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, [backgroundId, seasonId, timeSlotId]);

  return null;
}
