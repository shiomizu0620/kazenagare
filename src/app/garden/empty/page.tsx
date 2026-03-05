import Link from "next/link";
import { GardenEmptyStage } from "@/components/garden/empty/garden-empty-stage";
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

  return (
    <main className="min-h-screen bg-wa-white text-wa-black font-serif">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">あなたの庭（初期状態）</h1>
          <p className="text-sm">
            設定を反映した、まだ何も配置していない日本風の庭です。
          </p>
        </header>

        <GardenEmptyStage
          backgroundId={selectedBackground.id}
          backgroundName={selectedBackground.name}
          seasonId={selectedSeason.id}
          seasonName={selectedSeason.name}
          timeSlotId={selectedTimeSlot.id}
          timeSlotName={selectedTimeSlot.name}
        />

        <div className="flex flex-wrap gap-3">
          <Link
            href="/garden/setup"
            className="rounded-md border border-wa-black px-4 py-2 text-sm"
          >
            設定を変更する
          </Link>
          <Link
            href="/test-ui"
            className="rounded-md border border-wa-black px-4 py-2 text-sm"
          >
            開発プレイグラウンドへ
          </Link>
        </div>
      </div>
    </main>
  );
}
