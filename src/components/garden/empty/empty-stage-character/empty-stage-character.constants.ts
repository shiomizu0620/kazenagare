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

export const OBJECT_VISUALS: Record<ObjectType, { icon: string; label: string }> = {
  furin: {
    icon: "🎐",
    label: "風鈴",
  },
  "shishi-odoshi": {
    icon: "🎋",
    label: "鹿威し",
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
