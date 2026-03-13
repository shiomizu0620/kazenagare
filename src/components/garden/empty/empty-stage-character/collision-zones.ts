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

// 背景IDをキーにしたゾーン定義
// 新しい背景を追加したときはここにエントリを足すだけでOK
export const COLLISION_ZONES: Record<string, CollisionZone[]> = {
  "bamboo-forest": [
    // 座標は WORLD_WIDTH=3840, WORLD_HEIGHT=2160 基準
    // 例: { type: "circle", label: "池", cx: 1920, cy: 1400, radius: 220 },
  ],
  "night-pond": [
    // 例: { type: "circle", label: "夜の池", cx: 1920, cy: 1100, radius: 400 },
  ],
  "misty-temple": [
    // 例: { type: "rect", label: "本堂", x: 1520, y: 400, width: 800, height: 460 },
  ],
  "garden-all": [
    // 庭.png に合わせてここにゾーンを追加してください
    // 例: { type: "circle", label: "池", cx: 1920, cy: 1350, radius: 340 },
    // 例: { type: "rect", label: "建物", x: 300, y: 600, width: 80, height: 600 },
  ],
};
