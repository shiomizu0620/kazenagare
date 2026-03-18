import type { ObjectType } from "@/types/garden";

export const WORLD_WIDTH = 3840;
export const WORLD_HEIGHT = 2160;

export const MOVE_MAX_SPEED = 400;
export const ACCEL_RESPONSE = 22;
export const BRAKE_RESPONSE = 14;
export const JOYSTICK_DEAD_ZONE = 0.12;
export const STICK_KNOB_SIZE = 36;
export const MAX_DELTA_SECONDS = 0.1;
export const WALK_ANIMATION_SPEED_THRESHOLD = 10;
export const MAX_PLACED_OBJECTS = 120;
export const OBJECT_PICKUP_HIT_RADIUS = 72;
export const OBJECT_PLACEMENT_HIT_RADIUS = 22;
export const CHARACTER_HITBOX_RADIUS = 16; // ~half of 32px-wide character sprite
export const MAX_CONCURRENT_COIN_POPUPS = 30;
export const MAX_CONCURRENT_AUTOPLAY_AUDIO = 8;

export const SHISHI_ODOSHI_STAGE_IMAGE_SIZE = 80;
export const OBJECT_REWARD_VIDEO_DURATION_MS = 2400;

export const OBJECT_VISUALS: Record<
  ObjectType,
  {
    imageSrc: string;
    stageVideoSrc: string;
    label: string;
    stageImageSize: number;
    stageVideoSize: number;
  }
> = {
  furin: {
    imageSrc: "/images/garden/objects/furin/catalog/huurine.png",
    stageVideoSrc: "/videos/garden/objects/furin/stage/huurin.webm",
    label: "風鈴",
    stageImageSize: 32,
    stageVideoSize: 50,
  },
  "shishi-odoshi": {
    imageSrc: "/images/garden/objects/shishi-odoshi/catalog/sisiodosie.png",
    stageVideoSrc: "/videos/garden/objects/shishi-odoshi/stage/sisiodosi.webm",
    label: "鹿威し",
    stageImageSize: SHISHI_ODOSHI_STAGE_IMAGE_SIZE,
    stageVideoSize: SHISHI_ODOSHI_STAGE_IMAGE_SIZE + 20,
  },
  hanabi: {
    imageSrc: "/images/garden/objects/hanabi/catalog/hanabie.png",
    stageVideoSrc: "/videos/garden/objects/hanabi/stage/hanabi.webm",
    label: "花火",
    stageImageSize: 48,
    stageVideoSize: 56,
  },
  kane: {
    imageSrc: "/images/garden/objects/kane/catalog/kanee.png",
    stageVideoSrc: "/videos/garden/objects/kane/stage/kane.webm",
    label: "鐘",
    stageImageSize: 52,
    stageVideoSize: 60,
  },
  obake: {
    imageSrc: "/images/garden/objects/obake/catalog/obakee.png",
    stageVideoSrc: "/videos/garden/objects/obake/stage/obake.webm",
    label: "おばけ",
    stageImageSize: 56,
    stageVideoSize: 64,
  },
  "tyo-tyo": {
    imageSrc: "/images/garden/objects/tyo-tyo/catalog/tyoutyoe.png",
    stageVideoSrc: "/videos/garden/objects/tyo-tyo/stage/tyoutyo.webm",
    label: "ちょうちょ",
    stageImageSize: 44,
    stageVideoSize: 52,
  },
  kaeru: {
    imageSrc: "/images/garden/objects/kaeru/catalog/kaerue.png",
    stageVideoSrc: "/videos/garden/objects/kaeru/stage/kaeru.webm",
    label: "かえる",
    stageImageSize: 52,
    stageVideoSize: 60,
  },
  hue: {
    imageSrc: "/images/garden/objects/hue/catalog/huee.png",
    stageVideoSrc: "/videos/garden/objects/hue/stage/hue.webm",
    label: "笛",
    stageImageSize: 52,
    stageVideoSize: 60,
  },
  suzume: {
    imageSrc: "/images/garden/objects/suzume/catalog/suzumee.png",
    stageVideoSrc: "/videos/garden/objects/suzume/stage/suzume.webm",
    label: "雀",
    stageImageSize: 48,
    stageVideoSize: 56,
  },
  sansin: {
    imageSrc: "/images/garden/objects/sansin/catalog/sansine.png",
    stageVideoSrc: "/videos/garden/objects/sansin/stage/sansin.webm",
    label: "三線",
    stageImageSize: 56,
    stageVideoSize: 64,
  },
  mattya: {
    imageSrc: "/images/garden/objects/mattya/catalog/mattyae.png",
    stageVideoSrc: "/videos/garden/objects/mattya/stage/mattya.webm",
    label: "抹茶",
    stageImageSize: 50,
    stageVideoSize: 58,
  },
  semi: {
    imageSrc: "/images/garden/objects/semi/catalog/semie.png",
    stageVideoSrc: "/videos/garden/objects/semi/stage/semi.webm",
    label: "蝉",
    stageImageSize: 50,
    stageVideoSize: 58,
  },
  takibi: {
    imageSrc: "/images/garden/objects/takibi/catalog/takibie.png",
    stageVideoSrc: "/videos/garden/objects/takibi/stage/takibi.webm",
    label: "焚き火",
    stageImageSize: 58,
    stageVideoSize: 66,
  },
  akimusi: {
    imageSrc: "/images/garden/objects/akimusi/catalog/akimusie.png",
    stageVideoSrc: "/videos/garden/objects/akimusi/stage/akimusi.webm",
    label: "秋虫",
    stageImageSize: 46,
    stageVideoSize: 54,
  },
  ka: {
    imageSrc: "/images/garden/objects/ka/catalog/kae.png",
    stageVideoSrc: "/videos/garden/objects/ka/stage/ka.webm",
    label: "蚊",
    stageImageSize: 40,
    stageVideoSize: 48,
  },
};

export const MOVEMENT_KEYS = [
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
];
