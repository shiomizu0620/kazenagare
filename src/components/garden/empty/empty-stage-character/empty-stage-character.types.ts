import type { ReactNode } from "react";
import type { ObjectType } from "@/types/garden";
import type { CollisionZone } from "./collision-zones";

export type EmptyStageCharacterProps = {
  children?: ReactNode;
  darkMode?: boolean;
  allowObjectPlacement?: boolean;
  placementObjectType?: ObjectType | null;
  objectStorageKey?: string;
  collisionZones?: CollisionZone[];
  initialCharacterWorldPosition?: Vector2;
  movementBounds?: WorldBounds;
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
