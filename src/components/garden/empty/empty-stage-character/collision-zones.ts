// 当たり判定ゾーンの型定義
// すべての座標はワールド座標（WORLD_WIDTH=3840, WORLD_HEIGHT=2160 基準）

export type RectCollisionZone = {
  type: "rect";
  label?: string; // デバッグ用ラベル
  x: number;      // 左端
  y: number;      // 上端
  width: number;
  height: number;
};

export type CircleCollisionZone = {
  type: "circle";
  label?: string;
  cx: number;
  cy: number;
  radius: number;
};

export type CollisionZone = RectCollisionZone | CircleCollisionZone;

const COMMON_GARDEN_COLLISION_ZONES: CollisionZone[] = [
  // == 絶対進入不可な大枠の矩形（画面外や完全な壁） ==
  { type: "rect", label: "上端全体（遠景）", x: 0, y: 0, width: 3840, height: 350 },
  { type: "rect", label: "左下枠（手前の竹林）", x: 0, y: 1550, width: 500, height: 610 },
  { type: "rect", label: "右端枠（社殿右〜池全体）", x: 2800, y: 0, width: 1040, height: 2160 },
  { type: "rect", label: "下端左（画面外）", x: 0, y: 2000, width: 1800, height: 160 },
  { type: "rect", label: "下端右（画面外）", x: 2400, y: 2000, width: 1440, height: 160 },

  // == 青ハッチ外周に沿った円（有機的な境界線を作る） ==
  
  // 1. 左上（画面左から橋の上部、川の左岸）
  { type: "circle", label: "左上道上1", cx: 200, cy: 500, radius: 450 },
  { type: "circle", label: "左上道上2", cx: 550, cy: 550, radius: 400 },
  { type: "circle", label: "左上道上3", cx: 850, cy: 650, radius: 350 },
  { type: "circle", label: "橋の左上", cx: 1100, cy: 750, radius: 300 },

  // 2. 中央上部（川・橋の右上から社殿への階段の左手）
  { type: "circle", label: "川の中流", cx: 1350, cy: 650, radius: 400 },
  { type: "circle", label: "川の右岸", cx: 1650, cy: 650, radius: 400 },
  { type: "circle", label: "階段左竹林1", cx: 1950, cy: 550, radius: 350 },
  { type: "circle", label: "階段左竹林2", cx: 2200, cy: 500, radius: 300 },
  { type: "circle", label: "鳥居の左奥", cx: 2400, cy: 450, radius: 300 },

  // 3. 右側（社殿・鳥居の右側から、池にかけてのブロック）
  { type: "circle", label: "社殿左（鳥居右）", cx: 2750, cy: 600, radius: 300 },
  { type: "circle", label: "道右側の竹林1", cx: 2850, cy: 950, radius: 350 },
  { type: "circle", label: "道右側の竹林2", cx: 2800, cy: 1250, radius: 350 },
  { type: "circle", label: "道右側の竹林3", cx: 2750, cy: 1550, radius: 350 },
  { type: "circle", label: "池の左上", cx: 2650, cy: 1800, radius: 300 },
  { type: "circle", label: "池の左下", cx: 2500, cy: 1950, radius: 300 },

  // 4. 左下（画面左側から橋の下、中央へ続く道の下側）
  { type: "circle", label: "左下道下1", cx: 200, cy: 1350, radius: 450 },
  { type: "circle", label: "左下道下2", cx: 550, cy: 1450, radius: 400 },
  { type: "circle", label: "橋の左下", cx: 850, cy: 1550, radius: 400 },
  { type: "circle", label: "橋の右下", cx: 1150, cy: 1650, radius: 350 },
  { type: "circle", label: "道の左下1", cx: 1450, cy: 1800, radius: 350 },
  { type: "circle", label: "道の左下2", cx: 1700, cy: 1950, radius: 350 },
  { type: "circle", label: "道の左下3", cx: 1900, cy: 2050, radius: 300 },
];

// 背景IDをキーにしたゾーン定義
// 新しい背景を追加したときはここにエントリを足すだけでOK
export const COLLISION_ZONES: Record<string, CollisionZone[]> = {
  "bamboo-forest": COMMON_GARDEN_COLLISION_ZONES,
  "night-pond": COMMON_GARDEN_COLLISION_ZONES,
  "misty-temple": COMMON_GARDEN_COLLISION_ZONES,
  "garden-all": COMMON_GARDEN_COLLISION_ZONES,
};
