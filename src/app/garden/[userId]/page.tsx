import Link from "next/link";
import { GardenEmptyStage } from "@/components/garden/empty/garden-empty-stage";
import { GardenLocalStateSync } from "@/components/garden/garden-local-state-sync";
import {
  GardenOptionsMenu,
  type GardenOptionAction,
} from "@/components/garden/garden-options-menu";
import { GardenSummary } from "@/components/garden/garden-summary";
import { PageShell } from "@/components/ui/page-shell";
import {
  GARDEN_BACKGROUNDS,
  GARDEN_SEASONS,
  GARDEN_TIME_SLOTS,
} from "@/lib/garden/setup/options";
import { fetchPublishedGardenPostByUserId } from "@/lib/garden/posts";
import type { ObjectType } from "@/types/garden";

type QueryValue = string | string[] | undefined;

type GardenUserPageProps = {
  params: Promise<{
    userId: string;
  }>;
  searchParams: Promise<{
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

  if (normalizedValue === "furin" || normalizedValue === "shishi-odoshi") {
    return normalizedValue;
  }

  return null;
}

export default async function GardenUserPage({
  params,
  searchParams,
}: GardenUserPageProps) {
  const { userId } = await params;
  const query = await searchParams;
  const isMe = userId === "me";
  const qrHref = `/garden/${encodeURIComponent(userId)}/qr`;
  const publishedPost = !isMe ? await fetchPublishedGardenPostByUserId(userId) : null;
  const background =
    GARDEN_BACKGROUNDS.find((option) => option.id === publishedPost?.backgroundId) ??
    GARDEN_BACKGROUNDS[0];
  const season =
    GARDEN_SEASONS.find((option) => option.id === publishedPost?.seasonId) ??
    GARDEN_SEASONS[0];
  const timeSlot =
    GARDEN_TIME_SLOTS.find((option) => option.id === publishedPost?.timeSlotId) ??
    GARDEN_TIME_SLOTS[0];
  const selectedPlacementObjectType = parsePlacementObjectType(query.place);
  const isNightPond = background.id === "night-pond";

  if (isMe) {
    const optionActions: GardenOptionAction[] = [
      {
        href: "/garden/publish",
        label: "この庭を投稿する",
        description: "他の人があなたの庭を訪問できるようにする",
      },
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
        <GardenLocalStateSync
          backgroundId={background.id}
          seasonId={season.id}
          timeSlotId={timeSlot.id}
        />

        <GardenEmptyStage
          backgroundId={background.id}
          backgroundName={background.name}
          seasonId={season.id}
          seasonName={season.name}
          timeSlotId={timeSlot.id}
          timeSlotName={timeSlot.name}
          fullscreen
          allowObjectPlacement
          placementObjectType={selectedPlacementObjectType}
          objectStorageKey="kazenagare_objects_me"
        />

        <GardenOptionsMenu
          actions={optionActions}
          title="自分の庭オプション"
          darkMode={isNightPond}
        />
      </main>
    );
  }

  return (
    <PageShell title={`${userId} の庭`} subtitle="静かな和の情景を巡る">
      {!publishedPost ? (
        <p className="mb-3 rounded-md border border-amber-700/35 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          このユーザーはまだ庭を投稿していないため、デフォルトの情景を表示しています。
        </p>
      ) : null}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/garden"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-slate-100 active:translate-y-[1px] active:scale-[0.98]"
        >
          × 庭一覧に戻る
        </Link>
        <Link
          href={qrHref}
          className="rounded-md border border-wa-black px-3 py-2 text-sm transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-wa-red/10 active:translate-y-[1px] active:scale-[0.98]"
        >
          この庭のQRを表示する
        </Link>
        <Link
          href="/voice-zoo"
          className="rounded-md border border-wa-black px-3 py-2 text-sm transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-wa-red/10 active:translate-y-[1px] active:scale-[0.98]"
        >
          オブジェクトを置く
        </Link>
      </div>
      <div className="grid gap-4">
        <GardenSummary
          profile={{
            userId,
            username: userId,
            selectedBackgroundId: background.id,
          }}
          backgroundName={background.name}
        />

        <GardenEmptyStage
          backgroundId={background.id}
          backgroundName={background.name}
          seasonId={season.id}
          seasonName={season.name}
          timeSlotId={timeSlot.id}
          timeSlotName={timeSlot.name}
        />
      </div>
    </PageShell>
  );
}
