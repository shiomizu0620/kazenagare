import { GARDEN_BACKGROUNDS, GARDEN_SEASONS, GARDEN_TIME_SLOTS } from "@/lib/garden/setup/options";

export const GARDEN_LOCAL_STORAGE_PREFIX = "kazenagare_garden_";

export type GardenLocalState = {
  backgroundId: string;
  seasonId: string;
  timeSlotId: string;
};

const DEFAULT_GARDEN_LOCAL_STATE: GardenLocalState = {
  backgroundId: GARDEN_BACKGROUNDS[0]?.id ?? "bamboo-forest",
  seasonId: GARDEN_SEASONS[0]?.id ?? "spring",
  timeSlotId: GARDEN_TIME_SLOTS[0]?.id ?? "daytime",
};

function normalizeStringValue(
  value: unknown,
  allowedValues: string[],
  fallback: string,
) {
  if (typeof value !== "string") {
    return fallback;
  }

  return allowedValues.includes(value) ? value : fallback;
}

function resolveBackgroundIdFromLegacyIndex(value: unknown, fallback: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const normalizedIndex = Math.max(0, Math.floor(value));
  const resolved = GARDEN_BACKGROUNDS[normalizedIndex];
  return resolved?.id ?? fallback;
}

export function parseGardenLocalState(rawValue: string | null): GardenLocalState | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as {
      backgroundId?: unknown;
      seasonId?: unknown;
      timeSlotId?: unknown;
      backgroundIndex?: unknown;
    };

    const fallback = DEFAULT_GARDEN_LOCAL_STATE;
    const backgroundIdFromString = normalizeStringValue(
      parsed.backgroundId,
      GARDEN_BACKGROUNDS.map((option) => option.id),
      "",
    );
    const backgroundId = backgroundIdFromString
      ? backgroundIdFromString
      : resolveBackgroundIdFromLegacyIndex(parsed.backgroundIndex, fallback.backgroundId);

    return {
      backgroundId,
      seasonId: normalizeStringValue(
        parsed.seasonId,
        GARDEN_SEASONS.map((option) => option.id),
        fallback.seasonId,
      ),
      timeSlotId: normalizeStringValue(
        parsed.timeSlotId,
        GARDEN_TIME_SLOTS.map((option) => option.id),
        fallback.timeSlotId,
      ),
    };
  } catch {
    return null;
  }
}

export function createGardenLocalStateStorageKey(userId: string) {
  return `${GARDEN_LOCAL_STORAGE_PREFIX}${userId}`;
}

export function getDefaultGardenLocalState() {
  return DEFAULT_GARDEN_LOCAL_STATE;
}
