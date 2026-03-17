const GARDEN_ALL_SEASON_IMAGE: Record<string, string> = {
  spring: "/images/garden/backgrounds/garden-all/spring/庭-春.png",
  summer: "/images/garden/backgrounds/garden-all/summer/庭-夏.png",
  autumn: "/images/garden/backgrounds/garden-all/autumn/庭-秋.png",
  winter: "/images/garden/backgrounds/garden-all/winter/庭-冬.png",
};

const BACKGROUND_IMAGE_EXTENSIONS = ["avif", "webp", "png", "jpg", "jpeg"] as const;

// Avoid repeated 404 probes on initial load until each background has real scene assets.
const BACKGROUNDS_WITH_SCENE_SPECIFIC_IMAGES = new Set<string>(["garden-all"]);

export function buildGardenBackgroundCandidates(
  backgroundId: string,
  seasonId: string,
  timeSlotId: string,
) {
  const candidates: string[] = [];

  if (BACKGROUNDS_WITH_SCENE_SPECIFIC_IMAGES.has(backgroundId)) {
    for (const extension of BACKGROUND_IMAGE_EXTENSIONS) {
      candidates.push(
        `/images/garden/backgrounds/${backgroundId}/${seasonId}/${timeSlotId}/background.${extension}`,
      );
    }
  }

  const seasonalFallback = GARDEN_ALL_SEASON_IMAGE[seasonId];
  if (seasonalFallback) {
    candidates.push(seasonalFallback);
  }

  candidates.push("/images/garden/backgrounds/garden-all/庭.png");

  return [...new Set(candidates)];
}