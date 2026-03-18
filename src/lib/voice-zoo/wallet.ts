import type { ObjectType } from "@/types/garden";

export const VOICE_ZOO_WALLET_UPDATED_EVENT = "kazenagare:wallet-updated";
export const INITIAL_VOICE_ZOO_COINS = 500;
export const MIN_PLAYBACK_REWARD_COINS = 12;
export const PLAYBACK_REWARD_RATE = 0.12;
const LEGACY_VOICE_ZOO_WALLET_STORAGE_KEY = "kazenagare_wallet_me";
const DEFAULT_WALLET_OWNER_ID = "local_guest";

export type VoiceZooWallet = {
  coins: number;
  ownedObjectTypes: ObjectType[];
};

export type VoiceZooWalletUpdatedEventDetail = {
  ownerId: string;
  wallet: VoiceZooWallet;
};

export function getVoiceZooWalletStorageKey(ownerId: string) {
  const normalizedOwnerId = ownerId || DEFAULT_WALLET_OWNER_ID;
  return `kazenagare_wallet_${normalizedOwnerId}`;
}

export function calculatePlaybackRewardCoins(objectPrice: number) {
  return Math.max(
    MIN_PLAYBACK_REWARD_COINS,
    Math.round(objectPrice * PLAYBACK_REWARD_RATE),
  );
}

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

export function loadVoiceZooWallet(ownerId: string) {
  if (typeof window === "undefined") {
    return createInitialVoiceZooWallet();
  }

  const storageKey = getVoiceZooWalletStorageKey(ownerId);
  const storedWallet = window.localStorage.getItem(storageKey);
  if (storedWallet) {
    return parseVoiceZooWallet(storedWallet);
  }

  // One-time legacy fallback for guest data from old fixed key.
  if (ownerId === DEFAULT_WALLET_OWNER_ID) {
    return parseVoiceZooWallet(
      window.localStorage.getItem(LEGACY_VOICE_ZOO_WALLET_STORAGE_KEY),
    );
  }

  return createInitialVoiceZooWallet();
}

export function saveVoiceZooWallet(wallet: VoiceZooWallet, ownerId = DEFAULT_WALLET_OWNER_ID) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedWallet = parseVoiceZooWallet(JSON.stringify(wallet));
  const storageKey = getVoiceZooWalletStorageKey(ownerId);

  window.localStorage.setItem(storageKey, JSON.stringify(normalizedWallet));
  window.dispatchEvent(
    new CustomEvent<VoiceZooWalletUpdatedEventDetail>(VOICE_ZOO_WALLET_UPDATED_EVENT, {
      detail: {
        ownerId,
        wallet: normalizedWallet,
      },
    }),
  );
}
