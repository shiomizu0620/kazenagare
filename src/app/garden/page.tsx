import {
  GardenCorridor,
  type GardenCorridorPost,
} from "@/components/garden/garden-corridor";
import { buildGardenBackgroundCandidates } from "@/lib/garden/background-images";
import { fetchPublishedGardenPosts } from "@/lib/garden/posts";
import {
  GARDEN_BACKGROUNDS,
  GARDEN_SEASONS,
  GARDEN_TIME_SLOTS,
} from "@/lib/garden/setup/options";

type QueryValue = string | string[] | undefined;

type GardenIndexPageProps = {
  searchParams: Promise<{
    background?: QueryValue;
    season?: QueryValue;
    time?: QueryValue;
  }>;
};

function normalizeQueryValue(value: QueryValue) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function resolveOptionName(options: { id: string; name: string }[], id: string) {
  return options.find((option) => option.id === id)?.name ?? id;
}

function formatRemainingAutoDeleteTime(updatedAt: string | null) {
  if (!updatedAt) {
    return "不明";
  }

  const updatedAtDate = new Date(updatedAt);
  if (Number.isNaN(updatedAtDate.getTime())) {
    return "不明";
  }

  const expireAtMs = updatedAtDate.getTime() + 3 * 24 * 60 * 60 * 1000;
  const remainingMs = expireAtMs - Date.now();

  if (remainingMs <= 0) {
    return "まもなく消去";
  }

  const totalMinutes = Math.floor(remainingMs / (60 * 1000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}日 ${hours}時間`;
  }

  if (hours > 0) {
    return `${hours}時間 ${minutes}分`;
  }

  return `${Math.max(minutes, 1)}分`;
}

function resolveCorridorThumbnailSrc(
  backgroundId: string,
  seasonId: string,
  timeSlotId: string,
) {
  const candidates = buildGardenBackgroundCandidates(backgroundId, seasonId, timeSlotId);

  // PNG fallback is expected to exist and avoids broken thumbnails when scene-specific webp is missing.
  const preferredSrc = candidates.find((candidate) => candidate.endsWith(".png"));

  return preferredSrc ?? candidates[0] ?? "/images/garden/backgrounds/garden-all/庭.png";
}

export default async function GardenIndexPage({ searchParams }: GardenIndexPageProps) {
  const query = await searchParams;
  const publishedPosts = await fetchPublishedGardenPosts();
  const selectedBackgroundId = normalizeQueryValue(query.background);
  const selectedSeasonId = normalizeQueryValue(query.season);
  const selectedTimeSlotId = normalizeQueryValue(query.time);

  const nextMyGardenSearchParams = new URLSearchParams();
  if (selectedBackgroundId) {
    nextMyGardenSearchParams.set("background", selectedBackgroundId);
  }
  if (selectedSeasonId) {
    nextMyGardenSearchParams.set("season", selectedSeasonId);
  }
  if (selectedTimeSlotId) {
    nextMyGardenSearchParams.set("time", selectedTimeSlotId);
  }

  const nextMyGardenHref = nextMyGardenSearchParams.size
    ? `/garden/me?${nextMyGardenSearchParams.toString()}`
    : "/garden/me";

  const corridorPosts: GardenCorridorPost[] = publishedPosts.map((post) => ({
    userId: post.userId,
    ownerDisplayName: post.ownerDisplayName,
    backgroundName: resolveOptionName(GARDEN_BACKGROUNDS, post.backgroundId),
    seasonName: resolveOptionName(GARDEN_SEASONS, post.seasonId),
    timeSlotName: resolveOptionName(GARDEN_TIME_SLOTS, post.timeSlotId),
    seasonId: post.seasonId,
    timeSlotId: post.timeSlotId,
    thumbnailSrc: resolveCorridorThumbnailSrc(
      post.backgroundId,
      post.seasonId,
      post.timeSlotId,
    ),
    remainingTimeLabel: formatRemainingAutoDeleteTime(post.updatedAt),
  }));

  return <GardenCorridor posts={corridorPosts} nextMyGardenHref={nextMyGardenHref} />;
}
