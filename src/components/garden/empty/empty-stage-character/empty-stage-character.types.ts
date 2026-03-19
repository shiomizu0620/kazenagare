import type { ReactNode } from "react";
import type { ObjectType } from "@/types/garden";
import type { CollisionZone } from "./collision-zones";

export type HitmapData = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  worldWidth: number;
  worldHeight: number;
};

export type EmptyStageCharacterProps = {
  children?: ReactNode;
  darkMode?: boolean;
  showCollisionDebug?: boolean;
  allowObjectPlacement?: boolean;
  placementObjectType?: ObjectType | null;
  objectStorageKey?: string;
  initialPlacedObjects?: PlacedStageObject[];
  audioOwnerIdOverride?: string | null;
  allowHarmonyFromVisitors?: boolean;
  collisionZones?: CollisionZone[];
  hitmapUrl?: string; // ヒットマップ画像URL
  initialCharacterWorldPosition?: Vector2;
  movementBounds?: WorldBounds;
  onGrabbedObjectIdChange?: (id: string | null) => void;
};

export type Vector2 = {
  x: number;
  y: number;
};

export type WorldBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type ObjectLocatorIndicator = {
  x: number;
  y: number;
  angleDeg: number;
};

export type PlacedStageObject = {
  id: string;
  objectType: ObjectType;
  recordingId: string | null;
  recordingUrl?: string;
  x: number;
  y: number;
  createdAt: string;
};

export type CoinRewardPopup = {
  id: string;
  objectId: string;
  objectLabel: string;
  x: number;
  y: number;
  coins: number;
};
