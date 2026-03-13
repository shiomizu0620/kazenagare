export const GARDEN_BGM_MANIFEST_PATH = "/audio/garden/manifest.json";

export type GardenBgmTrackDefinition = {
  src: string;
  volumeMultiplier: number;
};

export type GardenBgmSceneMap = {
  byBackgroundSeasonTime: Record<string, string>;
  byBackgroundSeason: Record<string, string>;
  byBackgroundTime: Record<string, string>;
  byBackground: Record<string, string>;
  bySeasonTime: Record<string, string>;
  bySeason: Record<string, string>;
  byTimeSlot: Record<string, string>;
};

export type GardenBgmManifest = {
  version: 1;
  defaultTrackId: string;
  tracks: Record<string, GardenBgmTrackDefinition>;
  scenes: GardenBgmSceneMap;
};

export type GardenBgmScene = {
  backgroundId: string;
  seasonId: string;
  timeSlotId: string;
};

export type ResolvedGardenBgmTrack = GardenBgmTrackDefinition & {
  id: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clampVolumeMultiplier(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(2, Math.max(0, value));
}

function parseTrackDefinition(rawValue: unknown): GardenBgmTrackDefinition | null {
  if (!isRecord(rawValue)) {
    return null;
  }

  const srcValue = rawValue.src;

  if (typeof srcValue !== "string" || !srcValue.startsWith("/audio/garden/")) {
    return null;
  }

  const volumeMultiplierValue =
    typeof rawValue.volumeMultiplier === "number" ? rawValue.volumeMultiplier : 1;

  return {
    src: srcValue,
    volumeMultiplier: clampVolumeMultiplier(volumeMultiplierValue),
  };
}

function parseStringMap(rawValue: unknown) {
  if (!isRecord(rawValue)) {
    return {};
  }

  const parsed: Record<string, string> = {};

  for (const [key, value] of Object.entries(rawValue)) {
    if (typeof value !== "string" || value.trim().length === 0) {
      continue;
    }

    parsed[key] = value;
  }

  return parsed;
}

export function parseGardenBgmManifest(rawValue: unknown): GardenBgmManifest | null {
  if (!isRecord(rawValue)) {
    return null;
  }

  const versionValue = rawValue.version;

  if (versionValue !== 1) {
    return null;
  }

  const defaultTrackIdValue = rawValue.defaultTrackId;

  if (
    typeof defaultTrackIdValue !== "string" ||
    defaultTrackIdValue.trim().length === 0
  ) {
    return null;
  }

  const tracksValue = rawValue.tracks;

  if (!isRecord(tracksValue)) {
    return null;
  }

  const tracks: Record<string, GardenBgmTrackDefinition> = {};

  for (const [trackId, trackDefinitionValue] of Object.entries(tracksValue)) {
    if (trackId.trim().length === 0) {
      continue;
    }

    const parsedTrackDefinition = parseTrackDefinition(trackDefinitionValue);

    if (!parsedTrackDefinition) {
      continue;
    }

    tracks[trackId] = parsedTrackDefinition;
  }

  if (Object.keys(tracks).length === 0) {
    return null;
  }

  const defaultTrackId = defaultTrackIdValue.trim();

  if (!tracks[defaultTrackId]) {
    return null;
  }

  const scenesValue = rawValue.scenes;
  const scenesRecord = isRecord(scenesValue) ? scenesValue : {};

  return {
    version: 1,
    defaultTrackId,
    tracks,
    scenes: {
      byBackgroundSeasonTime: parseStringMap(scenesRecord.byBackgroundSeasonTime),
      byBackgroundSeason: parseStringMap(scenesRecord.byBackgroundSeason),
      byBackgroundTime: parseStringMap(scenesRecord.byBackgroundTime),
      byBackground: parseStringMap(scenesRecord.byBackground),
      bySeasonTime: parseStringMap(scenesRecord.bySeasonTime),
      bySeason: parseStringMap(scenesRecord.bySeason),
      byTimeSlot: parseStringMap(scenesRecord.byTimeSlot),
    },
  };
}

export function resolveGardenBgmTrack(
  manifest: GardenBgmManifest,
  scene: GardenBgmScene,
): ResolvedGardenBgmTrack | null {
  const sceneKeyByBackgroundSeasonTime =
    `${scene.backgroundId}:${scene.seasonId}:${scene.timeSlotId}`;
  const sceneKeyByBackgroundSeason = `${scene.backgroundId}:${scene.seasonId}`;
  const sceneKeyByBackgroundTime = `${scene.backgroundId}:${scene.timeSlotId}`;
  const sceneKeyBySeasonTime = `${scene.seasonId}:${scene.timeSlotId}`;

  const candidateTrackIds = [
    manifest.scenes.byBackgroundSeasonTime[sceneKeyByBackgroundSeasonTime],
    manifest.scenes.byBackgroundSeason[sceneKeyByBackgroundSeason],
    manifest.scenes.byBackgroundTime[sceneKeyByBackgroundTime],
    manifest.scenes.byBackground[scene.backgroundId],
    manifest.scenes.bySeasonTime[sceneKeyBySeasonTime],
    manifest.scenes.bySeason[scene.seasonId],
    manifest.scenes.byTimeSlot[scene.timeSlotId],
    manifest.defaultTrackId,
  ];

  const visitedTrackIds = new Set<string>();

  for (const candidateTrackId of candidateTrackIds) {
    if (!candidateTrackId || visitedTrackIds.has(candidateTrackId)) {
      continue;
    }

    visitedTrackIds.add(candidateTrackId);
    const candidateTrack = manifest.tracks[candidateTrackId];

    if (!candidateTrack) {
      continue;
    }

    return {
      id: candidateTrackId,
      ...candidateTrack,
    };
  }

  return null;
}