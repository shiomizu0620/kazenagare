"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GARDEN_BACKGROUNDS } from "@/lib/garden/setup/options";
import type { GardenBackground, GardenProfile } from "@/types/garden";
import { getSupabaseClient, getSupabaseSessionOrNull } from "@/lib/supabase/client";
import {
  createGardenLocalStateStorageKey,
  parseGardenLocalState,
} from "@/lib/garden/local-state";

const BACKGROUNDS: GardenBackground[] = GARDEN_BACKGROUNDS;
const RANDOM_USER_IDS = ["akari", "ren", "sora", "yui"];

export function useGarden() {
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const [randomIndex, setRandomIndex] = useState(0);
  
  // ユーザーIDと読み込み状態を管理する新しいステート
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // 1. Supabaseからログイン中のユーザーID（ゲスト含む）を取得する
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    // 現在のセッションを確認
    void getSupabaseSessionOrNull(supabase).then((session) => {
      if (session?.user) {
        setUserId(session.user.id);
      } else {
        setUserId("local_guest"); // ログイン前の一時的なID
      }
    });

    // ログイン・ログアウトの切り替えを自動検知
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
      } else {
        setUserId("local_guest");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. ユーザーIDがわかったら、手元のブラウザから前回のデータを読み込む
  useEffect(() => {
    if (!userId) return;

    // 【修正ポイント】Promise.resolve()を使って処理を非同期にし、Reactの警告を回避！
    Promise.resolve().then(() => {
      // ユーザーIDを鍵にしてデータを引き出す
      const savedData = localStorage.getItem(createGardenLocalStateStorageKey(userId));
      const parsed = parseGardenLocalState(savedData);

      if (parsed) {
        const nextIndex = BACKGROUNDS.findIndex(
          (option) => option.id === parsed.backgroundId,
        );
        if (nextIndex >= 0) {
          setBackgroundIndex(nextIndex);
        }
      }
      setIsLoaded(true); // 読み込み完了！
    });
  }, [userId]);

  // 3. 背景が変わるたびに、手元のブラウザに自動保存する
  useEffect(() => {
    // ユーザーIDがない、または初期読み込みが終わっていない時は保存しない（上書き防止）
    if (!userId || !isLoaded) return;

    const selectedBackgroundId = BACKGROUNDS[backgroundIndex]?.id ?? BACKGROUNDS[0].id;
    const dataToSave = {
      backgroundIndex,
      backgroundId: selectedBackgroundId,
      seasonId: "spring",
      timeSlotId: "daytime",
    };
    
    // ユーザーIDを鍵にして保存する
    localStorage.setItem(createGardenLocalStateStorageKey(userId), JSON.stringify(dataToSave));
  }, [backgroundIndex, userId, isLoaded]);

  const selectedBackground = BACKGROUNDS[backgroundIndex];

  const profile = useMemo<GardenProfile>(
    () => ({
      userId: userId || "me",
      username: "you",
      selectedBackgroundId: selectedBackground.id,
    }),
    [selectedBackground.id, userId],
  );

  const selectNextBackground = useCallback(() => {
    setBackgroundIndex((current) => (current + 1) % BACKGROUNDS.length);
  }, []);

  const visitAnotherGarden = useCallback(() => {
    setRandomIndex((current) => (current + 1) % RANDOM_USER_IDS.length);
  }, []);

  const randomGardenPath = useMemo(
    () => `/garden/${RANDOM_USER_IDS[randomIndex]}`,
    [randomIndex],
  );

  return {
    backgrounds: BACKGROUNDS,
    profile,
    randomGardenPath,
    selectNextBackground,
    selectedBackground,
    visitAnotherGarden,
  };
}