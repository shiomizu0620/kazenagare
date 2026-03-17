import type { ObjectType } from "@/types/garden";

export type VoiceZooEntryStatus = "prototype" | "planned";

export type VoiceZooEntry = {
  objectType: ObjectType;
  name: string;
  ruby: string;
  icon: string;
  catalogImageSrc: string;
  stageVideoSrc: string;
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
    icon: "furin",
    catalogImageSrc: "/images/garden/objects/furin/catalog/huurine.png",
    stageVideoSrc: "/videos/garden/objects/furin/stage/huurin.webm",
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
    icon: "shishi-odoshi",
    catalogImageSrc: "/images/garden/objects/shishi-odoshi/catalog/sisiodosie.png",
    stageVideoSrc: "/videos/garden/objects/shishi-odoshi/stage/sisiodosi.webm",
    price: 260,
    status: "planned",
    soundDesign: "声エネルギーを水量に見立て、一定量で竹が落ちる打撃音を合成",
    visualReaction: "溜まり -> 落下 -> 反動の周期アニメーションで反応",
    memo: "図鑑の先行登録。次フェーズでオブジェクト挙動を実装。",
  },
  {
    objectType: "kane",
    name: "鐘",
    ruby: "かね",
    icon: "kane",
    catalogImageSrc: "/images/garden/objects/kane/catalog/kanee.png",
    stageVideoSrc: "/videos/garden/objects/kane/stage/kane.webm",
    price: 300,
    status: "planned",
    soundDesign: "低域を強調した余韻で鐘の響きを模したボイス変換",
    visualReaction: "報酬タイミングで鐘の揺れを動画で再生",
    memo: "新規素材追加済み。音響チューニング待ち。",
  },
  {
    objectType: "obake",
    name: "おばけ",
    ruby: "おばけ",
    icon: "obake",
    catalogImageSrc: "/images/garden/objects/obake/catalog/obakee.png",
    stageVideoSrc: "/videos/garden/objects/obake/stage/obake.webm",
    price: 280,
    status: "planned",
    soundDesign: "フォルマント変調でふわっとした幽霊声を演出",
    visualReaction: "報酬タイミングでふわふわ移動する動画を再生",
    memo: "新規素材追加済み。ループ尺は後で最適化。",
  },
  {
    objectType: "hanabi",
    name: "花火",
    ruby: "はなび",
    icon: "hanabi",
    catalogImageSrc: "/images/garden/objects/hanabi/catalog/hanabie.png",
    stageVideoSrc: "/videos/garden/objects/hanabi/stage/hanabi.webm",
    price: 320,
    status: "planned",
    soundDesign: "声の立ち上がりを花火の打ち上げに見立て、余韻を拡張して広がりを演出",
    visualReaction: "報酬タイミングで火花のループ動画を短時間再生",
    memo: "新規素材追加済み。挙動調整は次フェーズで実施。",
  },
  {
    objectType: "tyo-tyo",
    name: "蝶々",
    ruby: "ちょうちょ",
    icon: "tyo-tyo",
    catalogImageSrc: "/images/garden/objects/tyo-tyo/catalog/tyoutyoe.png",
    stageVideoSrc: "/videos/garden/objects/tyo-tyo/stage/tyoutyo.webm",
    price: 240,
    status: "planned",
    soundDesign: "高域寄りの軽い変調で羽ばたき感を表現",
    visualReaction: "報酬タイミングで羽ばたき動画を再生",
    memo: "新規素材追加済み。移動軌道表現は次で対応。",
  },
];

export const VOICE_ZOO_ENTRY_BY_OBJECT_TYPE = Object.fromEntries(
  VOICE_ZOO_ENTRIES.map((entry) => [entry.objectType, entry]),
) as Record<ObjectType, VoiceZooEntry>;

export function getVoiceZooObjectPrice(objectType: ObjectType) {
  return VOICE_ZOO_ENTRY_BY_OBJECT_TYPE[objectType].price;
}
