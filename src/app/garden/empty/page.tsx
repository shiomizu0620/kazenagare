import { GardenEmptyPageClient } from "./garden-empty-page-client";
import type {
  GardenOptionAction,
} from "@/components/garden/garden-options-menu";
import {
  GARDEN_BACKGROUNDS,
  GARDEN_SEASONS,
  GARDEN_TIME_SLOTS,
} from "@/lib/garden/setup/options";
import type { ObjectType } from "@/types/garden";

type QueryValue = string | string[] | undefined;

type GardenEmptyPageProps = {
  searchParams: Promise<{
    background?: QueryValue;
    season?: QueryValue;
    time?: QueryValue;
    place?: QueryValue;
  }>;
};

function normalizeQueryValue(value: QueryValue, fallback: string) {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }

  return value ?? fallback;
}

function parsePlacementObjectType(value: QueryValue): ObjectType | null {
  const normalizedValue = normalizeQueryValue(value, "");

  if (
    normalizedValue === "furin" ||
    normalizedValue === "shishi-odoshi" ||
    normalizedValue === "hanabi" ||
    normalizedValue === "kane" ||
    normalizedValue === "obake" ||
    normalizedValue === "tyo-tyo" ||
    normalizedValue === "kaeru" ||
    normalizedValue === "hue" ||
    normalizedValue === "suzume" ||
    normalizedValue === "sansin" ||
    normalizedValue === "mattya" ||
    normalizedValue === "semi" ||
    normalizedValue === "takibi" ||
    normalizedValue === "akimusi" ||
    normalizedValue === "ka" ||
    normalizedValue === "huro" ||
    normalizedValue === "suzu" ||
    normalizedValue === "haka" ||
    normalizedValue === "hagoita" ||
    normalizedValue === "youkai" ||
    normalizedValue === "kame" ||
    normalizedValue === "saru" ||
    normalizedValue === "tako"
  ) {
    return normalizedValue;
  }

  return null;
}

export default async function GardenEmptyPage({ searchParams }: GardenEmptyPageProps) {
  const params = await searchParams;

  const selectedBackgroundId = normalizeQueryValue(
    params.background,
    GARDEN_BACKGROUNDS[0].id,
  );
  const selectedSeasonId = normalizeQueryValue(params.season, GARDEN_SEASONS[0].id);
  const selectedTimeSlotId = normalizeQueryValue(
    params.time,
    GARDEN_TIME_SLOTS[0].id,
  );

  const selectedBackground =
    GARDEN_BACKGROUNDS.find((option) => option.id === selectedBackgroundId) ??
    GARDEN_BACKGROUNDS[0];
  const selectedSeason =
    GARDEN_SEASONS.find((option) => option.id === selectedSeasonId) ??
    GARDEN_SEASONS[0];
  const selectedTimeSlot =
    GARDEN_TIME_SLOTS.find((option) => option.id === selectedTimeSlotId) ??
    GARDEN_TIME_SLOTS[0];
  const selectedPlacementObjectType = parsePlacementObjectType(params.place);
  const isNight = selectedTimeSlot.id === "night";
  const currentGardenQuery = `background=${encodeURIComponent(selectedBackground.id)}&season=${encodeURIComponent(selectedSeason.id)}&time=${encodeURIComponent(selectedTimeSlot.id)}`;

  const optionActions: GardenOptionAction[] = [
    {
      href: "/garden/setup",
      label: "設定を変更する",
      description: "背景・季節・時間帯を選び直す",
    },
    {
      href: "/?login=1",
      label: "トップへ戻る",
      description: "最初のページへ戻る",
    },
    {
      href: `/garden?${currentGardenQuery}`,
      label: "庭一覧へ",
      description: "他の人の庭を見に行く",
    },
    {
      href: `/garden/publish?background=${encodeURIComponent(selectedBackground.id)}&season=${encodeURIComponent(selectedSeason.id)}&time=${encodeURIComponent(selectedTimeSlot.id)}`,
      label: "この庭を投稿する",
      description: "自分の庭を公開する",
    },
    {
      href: "/garden/me/qr",
      label: "この庭のQRを表示する",
      description: "スマホ共有用のQRコードを開く",
    },
  ];

  return (
    <GardenEmptyPageClient
      backgroundId={selectedBackground.id}
      seasonId={selectedSeason.id}
      seasonName={selectedSeason.name}
      timeSlotId={selectedTimeSlot.id}
      placementObjectType={selectedPlacementObjectType}
      optionActions={optionActions}
      darkMode={isNight}
    />
  );
}
