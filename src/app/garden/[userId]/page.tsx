import { GardenUserPageMyGardenClient } from "./garden-user-page-my-garden-client";
import { GardenEmptyStage } from "@/components/garden/empty/garden-empty-stage";
import {
  GardenOptionsMenu,
  type GardenOptionAction,
} from "@/components/garden/garden-options-menu";
import { AdBannerFixed } from "@/components/ui/ad-banner-fixed";
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

export default async function GardenUserPage({
  params,
  searchParams,
}: GardenUserPageProps) {
  const { userId } = await params;
  const query = await searchParams;
  const isMe = userId === "me";
  const qrHref = `/garden/${encodeURIComponent(userId)}/qr`;
  const publishedPost = !isMe ? await fetchPublishedGardenPostByUserId(userId) : null;

  const selectedBackgroundId = normalizeQueryValue(
    query.background,
    GARDEN_BACKGROUNDS[0].id,
  );
  const selectedSeasonId = normalizeQueryValue(query.season, GARDEN_SEASONS[0].id);
  const selectedTimeSlotId = normalizeQueryValue(query.time, GARDEN_TIME_SLOTS[0].id);

  const background =
    GARDEN_BACKGROUNDS.find((option) =>
      option.id === (isMe ? selectedBackgroundId : publishedPost?.backgroundId),
    ) ??
    GARDEN_BACKGROUNDS[0];
  const season =
    GARDEN_SEASONS.find((option) =>
      option.id === (isMe ? selectedSeasonId : publishedPost?.seasonId),
    ) ??
    GARDEN_SEASONS[0];
  const timeSlot =
    GARDEN_TIME_SLOTS.find((option) =>
      option.id === (isMe ? selectedTimeSlotId : publishedPost?.timeSlotId),
    ) ??
    GARDEN_TIME_SLOTS[0];
  const selectedPlacementObjectType = parsePlacementObjectType(query.place);
  const isNight = timeSlot.id === "night";
  const currentGardenQuery = `background=${encodeURIComponent(background.id)}&season=${encodeURIComponent(season.id)}&time=${encodeURIComponent(timeSlot.id)}`;
  const normalizedOwnerDisplayName =
    typeof publishedPost?.ownerDisplayName === "string"
      ? publishedPost.ownerDisplayName.trim()
      : "";
  const visitedGardenOwnerName =
    normalizedOwnerDisplayName && normalizedOwnerDisplayName !== userId
      ? normalizedOwnerDisplayName
      : "庭主";
  const visitorGardenName = `${visitedGardenOwnerName}の庭`;

  if (isMe) {
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
        href: "/garden/publish",
        label: "この庭を投稿する",
        description: "他の人があなたの庭を訪問できるようにする",
      },
      {
        href: "/garden/me/qr",
        label: "この庭のQRを表示する",
        description: "スマホ共有用のQRコードを開く",
      },
    ];

    return (
      <GardenUserPageMyGardenClient
        backgroundId={background.id}
        seasonId={season.id}
        seasonName={season.name}
        timeSlotId={timeSlot.id}
        placementObjectType={selectedPlacementObjectType}
        optionActions={optionActions}
        darkMode={isNight}
      />
    );
  }

  const visitorActions: GardenOptionAction[] = [
    {
      href: "/?login=1",
      label: "トップへ戻る",
      description: "最初のページへ戻る",
    },
    {
      href: "/garden",
      label: "庭一覧へ",
      description: "他の人の庭を見に行く",
    },
    {
      href: qrHref,
      label: "この庭のQRを表示する",
      description: "スマホ共有用のQRコードを開く",
    },
    {
      href: "/garden/me",
      label: "自分の庭で配置する",
      description: "自分の庭へ戻って配置を続ける",
    },
  ];

  return (
    <main className="relative h-[100svh] overflow-hidden overscroll-none bg-wa-white text-wa-black font-serif md:h-[100dvh] md:overscroll-auto">
      <GardenEmptyStage
        key={`${userId}-${publishedPost?.publishedAt ?? "draft"}`}
        backgroundId={background.id}
        seasonId={season.id}
        seasonName={season.name}
        timeSlotId={timeSlot.id}
        fullscreen
        initialPlacedObjects={publishedPost?.placedObjects ?? []}
        audioOwnerIdOverride={userId}
        allowHarmonyFromVisitors={publishedPost?.allowHarmonyOverlays ?? true}
        ownerName={visitedGardenOwnerName}
        gardenName={visitorGardenName}
      />

      {!publishedPost ? (
        <div className="pointer-events-none absolute left-1/2 top-4 z-[60] -translate-x-1/2">
          <p className="rounded-full border border-amber-700/35 bg-amber-50/95 px-4 py-2 text-xs text-amber-900 shadow-sm backdrop-blur-sm">
            このユーザーはまだ庭を投稿していないため、デフォルトの情景を表示しています。
          </p>
        </div>
      ) : null}

      <GardenOptionsMenu
        actions={visitorActions}
        title={visitorGardenName}
        currentGardenName={visitorGardenName}
        useViewerGardenTitle
        darkMode={isNight}
        showCatalogButton={false}
      />

      <AdBannerFixed />
    </main>
  );
}
