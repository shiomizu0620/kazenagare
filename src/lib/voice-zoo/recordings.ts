import type { ObjectType } from "@/types/garden";

export const VOICE_ZOO_SUPPORTED_OBJECT_TYPES: ObjectType[] = [
  "furin",
  "shishi-odoshi",
  "hanabi",
  "kane",
  "obake",
  "tyo-tyo",
  "kaeru",
  "hue",
  "suzume",
  "sansin",
  "mattya",
  "semi",
  "takibi",
  "akimusi",
  "ka",
  "huro",
  "suzu",
  "haka",
  "hagoita",
  "youkai",
  "kame",
  "saru",
  "tako",
];
export const VOICE_ZOO_RECORDING_UPDATED_EVENT = "kazenagare:recording-updated";

export type VoiceZooRecordingUpdatedEventDetail = {
  ownerId: string;
  objectType?: ObjectType;
  recordingId?: string;
};

export type VoiceZooRecordingMeta = {
  id: string;
  objectType: ObjectType;
  createdAt: string;
};

function isObjectType(value: unknown): value is ObjectType {
  return (
    value === "furin" ||
    value === "shishi-odoshi" ||
    value === "hanabi" ||
    value === "kane" ||
    value === "obake" ||
    value === "tyo-tyo" ||
    value === "kaeru" ||
    value === "hue" ||
    value === "suzume" ||
    value === "sansin" ||
    value === "mattya" ||
    value === "semi" ||
    value === "takibi" ||
    value === "akimusi" ||
    value === "ka" ||
    value === "huro" ||
    value === "suzu" ||
    value === "haka" ||
    value === "hagoita" ||
    value === "youkai" ||
    value === "kame" ||
    value === "saru" ||
    value === "tako"
  );
}

function isVoiceZooRecordingMeta(value: unknown): value is VoiceZooRecordingMeta {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<VoiceZooRecordingMeta>;

  return (
    typeof candidate.id === "string" &&
    isObjectType(candidate.objectType) &&
    typeof candidate.createdAt === "string"
  );
}

export function parseVoiceZooRecordingCatalog(rawValue: string | null): VoiceZooRecordingMeta[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isVoiceZooRecordingMeta);
  } catch {
    return [];
  }
}

export function getLatestRecordingIdByObjectType(
  recordingCatalog: VoiceZooRecordingMeta[],
): Partial<Record<ObjectType, string>> {
  const latestMap: Partial<Record<ObjectType, VoiceZooRecordingMeta>> = {};

  for (const recording of recordingCatalog) {
    const current = latestMap[recording.objectType];

    if (!current || Date.parse(recording.createdAt) >= Date.parse(current.createdAt)) {
      latestMap[recording.objectType] = recording;
    }
  }

  return {
    furin: latestMap.furin?.id,
    "shishi-odoshi": latestMap["shishi-odoshi"]?.id,
    hanabi: latestMap.hanabi?.id,
    kane: latestMap.kane?.id,
    obake: latestMap.obake?.id,
    "tyo-tyo": latestMap["tyo-tyo"]?.id,
    kaeru: latestMap.kaeru?.id,
    hue: latestMap.hue?.id,
    suzume: latestMap.suzume?.id,
    sansin: latestMap.sansin?.id,
    mattya: latestMap.mattya?.id,
    semi: latestMap.semi?.id,
    takibi: latestMap.takibi?.id,
    akimusi: latestMap.akimusi?.id,
    ka: latestMap.ka?.id,
    huro: latestMap.huro?.id,
    suzu: latestMap.suzu?.id,
    haka: latestMap.haka?.id,
    hagoita: latestMap.hagoita?.id,
    youkai: latestMap.youkai?.id,
    kame: latestMap.kame?.id,
    saru: latestMap.saru?.id,
    tako: latestMap.tako?.id,
  };
}

export function getVoiceZooRecordingCatalogStorageKey(ownerId: string) {
  return `kazenagare_audio_catalog_${ownerId}`;
}

export function getVoiceZooRecordingBlobStorageKey(ownerId: string, recordingId: string) {
  return `kazenagare_audio_blob_${ownerId}_${recordingId}`;
}

export function getVoiceZooLegacyRecordingStorageKey(ownerId: string, objectType: ObjectType) {
  return `kazenagare_audio_${ownerId}_${objectType}`;
}

export function createVoiceZooRecordingId(objectType: ObjectType) {
  return `${objectType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getVoiceZooRecordingStorageKey(ownerId: string, objectType: ObjectType) {
  return getVoiceZooLegacyRecordingStorageKey(ownerId, objectType);
}
