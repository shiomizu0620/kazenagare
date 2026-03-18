import type { ObjectType } from "@/types/garden";
import type { HitmapData } from "./empty-stage-character.types";
import {
  MAX_PLACED_OBJECTS,
  OBJECT_PICKUP_HIT_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./empty-stage-character.constants";
import type { CollisionZone } from "./collision-zones";
import type {
  ObjectLocatorIndicator,
  PlacedStageObject,
  Vector2,
} from "./empty-stage-character.types";

const MOVEMENT_HIT_RADIUS_MARGIN_PX = 1;
const MOVEMENT_HYSTERESIS_PX = 0.75;
const ANGLED_SLIDE_ANGLES_RAD = [
  Math.PI / 12,
  -Math.PI / 12,
  Math.PI / 8,
  -Math.PI / 8,
];

/**
 * キャラクター（円）とコリジョンゾーンが重なっているか判定する
 */
export function collidesWithZone(
  worldX: number,
  worldY: number,
  characterRadius: number,
  zone: CollisionZone,
): boolean {
  if (zone.type === "rect") {
    // AABB vs Circle
    const nearestX = clamp(worldX, zone.x, zone.x + zone.width);
    const nearestY = clamp(worldY, zone.y, zone.y + zone.height);
    const dx = worldX - nearestX;
    const dy = worldY - nearestY;
    return dx * dx + dy * dy < characterRadius * characterRadius;
  }
  // Circle vs Circle
  const dx = worldX - zone.cx;
  const dy = worldY - zone.cy;
  const minDist = characterRadius + zone.radius;
  return dx * dx + dy * dy < minDist * minDist;
}

export function isBlockedByCollisionZones(
  worldX: number,
  worldY: number,
  hitRadius: number,
  zones: CollisionZone[],
): boolean {
  return zones.some((zone) => collidesWithZone(worldX, worldY, hitRadius, zone));
}

export function isBlockedByHitmap(
  worldX: number,
  worldY: number,
  hitRadius: number,
  hitmap: HitmapData | null,
): boolean {
  if (!hitmap) {
    return false;
  }

  // 中心と周囲8方向をチェックし、1つでもブロックされていたら壁と判定
  const checkOffsets = [
    { x: 0, y: 0 },
    { x: -hitRadius, y: 0 },
    { x: hitRadius, y: 0 },
    { x: 0, y: -hitRadius },
    { x: 0, y: hitRadius },
    { x: -hitRadius * 0.7, y: -hitRadius * 0.7 },
    { x: hitRadius * 0.7, y: -hitRadius * 0.7 },
    { x: -hitRadius * 0.7, y: hitRadius * 0.7 },
    { x: hitRadius * 0.7, y: hitRadius * 0.7 },
  ];

  for (const offset of checkOffsets) {
    const cx = worldX + offset.x;
    const cy = worldY + offset.y;

    const mapX = Math.floor((cx / hitmap.worldWidth) * hitmap.width);
    const mapY = Math.floor((cy / hitmap.worldHeight) * hitmap.height);

    // 画面外はブロック扱い
    if (mapX < 0 || mapX >= hitmap.width || mapY < 0 || mapY >= hitmap.height) {
      return true;
    }

    const idx = (mapY * hitmap.width + mapX) * 4;
    const alpha = hitmap.data[idx + 3];

    // 何か描画されている（不透明度が1以上）なら壁とみなす
    // ※ 透過 PNG に黒などで境界を描く想定
    if (alpha > 0) {
      return true;
    }
  }

  return false;
}

/**
 * 移動後の位置にコリジョンがある場合、軸ごとにスライドを試みて
 * 通れる方向の最終オフセットを返す（壁ずりあり）
 * desiredOffset はワールド中心からのオフセット座標
 */
export function resolveMovement(
  currentDesiredOffset: Vector2,
  nextDesiredOffset: Vector2,
  zones: CollisionZone[],
  characterRadius: number,
  hitmap: HitmapData | null = null,
): Vector2 {
  if (zones.length === 0 && !hitmap) {
    return nextDesiredOffset;
  }

  const cx = WORLD_WIDTH / 2;
  const cy = WORLD_HEIGHT / 2;
  const movementHitRadius = Math.max(1, characterRadius - MOVEMENT_HIT_RADIUS_MARGIN_PX);
  const enterHitRadius = movementHitRadius;
  const releaseHitRadius = Math.max(1, movementHitRadius - MOVEMENT_HYSTERESIS_PX);

  const isBlockedWithRadius = (ox: number, oy: number, hitRadius: number) => {
    const worldX = cx + ox;
    const worldY = cy + oy;
    if (isBlockedByHitmap(worldX, worldY, hitRadius, hitmap)) {
      return true;
    }
    return isBlockedByCollisionZones(worldX, worldY, hitRadius, zones);
  };

  const isBlocked = (
    ox: number,
    oy: number,
    referenceOffset: Vector2,
  ) => {
    const blockedAtEnter = isBlockedWithRadius(ox, oy, enterHitRadius);
    if (blockedAtEnter) {
      return true;
    }

    // Release radius is slightly smaller to prevent rapid blocked/unblocked jitter.
    const blockedAtRelease = isBlockedWithRadius(ox, oy, releaseHitRadius);
    if (!blockedAtRelease) {
      return false;
    }

    // Keep previous state in the narrow band between enter/release thresholds.
    return isBlockedWithRadius(referenceOffset.x, referenceOffset.y, enterHitRadius);
  };

  // そもそも現在地が衝突中なら制限しない（はまり防止）
  if (isBlocked(currentDesiredOffset.x, currentDesiredOffset.y, currentDesiredOffset)) {
    return nextDesiredOffset;
  }

  const totalDeltaX = nextDesiredOffset.x - currentDesiredOffset.x;
  const totalDeltaY = nextDesiredOffset.y - currentDesiredOffset.y;
  const totalDistance = Math.hypot(totalDeltaX, totalDeltaY);

  // 1フレーム移動を分割して判定することで壁際の引っ掛かりを減らす
  const maxStepDistance = Math.max(2, characterRadius * 0.35);
  const stepCount = Math.max(1, Math.ceil(totalDistance / maxStepDistance));
  const incrementalDeltaX = totalDeltaX / stepCount;
  const incrementalDeltaY = totalDeltaY / stepCount;

  let resolved = { x: currentDesiredOffset.x, y: currentDesiredOffset.y };

  for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
    const targetX = resolved.x + incrementalDeltaX;
    const targetY = resolved.y + incrementalDeltaY;

    // 全軸移動を優先
    if (!isBlocked(targetX, targetY, resolved)) {
      resolved = { x: targetX, y: targetY };
      continue;
    }

    const stepDeltaX = targetX - resolved.x;
    const stepDeltaY = targetY - resolved.y;
    const prioritizeX = Math.abs(stepDeltaX) >= Math.abs(stepDeltaY);

    // 主軸→副軸の順でスライドを試し、通る方を採用
    if (prioritizeX) {
      if (!isBlocked(targetX, resolved.y, resolved)) {
        resolved = { x: targetX, y: resolved.y };
        continue;
      }

      if (!isBlocked(resolved.x, targetY, resolved)) {
        resolved = { x: resolved.x, y: targetY };
      }
      continue;
    }

    if (!isBlocked(resolved.x, targetY, resolved)) {
      resolved = { x: resolved.x, y: targetY };
      continue;
    }

    if (!isBlocked(targetX, resolved.y, resolved)) {
      resolved = { x: targetX, y: resolved.y };
      continue;
    }

    const stepMagnitude = Math.hypot(stepDeltaX, stepDeltaY);
    if (stepMagnitude <= 0.0001) {
      continue;
    }

    // 斜め境界に対しては入力方向を少し回転させた候補を試し、単方向入力でも壁沿いに滑りやすくする
    const baseStepX = stepDeltaX / stepMagnitude;
    const baseStepY = stepDeltaY / stepMagnitude;

    for (const angleRad of ANGLED_SLIDE_ANGLES_RAD) {
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
      const rotatedStepX = (baseStepX * cos - baseStepY * sin) * stepMagnitude;
      const rotatedStepY = (baseStepX * sin + baseStepY * cos) * stepMagnitude;
      const rotatedTargetX = resolved.x + rotatedStepX;
      const rotatedTargetY = resolved.y + rotatedStepY;

      if (!isBlocked(rotatedTargetX, rotatedTargetY, resolved)) {
        resolved = { x: rotatedTargetX, y: rotatedTargetY };
        break;
      }
    }
  }

  return resolved;
}

