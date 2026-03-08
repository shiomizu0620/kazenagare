import type { ObjectType } from "@/types/garden";

export type VoiceZooEntryStatus = "prototype" | "planned";

export type VoiceZooEntry = {
  objectType: ObjectType;
  name: string;
  ruby: string;
  icon: string;
  price: number;
  status: VoiceZooEntryStatus;
  soundDesign: string;
  visualReaction: string;
  memo: string;
};

export const VOICE_ZOO_ENTRIES: VoiceZooEntry[] = [
  {
    objectType: "furin",
    name: "風鈴",
    ruby: "ふうりん",
    icon: "🎐",
    price: 180,
    status: "prototype",
    soundDesign: "声を軽く高域寄りにして、透明感のある余韻へ変換（段階的に実装）",
    visualReaction: "音量に応じて短冊が揺れる。現在はメーター反応を先行実装。",
    memo: "収音UIは接続済み。音色変換はこれから強化。",
  },
  {
    objectType: "shishi-odoshi",
    name: "鹿威し",
    ruby: "ししおどし",
    icon: "🎋",
    price: 260,
    status: "planned",
    soundDesign: "声エネルギーを水量に見立て、一定量で竹が落ちる打撃音を合成",
    visualReaction: "溜まり -> 落下 -> 反動の周期アニメーションで反応",
    memo: "図鑑の先行登録。次フェーズでオブジェクト挙動を実装。",
  },
];

export const VOICE_ZOO_ENTRY_BY_OBJECT_TYPE = Object.fromEntries(
  VOICE_ZOO_ENTRIES.map((entry) => [entry.objectType, entry]),
) as Record<ObjectType, VoiceZooEntry>;

export function getVoiceZooObjectPrice(objectType: ObjectType) {
  return VOICE_ZOO_ENTRY_BY_OBJECT_TYPE[objectType].price;
}
