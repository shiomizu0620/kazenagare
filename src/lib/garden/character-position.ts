export const GARDEN_CHARACTER_POSITION_STORAGE_KEY_PREFIX = "kazenagare_character_position_";

const DEFAULT_GARDEN_CHARACTER_OWNER_ID = "local_guest";

export type GardenCharacterPosition = {
  x: number;
  y: number;
};

export function createGardenCharacterPositionStorageKey(ownerId: string) {
  return `${GARDEN_CHARACTER_POSITION_STORAGE_KEY_PREFIX}${ownerId || DEFAULT_GARDEN_CHARACTER_OWNER_ID}`;
}

export function parseGardenCharacterPosition(
  rawValue: string | null,
): GardenCharacterPosition | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<GardenCharacterPosition>;

    if (
      typeof parsed.x !== "number" ||
      !Number.isFinite(parsed.x) ||
      typeof parsed.y !== "number" ||
      !Number.isFinite(parsed.y)
    ) {
      return null;
    }

    return {
      x: parsed.x,
      y: parsed.y,
    };
  } catch {
    return null;
  }
}