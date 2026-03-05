"use client";

import { useCallback, useMemo, useState } from "react";
import { GARDEN_BACKGROUNDS } from "@/lib/garden/setup/options";
import type { GardenBackground, GardenProfile } from "@/types/garden";

const BACKGROUNDS: GardenBackground[] = GARDEN_BACKGROUNDS;

const RANDOM_USER_IDS = ["akari", "ren", "sora", "yui"];

export function useGarden() {
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const [randomIndex, setRandomIndex] = useState(0);

  const selectedBackground = BACKGROUNDS[backgroundIndex];

  const profile = useMemo<GardenProfile>(
    () => ({
      userId: "me",
      username: "you",
      selectedBackgroundId: selectedBackground.id,
    }),
    [selectedBackground.id],
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
