const GARDEN_ALL_SEASON_IMAGE: Record<string, string> = {
  spring: "/images/garden/backgrounds/garden-all/spring/庭-春.png",
  summer: "/images/garden/backgrounds/garden-all/summer/庭-夏.png",
  autumn: "/images/garden/backgrounds/garden-all/autumn/庭-秋.png",
  winter: "/images/garden/backgrounds/garden-all/winter/庭-冬.png",
};

// scene-specific background.webp が未配置の間は 404 を避けるため空にしておく。
// 実ファイルを追加したら対象ID（例: "garden-all"）を再度ここに入れる。
const BACKGROUNDS_WITH_SCENE_SPECIFIC_IMAGES = new Set<string>();

export function buildGardenBackgroundCandidates(
  backgroundId: string,
  seasonId: string,
  timeSlotId: string,
) {
  const candidates: string[] = [];

  if (BACKGROUNDS_WITH_SCENE_SPECIFIC_IMAGES.has(backgroundId)) {
    candidates.push(
      `/images/garden/backgrounds/${backgroundId}/${seasonId}/${timeSlotId}/background.webp`,
    );
  }

  const seasonalFallback = GARDEN_ALL_SEASON_IMAGE[seasonId];
  if (seasonalFallback) {
    candidates.push(seasonalFallback);
  }

  candidates.push("/images/garden/backgrounds/garden-all/庭.png");

  return [...new Set(candidates)];
}

// プリロード背景画像をブラウザキャッシュに事前に格納
export function preloadBackgroundImage(imageSrc: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // エラーでもresolveして続行
    img.src = imageSrc;
  });
}

// 複数の背景画像を並列でプリロード
export async function preloadGardenBackgroundCandidates(
  backgroundId: string,
  seasonId: string,
  timeSlotId: string,
): Promise<void> {
  const candidates = buildGardenBackgroundCandidates(backgroundId, seasonId, timeSlotId);
  await Promise.all(candidates.map((src) => preloadBackgroundImage(src)));
}