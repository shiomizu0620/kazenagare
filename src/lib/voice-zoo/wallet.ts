import type { ObjectType } from "@/types/garden";

export const VOICE_ZOO_WALLET_STORAGE_KEY = "kazenagare_wallet_me";
export const VOICE_ZOO_WALLET_UPDATED_EVENT = "kazenagare:wallet-updated";
export const INITIAL_VOICE_ZOO_COINS = 500;
export const MIN_PLAYBACK_REWARD_COINS = 12;
export const PLAYBACK_REWARD_RATE = 0.12;

export type VoiceZooWallet = {
  coins: number;
  ownedObjectTypes: ObjectType[];
};

export function calculatePlaybackRewardCoins(objectPrice: number) {
  return Math.max(
    MIN_PLAYBACK_REWARD_COINS,
    Math.round(objectPrice * PLAYBACK_REWARD_RATE),
  );
}

function isObjectType(value: unknown): value is ObjectType {
  return value === "furin" || value === "shishi-odoshi";
}

export function createInitialVoiceZooWallet(): VoiceZooWallet {
  return {
    coins: INITIAL_VOICE_ZOO_COINS,
    ownedObjectTypes: [],
  };
}

export function parseVoiceZooWallet(rawValue: string | null): VoiceZooWallet {
  if (!rawValue) {
    return createInitialVoiceZooWallet();
  }

  try {
    const parsed: unknown = JSON.parse(rawValue);

    if (!parsed || typeof parsed !== "object") {
      return createInitialVoiceZooWallet();
    }

    const candidate = parsed as Partial<VoiceZooWallet>;
    const coins =
      typeof candidate.coins === "number" && Number.isFinite(candidate.coins)
        ? Math.max(0, Math.floor(candidate.coins))
        : INITIAL_VOICE_ZOO_COINS;
    const ownedObjectTypes = Array.isArray(candidate.ownedObjectTypes)
      ? Array.from(
          new Set(candidate.ownedObjectTypes.filter((value) => isObjectType(value))),
        )
      : [];

    return {
      coins,
      ownedObjectTypes,
    };
  } catch {
    return createInitialVoiceZooWallet();
  }
}

export function saveVoiceZooWallet(wallet: VoiceZooWallet) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedWallet = parseVoiceZooWallet(JSON.stringify(wallet));

  window.localStorage.setItem(
    VOICE_ZOO_WALLET_STORAGE_KEY,
    JSON.stringify(normalizedWallet),
  );
  window.dispatchEvent(
    new CustomEvent<VoiceZooWallet>(VOICE_ZOO_WALLET_UPDATED_EVENT, {
      detail: normalizedWallet,
    }),
  );
}
