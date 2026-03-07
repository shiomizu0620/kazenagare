import { GardenEmptyStage } from "@/components/garden/empty/garden-empty-stage";
import {
  GardenOptionsMenu,
  type GardenOptionAction,
} from "@/components/garden/garden-options-menu";
import {
  GARDEN_BACKGROUNDS,
  GARDEN_SEASONS,
  GARDEN_TIME_SLOTS,
} from "@/lib/garden/setup/options";

type QueryValue = string | string[] | undefined;

type GardenEmptyPageProps = {
  searchParams: Promise<{
    background?: QueryValue;
    season?: QueryValue;
    time?: QueryValue;
  }>;
};

function normalizeQueryValue(value: QueryValue, fallback: string) {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }

  return value ?? fallback;
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
  const isNightPond = selectedBackground.id === "night-pond";

  const optionActions: GardenOptionAction[] = [
    {
      href: "/garden/setup",
      label: "設定を変更する",
      description: "背景・季節・時間帯を選び直す",
    },
    {
      href: "/garden/me/qr",
      label: "この庭のQRを表示する",
      description: "スマホ共有用のQRコードを開く",
    },
    {
      href: "/garden",
      label: "庭一覧へ",
      description: "他の人の庭を見に行く",
    },
    {
      href: "/test-ui",
      label: "開発プレイグラウンドへ",
      description: "UIテストページを開く",
    },
  ];

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-wa-white text-wa-black font-serif">
      <GardenEmptyStage
        backgroundId={selectedBackground.id}
        backgroundName={selectedBackground.name}
        seasonId={selectedSeason.id}
        seasonName={selectedSeason.name}
        timeSlotId={selectedTimeSlot.id}
        timeSlotName={selectedTimeSlot.name}
        fullscreen
      />

      <GardenOptionsMenu
        actions={optionActions}
        title="自分の庭オプション"
        darkMode={isNightPond}
      />

      <div
        className={`pointer-events-none absolute bottom-5 left-1/2 z-40 w-[min(92vw,38rem)] -translate-x-1/2 rounded-full border px-4 py-2 text-center text-xs backdrop-blur-sm ${
          isNightPond
            ? "border-wa-white/30 bg-wa-black/45 text-wa-white"
            : "border-wa-black/20 bg-wa-white/75 text-wa-black"
        }`}
      >
        設定変更やQR表示は、右上のオプションから開けます。
      </div>
    </main>
  );
}