type LocatorIndicatorInput = {
  stageSize: Vector2;
  cameraOffset: Vector2;
  targetWorldPosition: Vector2;
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function toUnitDirection(vector: Vector2, deadZone = 0): Vector2 {
  const magnitude = Math.hypot(vector.x, vector.y);

  if (magnitude <= deadZone) {
    return { x: 0, y: 0 };
  }

  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
  };
}

export function limitVectorMagnitude(vector: Vector2, maxMagnitude: number): Vector2 {
  const magnitude = Math.hypot(vector.x, vector.y);

  if (magnitude === 0 || magnitude <= maxMagnitude) {
    return vector;
  }

  const ratio = maxMagnitude / magnitude;

  return {
    x: vector.x * ratio,
    y: vector.y * ratio,
  };
}

export function getInputAxis(keys: Set<string>) {
  let horizontal = 0;
  let vertical = 0;

  if (keys.has("a") || keys.has("arrowleft")) {
    horizontal -= 1;
  }

  if (keys.has("d") || keys.has("arrowright")) {
    horizontal += 1;
  }

  if (keys.has("w") || keys.has("arrowup")) {
    vertical -= 1;
  }

  if (keys.has("s") || keys.has("arrowdown")) {
    vertical += 1;
  }

  if (horizontal === 0 && vertical === 0) {
    return { x: 0, y: 0 };
  }

  const magnitude = Math.hypot(horizontal, vertical);

  return {
    x: horizontal / magnitude,
    y: vertical / magnitude,
  };
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
    value === "ka"
  );
}

