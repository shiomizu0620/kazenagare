import type { ObjectType } from "@/types/garden";
import {
  MAX_PLACED_OBJECTS,
  OBJECT_PICKUP_HIT_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./empty-stage-character.constants";
import type {
  ObjectLocatorIndicator,
  PlacedStageObject,
  Vector2,
} from "./empty-stage-character.types";

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
  return value === "furin" || value === "shishi-odoshi";
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
