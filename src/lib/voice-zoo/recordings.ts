import type { ObjectType } from "@/types/garden";

export const VOICE_ZOO_SUPPORTED_OBJECT_TYPES: ObjectType[] = [
  "furin",
  "shishi-odoshi",
];

export type VoiceZooRecordingMeta = {
  id: string;
  objectType: ObjectType;
  createdAt: string;
};

function isObjectType(value: unknown): value is ObjectType {
  return value === "furin" || value === "shishi-odoshi";
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