function isPlacedStageObject(value: unknown): value is PlacedStageObject {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PlacedStageObject>;

  return (
    typeof candidate.id === "string" &&
    isObjectType(candidate.objectType) &&
    typeof candidate.x === "number" &&
    Number.isFinite(candidate.x) &&
    typeof candidate.y === "number" &&
    Number.isFinite(candidate.y) &&
    (typeof candidate.recordingId === "string" || candidate.recordingId === null ||
      candidate.recordingId === undefined) &&
    (typeof candidate.recordingUrl === "string" || candidate.recordingUrl === undefined) &&
    typeof candidate.createdAt === "string"
  );
}

export function parseStoredObjects(rawValue: string | null): PlacedStageObject[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isPlacedStageObject)
      .slice(-MAX_PLACED_OBJECTS)
      .map((item) => ({
        ...item,
        recordingId: typeof item.recordingId === "string" ? item.recordingId : null,
        recordingUrl: typeof item.recordingUrl === "string" ? item.recordingUrl : undefined,
      }));
  } catch {
    return [];
  }
}

export function isNearPlacedObject(
  targetPosition: Vector2 | null,
  placedObject: PlacedStageObject | null,
): boolean {
  if (!targetPosition || !placedObject) {
    return false;
  }

  return (
    Math.hypot(
      targetPosition.x - placedObject.x,
      targetPosition.y - placedObject.y,
    ) <= OBJECT_PICKUP_HIT_RADIUS
  );
}

export function calculateObjectLocatorIndicator({
  stageSize,
  cameraOffset,
  targetWorldPosition,
}: LocatorIndicatorInput): ObjectLocatorIndicator | null {
  const stageWidth = stageSize.x;
  const stageHeight = stageSize.y;

  if (stageWidth <= 0 || stageHeight <= 0) {
    return null;
  }

  const viewCenterWorldX = WORLD_WIDTH * 0.5 + cameraOffset.x;
  const viewCenterWorldY = WORLD_HEIGHT * 0.5 + cameraOffset.y;
  const deltaX = targetWorldPosition.x - viewCenterWorldX;
  const deltaY = targetWorldPosition.y - viewCenterWorldY;
  const targetScreenX = stageWidth * 0.5 + deltaX;
  const targetScreenY = stageHeight * 0.5 + deltaY;
  const distance = Math.hypot(deltaX, deltaY);

  const inViewMargin = 18;
  const isTargetVisibleInView =
    targetScreenX >= inViewMargin &&
    targetScreenX <= stageWidth - inViewMargin &&
    targetScreenY >= inViewMargin &&
    targetScreenY <= stageHeight - inViewMargin;

  if (isTargetVisibleInView) {
    const anchorDistance = distance < 0.001 ? 58 : 64;
    const directionFromObjectX = distance < 0.001 ? 0 : -deltaX / distance;
    const directionFromObjectY = distance < 0.001 ? -1 : -deltaY / distance;
    const indicatorX = clamp(
      targetScreenX + directionFromObjectX * anchorDistance,
      28,
      stageWidth - 28,
    );
    const indicatorY = clamp(
      targetScreenY + directionFromObjectY * anchorDistance,
      28,
      stageHeight - 28,
    );
    const towardObjectX = targetScreenX - indicatorX;
    const towardObjectY = targetScreenY - indicatorY;

    return {
      x: indicatorX,
      y: indicatorY,
      angleDeg: (Math.atan2(towardObjectY, towardObjectX) * 180) / Math.PI + 90,
    };
  }

  if (distance < 0.001) {
    return {
      x: stageWidth * 0.5,
      y: 40,
      angleDeg: 0,
    };
  }

  const unitX = deltaX / distance;
  const unitY = deltaY / distance;
  const edgeMargin = 38;
  const horizontalLimit = Math.max(8, stageWidth * 0.5 - edgeMargin);
  const verticalLimit = Math.max(8, stageHeight * 0.5 - edgeMargin);
  const scaleToEdge = Math.min(
    horizontalLimit / Math.max(Math.abs(unitX), 0.0001),
    verticalLimit / Math.max(Math.abs(unitY), 0.0001),
  );

  return {
    x: stageWidth * 0.5 + unitX * scaleToEdge,
    y: stageHeight * 0.5 + unitY * scaleToEdge,
    angleDeg: (Math.atan2(unitY, unitX) * 180) / Math.PI + 90,
  };
}
