"use client";

import { get, set } from "idb-keyval";
import { usePathname } from "next/navigation";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_KAZENAGARE_AUDIO_SETTINGS,
  type KazenagareAudioSettings,
  KAZENAGARE_AUDIO_SETTINGS_EVENT,
  KAZENAGARE_AUDIO_SETTINGS_STORAGE_KEY,
  loadKazenagareAudioSettings,
  parseKazenagareAudioSettings,
} from "@/lib/audio/settings";
import {
  KAZENAGARE_AUDIO_SUPPRESSION_EVENT,
  type KazenagareAudioSuppressionDetail,
} from "@/lib/audio/suppression";
import {
  createGardenCharacterPositionStorageKey,
  parseGardenCharacterPosition,
} from "@/lib/garden/character-position";
import { getSupabaseClient, getSupabaseSessionOrNull } from "@/lib/supabase/client";
import { getVoiceZooObjectPrice } from "@/lib/voice-zoo/catalog";
import { applyVoiceZooPlaybackEffect } from "@/lib/voice-zoo/playback-effects";
import {
  createGardenHarmonyRecordingId,
  createVoiceZooRecordingId,
  getGardenHarmonyRecordingBlobStorageKey,
  getGardenHarmonyRecordingCatalogStorageKey,
  type GardenHarmonyRecordingMeta,
  getLatestRecordingIdByObjectType,
  getVoiceZooLegacyRecordingStorageKey,
  getVoiceZooRecordingBlobStorageKey,
  getVoiceZooRecordingCatalogStorageKey,
  parseGardenHarmonyRecordingCatalog,
  parseVoiceZooRecordingCatalog,
  VOICE_ZOO_RECORDING_UPDATED_EVENT,
  type VoiceZooRecordingUpdatedEventDetail,
  VOICE_ZOO_SUPPORTED_OBJECT_TYPES,
} from "@/lib/voice-zoo/recordings";
import {
  calculatePlaybackRewardCoins,
  getVoiceZooWalletStorageKey,
  loadVoiceZooWallet,
  parseVoiceZooWallet,
  saveVoiceZooWallet,
  type VoiceZooWalletUpdatedEventDetail,
  VOICE_ZOO_WALLET_UPDATED_EVENT,
} from "@/lib/voice-zoo/wallet";
import type { ObjectType } from "@/types/garden";
import {
  ACCEL_RESPONSE,
  BRAKE_RESPONSE,
  CHARACTER_HITBOX_RADIUS,
  JOYSTICK_DEAD_ZONE,
  MAX_DELTA_SECONDS,
  MAX_PLACED_OBJECTS,
  MAX_CONCURRENT_COIN_POPUPS,
  MAX_CONCURRENT_AUTOPLAY_AUDIO,
  OBJECT_PLACEMENT_HIT_RADIUS,
  MOVE_MAX_SPEED,
  MOVEMENT_KEYS,
  OBJECT_VISUALS,
  OBJECT_REWARD_VIDEO_DURATION_MS,
  STICK_KNOB_SIZE,
  WALK_ANIMATION_SPEED_THRESHOLD,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./empty-stage-character.constants";
import type {
  CoinRewardPopup,
  EmptyStageCharacterProps,
  PlacedStageObject,
  Vector2,
  WorldBounds,
} from "./empty-stage-character.types";
import {
  clamp,
  getInputAxis,
  isNearPlacedObject,
  isBlockedByCollisionZones,
  isBlockedByHitmap,
  limitVectorMagnitude,
  resolveMovement,
  toUnitDirection,
} from "./empty-stage-character.utils";
import { EmptyStageCharacterStage } from "./empty-stage-character-stage";
import { EmptyStageCharacterControls } from "./empty-stage-character-controls";
import { useEmptyStageObjectLocator } from "./use-empty-stage-object-locator";
import { useEmptyStageStoredObjects } from "./use-empty-stage-stored-objects";
import { useHitmap } from "./use-hitmap";
import type { HitmapData } from "./empty-stage-character.types";

export { WORLD_HEIGHT, WORLD_WIDTH };

const AUTO_PLAYBACK_MIN_DELAY_MS = 2800;
const AUTO_PLAYBACK_MAX_DELAY_MS = 4800;
const AUTO_PLAYBACK_SCHEDULER_TICK_MS = 220;
const COIN_POPUP_DURATION_MS = 1200;
const WALLET_GAIN_POPUP_DURATION_MS = 1050;
const PLACEMENT_BLOCKED_NOTICE_DURATION_MS = 1400;
const AUTO_PLAYBACK_DISTANCE_NEAR_PX = 130;
const AUTO_PLAYBACK_DISTANCE_FAR_PX = 760;
const AUTO_PLAYBACK_DISTANCE_MIN_GAIN = 0.04;
const CHARACTER_POSITION_SAVE_INTERVAL_MS = 900;
const CHARACTER_WALK_FRAME_INTERVAL_MS = 220;
const CHARACTER_IDLE_IMAGE_SRC = "/images/garden/characters/猫1.png";
const CHARACTER_WALK_IMAGE_SRC = "/images/garden/characters/猫2.png";
const CHARACTER_IDLE_IMAGE_SIZE_PX = 80;
const CHARACTER_WALK_IMAGE_SIZE_PX = 64;
const HARMONY_RECORDING_DURATION_SECONDS = 3;
const HARMONY_LAYER_VOLUME_RATIO = 0.74;
const HARMONY_LAYER_PLAYBACK_RATE_OFFSET = 0.06;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CompatibleAudioContextWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

type PlacementAttemptResult = "placed" | "blocked" | "skipped";

type PlacementBlockedNotice = {
  id: string;
  message: string;
  position: Vector2;
};

type HarmonyRecordingModalState = {
  objectId: string;
  objectType: ObjectType;
  objectLabel: string;
};

type LoadedHarmonyRecording = GardenHarmonyRecordingMeta & {
  blob: Blob;
};

type CharacterFacingDirection =
  | "right"
  | "down-right"
  | "down"
  | "down-left"
  | "left"
  | "up-left"
  | "up"
  | "up-right";

type CharacterHorizontalFacing = "left" | "right";

const HORIZONTAL_FACING_EPSILON = 0.5;

function resolveCharacterFacingDirection(velocity: Vector2): CharacterFacingDirection {
  const angle = Math.atan2(velocity.y, velocity.x);
  const normalized = (angle + Math.PI * 2) % (Math.PI * 2);
  const octant = Math.round(normalized / (Math.PI / 4)) % 8;

  switch (octant) {
    case 0:
      return "right";
    case 1:
      return "down-right";
    case 2:
      return "down";
    case 3:
      return "down-left";
    case 4:
      return "left";
    case 5:
      return "up-left";
    case 6:
      return "up";
    default:
      return "up-right";
  }
}

function getAudioContextConstructor() {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.AudioContext ??
    (window as CompatibleAudioContextWindow).webkitAudioContext ??
    null
  );
}

function getDistanceAttenuationGain(distancePx: number) {
  if (distancePx <= AUTO_PLAYBACK_DISTANCE_NEAR_PX) {
    return 1;
  }

  if (distancePx >= AUTO_PLAYBACK_DISTANCE_FAR_PX) {
    return AUTO_PLAYBACK_DISTANCE_MIN_GAIN;
  }

  const normalizedDistance =
    (distancePx - AUTO_PLAYBACK_DISTANCE_NEAR_PX) /
    (AUTO_PLAYBACK_DISTANCE_FAR_PX - AUTO_PLAYBACK_DISTANCE_NEAR_PX);
  const easedDistance =
    normalizedDistance * normalizedDistance * (3 - 2 * normalizedDistance);

  return 1 - (1 - AUTO_PLAYBACK_DISTANCE_MIN_GAIN) * easedDistance;
}

function getRandomPlaybackDelayMs() {
  return Math.floor(
    AUTO_PLAYBACK_MIN_DELAY_MS +
      Math.random() * (AUTO_PLAYBACK_MAX_DELAY_MS - AUTO_PLAYBACK_MIN_DELAY_MS),
  );
}

const DEFAULT_WORLD_BOUNDS: WorldBounds = {
  minX: 0,
  maxX: WORLD_WIDTH,
  minY: 0,
  maxY: WORLD_HEIGHT,
};

function toCharacterOffset(worldPosition?: Vector2 | null, movementBounds: WorldBounds = DEFAULT_WORLD_BOUNDS): Vector2 {
  if (!worldPosition) {
    return { x: 0, y: 0 };
  }

  const clampedMinX = Math.min(movementBounds.minX, movementBounds.maxX);
  const clampedMaxX = Math.max(movementBounds.minX, movementBounds.maxX);
  const clampedMinY = Math.min(movementBounds.minY, movementBounds.maxY);
  const clampedMaxY = Math.max(movementBounds.minY, movementBounds.maxY);
  const minWorldX = clampedMinX + CHARACTER_HITBOX_RADIUS;
  const maxWorldX = clampedMaxX - CHARACTER_HITBOX_RADIUS;
  const minWorldY = clampedMinY + CHARACTER_HITBOX_RADIUS;
  const maxWorldY = clampedMaxY - CHARACTER_HITBOX_RADIUS;
  const clampedWorldX = clamp(worldPosition.x, minWorldX, Math.max(minWorldX, maxWorldX));
  const clampedWorldY = clamp(worldPosition.y, minWorldY, Math.max(minWorldY, maxWorldY));

  return {
    x: clampedWorldX - WORLD_WIDTH * 0.5,
    y: clampedWorldY - WORLD_HEIGHT * 0.5,
  };
}

function toCharacterWorldPosition(
  offset: Vector2,
  movementBounds: WorldBounds = DEFAULT_WORLD_BOUNDS,
): Vector2 {
  const clampedMinX = Math.min(movementBounds.minX, movementBounds.maxX);
  const clampedMaxX = Math.max(movementBounds.minX, movementBounds.maxX);
  const clampedMinY = Math.min(movementBounds.minY, movementBounds.maxY);
  const clampedMaxY = Math.max(movementBounds.minY, movementBounds.maxY);
  const minWorldX = clampedMinX + CHARACTER_HITBOX_RADIUS;
  const maxWorldX = clampedMaxX - CHARACTER_HITBOX_RADIUS;
  const minWorldY = clampedMinY + CHARACTER_HITBOX_RADIUS;
  const maxWorldY = clampedMaxY - CHARACTER_HITBOX_RADIUS;

  return {
    x: Math.round(
      clamp(WORLD_WIDTH * 0.5 + offset.x, minWorldX, Math.max(minWorldX, maxWorldX)),
    ),
    y: Math.round(
      clamp(WORLD_HEIGHT * 0.5 + offset.y, minWorldY, Math.max(minWorldY, maxWorldY)),
    ),
  };
}

export function EmptyStageCharacter({
  children,
  darkMode = false,
  allowObjectPlacement = false,
  placementObjectType = null,
  objectStorageKey,
  initialPlacedObjects = [],
  audioOwnerIdOverride = null,
  allowHarmonyFromVisitors = true,
  initialCharacterWorldPosition,
  movementBounds = DEFAULT_WORLD_BOUNDS,
  collisionZones = [],
  hitmapUrl,
  onGrabbedObjectIdChange,
}: EmptyStageCharacterProps) {
  const initialCharacterOffset = useMemo(
    () => toCharacterOffset(initialCharacterWorldPosition, movementBounds),
    [initialCharacterWorldPosition, movementBounds],
  );
  const pathname = usePathname();
  const [isCoarsePointer, setIsCoarsePointer] = useState(() =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches,
  );
  const isReadonlyVisitorGarden = !allowObjectPlacement && Boolean(audioOwnerIdOverride);
  const canAcceptHarmonyFromVisitors =
    isReadonlyVisitorGarden && allowHarmonyFromVisitors;
  const shouldUseMobileLightweightMode = isReadonlyVisitorGarden && isCoarsePointer;
  const hitmapData = useHitmap(
    shouldUseMobileLightweightMode ? undefined : hitmapUrl,
    WORLD_WIDTH,
    WORLD_HEIGHT,
  );
  const hitmapRef = useRef<HitmapData | null>(null);
  const [audioOwnerId, setAudioOwnerId] = useState<string>("local_guest");
  const [viewerId, setViewerId] = useState<string>("local_guest");
  const resolvedStorageKey = objectStorageKey
    ? `${objectStorageKey}_${audioOwnerId}`
    : null;
  const [isWalking, setIsWalking] = useState(false);
  const [isCharacterWalkFrame, setIsCharacterWalkFrame] = useState(false);
  const [characterFacingDirection, setCharacterFacingDirection] =
    useState<CharacterFacingDirection>("right");
  const [characterHorizontalFacing, setCharacterHorizontalFacing] =
    useState<CharacterHorizontalFacing>("right");
  const [placedObjects, setPlacedObjects] = useState<PlacedStageObject[]>(() =>
    resolvedStorageKey ? [] : initialPlacedObjects,
  );
  const [grabbedObjectId, setGrabbedObjectId] = useState<string | null>(null);
  const [grabbedObjectType, setGrabbedObjectType] = useState<ObjectType | null>(null);
  const [pointerWorldPosition, setPointerWorldPosition] = useState<Vector2 | null>(null);
  const [isTouchPlacementArmed, setIsTouchPlacementArmed] = useState(false);
  const [isMousePlacementArmed, setIsMousePlacementArmed] = useState(false);
  const [stageViewportSize, setStageViewportSize] = useState<Vector2>({ x: 0, y: 0 });
  const [coinRewardPopups, setCoinRewardPopups] = useState<CoinRewardPopup[]>([]);
  const [walletCoins, setWalletCoins] = useState(0);
  const [walletGainPopup, setWalletGainPopup] = useState<{ id: string; coins: number } | null>(
    null,
  );
  const [placementBlockedNotice, setPlacementBlockedNotice] =
    useState<PlacementBlockedNotice | null>(null);
  const [rewardVideoPlaybackByObjectId, setRewardVideoPlaybackByObjectId] = useState<
    Record<string, number>
  >({});
  const [characterVoiceVolume, setCharacterVoiceVolume] = useState(
    DEFAULT_KAZENAGARE_AUDIO_SETTINGS.characterVoiceVolume,
  );
  const [isAudioSuppressed, setIsAudioSuppressed] = useState(false);
  const [recordingReloadNonce, setRecordingReloadNonce] = useState(0);
  const [recordingBlobByRecordingId, setRecordingBlobByRecordingId] = useState<
    Record<string, Blob>
  >({});
  const [latestRecordingIdByObjectType, setLatestRecordingIdByObjectType] = useState<
    Partial<Record<ObjectType, string>>
  >({});
  const [harmonyRecordingIdByObjectId, setHarmonyRecordingIdByObjectId] =
    useState<Record<string, string>>({});
  const [harmonyRecordingBlobByObjectId, setHarmonyRecordingBlobByObjectId] =
    useState<Record<string, Blob>>({});
  const [harmonyRecordingModal, setHarmonyRecordingModal] =
    useState<HarmonyRecordingModalState | null>(null);
  const [isHarmonyRecording, setIsHarmonyRecording] = useState(false);
  const [harmonyRecordingCountdown, setHarmonyRecordingCountdown] =
    useState(HARMONY_RECORDING_DURATION_SECONDS);
  const [harmonyRecordingNotice, setHarmonyRecordingNotice] = useState<string | null>(null);
  const [harmonyPreviewOwnerBlob, setHarmonyPreviewOwnerBlob] = useState<Blob | null>(null);
  const [harmonyPreviewOwnerAudioUrl, setHarmonyPreviewOwnerAudioUrl] =
    useState<string | null>(null);
  const [harmonyPreviewLayerAudioUrl, setHarmonyPreviewLayerAudioUrl] =
    useState<string | null>(null);
  const [isHarmonyDualPreviewPlaying, setIsHarmonyDualPreviewPlaying] = useState(false);
  const [hasCompletedHarmonyRecording, setHasCompletedHarmonyRecording] = useState(false);
  const harmonyPreviewLayerBlob = harmonyRecordingModal
    ? harmonyRecordingBlobByObjectId[harmonyRecordingModal.objectId] ?? null
    : null;
  const stageRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const characterRef = useRef<HTMLDivElement | null>(null);
  const stickPadRef = useRef<HTMLDivElement | null>(null);
  const stickKnobRef = useRef<HTMLDivElement | null>(null);
  const walkingRef = useRef(false);
  const characterFacingDirectionRef = useRef<CharacterFacingDirection>("right");
  const characterHorizontalFacingRef = useRef<CharacterHorizontalFacing>("right");
  const stickPointerIdRef = useRef<number | null>(null);
  const stageSizeRef = useRef<Vector2>({ x: 0, y: 0 });
  const cameraOffsetRef = useRef<Vector2>(initialCharacterOffset);
  const desiredOffsetRef = useRef<Vector2>(initialCharacterOffset);
  const velocityRef = useRef<Vector2>({ x: 0, y: 0 });
  const previousTimestampRef = useRef(0);
  const animationFrameRef = useRef(0);
  const activeKeysRef = useRef<Set<string>>(new Set());
  const joystickVectorRef = useRef<Vector2>({ x: 0, y: 0 });
  const placedObjectsRef = useRef<PlacedStageObject[]>([]);
  const recordingBlobByRecordingIdRef = useRef<Record<string, Blob>>({});
  const latestRecordingIdByObjectTypeRef = useRef<Partial<Record<ObjectType, string>>>({});
  const harmonyRecordingIdByObjectIdRef = useRef<Record<string, string>>({});
  const harmonyRecordingBlobByObjectIdRef = useRef<Record<string, Blob>>({});
  const characterVoiceVolumeRef = useRef(characterVoiceVolume);
  const isAudioSuppressedRef = useRef(false);
  const autoPlaybackSchedulerTimerRef = useRef<number | null>(null);
  const autoPlaybackNextAtByObjectIdRef = useRef<Record<string, number>>({});
  const autoPlaybackAudioByObjectIdRef = useRef<Record<string, HTMLAudioElement>>({});
  const autoPlaybackHarmonyAudioByObjectIdRef = useRef<Record<string, HTMLAudioElement>>({});
  const autoPlaybackAudioContextRef = useRef<AudioContext | null>(null);
  const autoPlaybackSourceNodeByObjectIdRef = useRef<
    Record<string, MediaElementAudioSourceNode>
  >({});
  const autoPlaybackGainNodeByObjectIdRef = useRef<Record<string, GainNode>>({});
  const autoPlaybackAudioUrlByObjectIdRef = useRef<Record<string, string>>({});
  const autoPlaybackHarmonyAudioUrlByObjectIdRef = useRef<Record<string, string>>({});
  const autoPlaybackInFlightObjectIdsRef = useRef<Set<string>>(new Set());
  const harmonyRecordingMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const harmonyRecordingStreamRef = useRef<MediaStream | null>(null);
  const harmonyRecordingWaveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const harmonyRecordingWaveformAudioContextRef = useRef<AudioContext | null>(null);
  const harmonyRecordingWaveformAnimationFrameRef = useRef<number | null>(null);
  const harmonyRecordingChunksRef = useRef<Blob[]>([]);
  const harmonyRecordingStopTimerRef = useRef<number | null>(null);
  const harmonyRecordingCountdownTimerRef = useRef<number | null>(null);
  const harmonyDualPreviewOwnerAudioRef = useRef<HTMLAudioElement | null>(null);
  const harmonyDualPreviewLayerAudioRef = useRef<HTMLAudioElement | null>(null);
  const harmonyOwnerPreviewAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const harmonyLayerPreviewAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const harmonyPreviewOwnerAudioUrlRef = useRef<string | null>(null);
  const harmonyPreviewLayerAudioUrlRef = useRef<string | null>(null);
  const coinRewardPopupTimerIdsRef = useRef<number[]>([]);
  const walletGainPopupTimerIdRef = useRef<number | null>(null);
  const placementBlockedNoticeTimerIdRef = useRef<number | null>(null);
  const rewardVideoTimerByObjectIdRef = useRef<Record<string, number>>({});
  const lastSavedCharacterPositionRef = useRef<string | null>(null);
  const activePlacementObjectType = grabbedObjectType ?? placementObjectType;
  const effectiveAudioOwnerId = audioOwnerIdOverride ?? audioOwnerId;
  const characterPositionStorageKey = allowObjectPlacement
    ? createGardenCharacterPositionStorageKey(effectiveAudioOwnerId)
    : null;
  const activePlacementObject = activePlacementObjectType
    ? OBJECT_VISUALS[activePlacementObjectType]
    : null;
  const canPlaceObject = allowObjectPlacement && Boolean(activePlacementObject);
  const grabbedPlacedObject = grabbedObjectId
    ? placedObjects.find((object) => object.id === grabbedObjectId) ?? null
    : null;
  const placedPlacementObject = grabbedPlacedObject;
  const hasPlacedActiveObject = Boolean(canPlaceObject && grabbedPlacedObject);
  const canShowObjectLocator = allowObjectPlacement && Boolean(placementObjectType);
  const selectedPlacementObject = placementObjectType
    ? [...placedObjects]
        .reverse()
        .find((object) => object.objectType === placementObjectType) ?? null
    : null;
  const hasPlacedSelectedObject = Boolean(canPlaceObject && selectedPlacementObject);

  useEffect(() => {
    hitmapRef.current = hitmapData;
  }, [hitmapData]);

  useEffect(() => {
    onGrabbedObjectIdChange?.(grabbedObjectId);
  }, [grabbedObjectId, onGrabbedObjectIdChange]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setIsCharacterWalkFrame((current) => !current);
    }, CHARACTER_WALK_FRAME_INTERVAL_MS);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  const getListenerWorldPosition = useCallback(() => {
    return {
      x: WORLD_WIDTH * 0.5 + desiredOffsetRef.current.x,
      y: WORLD_HEIGHT * 0.5 + desiredOffsetRef.current.y,
    };
  }, []);

  const getAutoPlaybackVolumeForObject = useCallback(
    (
      placedObject: PlacedStageObject,
      listenerPositionOverride?: Vector2,
    ) => {
      const listenerPosition =
        listenerPositionOverride ?? getListenerWorldPosition();
      const distanceToListener = Math.hypot(
        placedObject.x - listenerPosition.x,
        placedObject.y - listenerPosition.y,
      );
      const attenuationGain = getDistanceAttenuationGain(distanceToListener);

      return clamp(characterVoiceVolumeRef.current * attenuationGain, 0, 1);
    },
    [getListenerWorldPosition],
  );

  const resolveAutoPlaybackAudioContext = useCallback(() => {
    const AudioContextConstructor = getAudioContextConstructor();

    if (!AudioContextConstructor) {
      return null;
    }

    if (autoPlaybackAudioContextRef.current?.state === "closed") {
      autoPlaybackAudioContextRef.current = null;
    }

    if (!autoPlaybackAudioContextRef.current) {
      autoPlaybackAudioContextRef.current = new AudioContextConstructor();
    }

    return autoPlaybackAudioContextRef.current;
  }, []);

  const resumeAutoPlaybackAudioContextIfNeeded = useCallback(async () => {
    const audioContext = autoPlaybackAudioContextRef.current;

    if (!audioContext) {
      return;
    }

    const audioContextState = audioContext.state as string;

    if (audioContextState !== "suspended" && audioContextState !== "interrupted") {
      return;
    }

    try {
      await audioContext.resume();
    } catch {
      // Keep standard media element playback when resume fails.
    }
  }, []);

  const ensureAutoPlaybackGainNode = useCallback(
    (objectId: string, objectAudio: HTMLAudioElement) => {
      const existingGainNode = autoPlaybackGainNodeByObjectIdRef.current[objectId];

      if (existingGainNode) {
        return existingGainNode;
      }

      const audioContext = resolveAutoPlaybackAudioContext();

      if (!audioContext) {
        return null;
      }

      try {
        const sourceNode = audioContext.createMediaElementSource(objectAudio);
        const gainNode = audioContext.createGain();

        sourceNode.connect(gainNode);
        gainNode.connect(audioContext.destination);

        autoPlaybackSourceNodeByObjectIdRef.current[objectId] = sourceNode;
        autoPlaybackGainNodeByObjectIdRef.current[objectId] = gainNode;
        objectAudio.volume = 1;
        return gainNode;
      } catch {
        return null;
      }
    },
    [resolveAutoPlaybackAudioContext],
  );

  const setAutoPlaybackVolume = useCallback(
    (objectId: string, objectAudio: HTMLAudioElement, nextVolume: number) => {
      const normalizedVolume = clamp(nextVolume, 0, 1);
      const gainNode =
        autoPlaybackGainNodeByObjectIdRef.current[objectId] ??
        ensureAutoPlaybackGainNode(objectId, objectAudio);

      if (gainNode) {
        gainNode.gain.setValueAtTime(
          normalizedVolume,
          gainNode.context.currentTime,
        );
        objectAudio.volume = 1;
        return;
      }

      objectAudio.volume = normalizedVolume;
    },
    [ensureAutoPlaybackGainNode],
  );

  const updateActiveAutoPlaybackVolumes = useCallback(
    (listenerWorldX?: number, listenerWorldY?: number) => {
      const listenerPosition =
        typeof listenerWorldX === "number" && typeof listenerWorldY === "number"
          ? { x: listenerWorldX, y: listenerWorldY }
          : getListenerWorldPosition();

      for (const [objectId, objectAudio] of Object.entries(
        autoPlaybackAudioByObjectIdRef.current,
      )) {
        const placedObject =
          placedObjectsRef.current.find((candidate) => candidate.id === objectId) ?? null;

        if (!placedObject) {
          continue;
        }

        const nextVolume = getAutoPlaybackVolumeForObject(
          placedObject,
          listenerPosition,
        );
        setAutoPlaybackVolume(objectId, objectAudio, nextVolume);

        const harmonyAudio = autoPlaybackHarmonyAudioByObjectIdRef.current[objectId];
        if (harmonyAudio) {
          harmonyAudio.volume = clamp(nextVolume * HARMONY_LAYER_VOLUME_RATIO, 0, 1);
        }
      }
    },
    [
      getAutoPlaybackVolumeForObject,
      getListenerWorldPosition,
      setAutoPlaybackVolume,
    ],
  );

  const applyWorldTransform = useCallback(() => {
    if (!worldRef.current) {
      return;
    }

    const worldLeft = stageSizeRef.current.x * 0.5 - WORLD_WIDTH * 0.5;
    const worldTop = stageSizeRef.current.y * 0.5 - WORLD_HEIGHT * 0.5;

    worldRef.current.style.transform = `translate3d(${worldLeft - cameraOffsetRef.current.x}px, ${worldTop - cameraOffsetRef.current.y}px, 0)`;
  }, []);

  const applyCharacterTransform = useCallback(() => {
    if (!characterRef.current) {
      return;
    }

    const offsetX = desiredOffsetRef.current.x - cameraOffsetRef.current.x;
    const offsetY = desiredOffsetRef.current.y - cameraOffsetRef.current.y;

    characterRef.current.style.transform = `translate3d(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px), 0)`;
  }, []);

  const clampCameraBounds = useCallback((nextOffset: Vector2) => {
    const minCameraOffsetX = movementBounds.minX + stageSizeRef.current.x * 0.5 - WORLD_WIDTH * 0.5;
    const maxCameraOffsetX = movementBounds.maxX - stageSizeRef.current.x * 0.5 - WORLD_WIDTH * 0.5;
    const minCameraOffsetY = movementBounds.minY + stageSizeRef.current.y * 0.5 - WORLD_HEIGHT * 0.5;
    const maxCameraOffsetY = movementBounds.maxY - stageSizeRef.current.y * 0.5 - WORLD_HEIGHT * 0.5;

    return {
      x: clamp(
        nextOffset.x,
        Math.min(minCameraOffsetX, maxCameraOffsetX),
        Math.max(minCameraOffsetX, maxCameraOffsetX),
      ),
      y: clamp(
        nextOffset.y,
        Math.min(minCameraOffsetY, maxCameraOffsetY),
        Math.max(minCameraOffsetY, maxCameraOffsetY),
      ),
    };
  }, [movementBounds.maxX, movementBounds.maxY, movementBounds.minX, movementBounds.minY]);

  const clampCharacterBounds = useCallback((nextOffset: Vector2) => {
    const minWorldX = Math.min(movementBounds.minX, movementBounds.maxX) + CHARACTER_HITBOX_RADIUS;
    const maxWorldX = Math.max(movementBounds.minX, movementBounds.maxX) - CHARACTER_HITBOX_RADIUS;
    const minWorldY = Math.min(movementBounds.minY, movementBounds.maxY) + CHARACTER_HITBOX_RADIUS;
    const maxWorldY = Math.max(movementBounds.minY, movementBounds.maxY) - CHARACTER_HITBOX_RADIUS;
    const minOffsetX = minWorldX - WORLD_WIDTH * 0.5;
    const maxOffsetX = maxWorldX - WORLD_WIDTH * 0.5;
    const minOffsetY = minWorldY - WORLD_HEIGHT * 0.5;
    const maxOffsetY = maxWorldY - WORLD_HEIGHT * 0.5;

    return {
      x: clamp(nextOffset.x, Math.min(minOffsetX, maxOffsetX), Math.max(minOffsetX, maxOffsetX)),
      y: clamp(nextOffset.y, Math.min(minOffsetY, maxOffsetY), Math.max(minOffsetY, maxOffsetY)),
    };
  }, [movementBounds.maxX, movementBounds.maxY, movementBounds.minX, movementBounds.minY]);

  const initializeStage = useCallback(() => {
    if (!stageRef.current) {
      return;
    }

    const rect = stageRef.current.getBoundingClientRect();
    const nextStageSize = {
      x: rect.width,
      y: rect.height,
    };
    stageSizeRef.current = nextStageSize;
    setStageViewportSize((current) =>
      current.x === nextStageSize.x && current.y === nextStageSize.y
        ? current
        : nextStageSize,
    );

    desiredOffsetRef.current = clampCharacterBounds(desiredOffsetRef.current);
    cameraOffsetRef.current = clampCameraBounds(desiredOffsetRef.current);
    applyWorldTransform();
    applyCharacterTransform();
  }, [applyCharacterTransform, applyWorldTransform, clampCameraBounds, clampCharacterBounds]);

  const clearJoystickInput = useCallback(() => {
    stickPointerIdRef.current = null;
    joystickVectorRef.current = { x: 0, y: 0 };

    if (stickKnobRef.current) {
      stickKnobRef.current.style.transform = "translate3d(0, 0, 0)";
    }
  }, []);

  const updateStickVectorFromPoint = useCallback((clientX: number, clientY: number) => {
    if (!stickPadRef.current) {
      return;
    }

    const rect = stickPadRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width * 0.5;
    const centerY = rect.top + rect.height * 0.5;
    const radius = Math.max(1, rect.width * 0.5 - STICK_KNOB_SIZE * 0.5);
    const rawX = clientX - centerX;
    const rawY = clientY - centerY;
    const magnitude = Math.hypot(rawX, rawY);
    const ratio = magnitude > radius ? radius / magnitude : 1;
    const limitedX = rawX * ratio;
    const limitedY = rawY * ratio;

    if (stickKnobRef.current) {
      stickKnobRef.current.style.transform = `translate3d(${limitedX}px, ${limitedY}px, 0)`;
    }

    joystickVectorRef.current = toUnitDirection(
      {
        x: clamp(limitedX / radius, -1, 1),
        y: clamp(limitedY / radius, -1, 1),
      },
      JOYSTICK_DEAD_ZONE,
    );
  }, []);

  const handleStickPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "touch" && event.pointerType !== "pen") {
        return;
      }

      stickPointerIdRef.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      updateStickVectorFromPoint(event.clientX, event.clientY);
    },
    [updateStickVectorFromPoint],
  );

  const handleStickPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (stickPointerIdRef.current !== event.pointerId) {
        return;
      }

      updateStickVectorFromPoint(event.clientX, event.clientY);
    },
    [updateStickVectorFromPoint],
  );

  const handleStickPointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (stickPointerIdRef.current !== event.pointerId) {
        return;
      }

      clearJoystickInput();

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [clearJoystickInput],
  );

  const syncCharacterAnimationState = useCallback((velocity: Vector2) => {
    const speed = Math.hypot(velocity.x, velocity.y);
    const nextIsWalking = speed > WALK_ANIMATION_SPEED_THRESHOLD;

    if (walkingRef.current !== nextIsWalking) {
      walkingRef.current = nextIsWalking;
      setIsWalking(nextIsWalking);
    }

    if (nextIsWalking) {
      const nextFacingDirection = resolveCharacterFacingDirection(velocity);

      if (characterFacingDirectionRef.current !== nextFacingDirection) {
        characterFacingDirectionRef.current = nextFacingDirection;
        setCharacterFacingDirection(nextFacingDirection);
      }
    }

    if (velocity.x > HORIZONTAL_FACING_EPSILON) {
      if (characterHorizontalFacingRef.current !== "right") {
        characterHorizontalFacingRef.current = "right";
        setCharacterHorizontalFacing("right");
      }
    } else if (velocity.x < -HORIZONTAL_FACING_EPSILON) {
      if (characterHorizontalFacingRef.current !== "left") {
        characterHorizontalFacingRef.current = "left";
        setCharacterHorizontalFacing("left");
      }
    }
  }, []);

  const resetCharacterAnimationState = useCallback(() => {
    walkingRef.current = false;
    setIsWalking(false);
  }, []);

  const clearPlacementState = useCallback(() => {
    setIsMousePlacementArmed(false);
    setIsTouchPlacementArmed(false);
    setPointerWorldPosition(null);
    setGrabbedObjectId(null);
    setGrabbedObjectType(null);
  }, []);

  const showPlacementBlockedMessage = useCallback((position: Vector2, message = "ここには配置できません") => {
    setPlacementBlockedNotice({
      id: `placement-blocked-${Date.now()}`,
      message,
      position,
    });

    if (placementBlockedNoticeTimerIdRef.current !== null) {
      window.clearTimeout(placementBlockedNoticeTimerIdRef.current);
    }

    placementBlockedNoticeTimerIdRef.current = window.setTimeout(() => {
      setPlacementBlockedNotice(null);
      placementBlockedNoticeTimerIdRef.current = null;
    }, PLACEMENT_BLOCKED_NOTICE_DURATION_MS);
  }, []);

  const clearHarmonyRecordingTimers = useCallback(() => {
    if (harmonyRecordingStopTimerRef.current !== null) {
      window.clearTimeout(harmonyRecordingStopTimerRef.current);
      harmonyRecordingStopTimerRef.current = null;
    }

    if (harmonyRecordingCountdownTimerRef.current !== null) {
      window.clearInterval(harmonyRecordingCountdownTimerRef.current);
      harmonyRecordingCountdownTimerRef.current = null;
    }
  }, []);

  const stopHarmonyRecordingStream = useCallback(() => {
    if (harmonyRecordingStreamRef.current) {
      harmonyRecordingStreamRef.current.getTracks().forEach((track) => track.stop());
      harmonyRecordingStreamRef.current = null;
    }
  }, []);

  const stopHarmonyWaveformAnimation = useCallback(() => {
    if (harmonyRecordingWaveformAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(harmonyRecordingWaveformAnimationFrameRef.current);
      harmonyRecordingWaveformAnimationFrameRef.current = null;
    }

    if (harmonyRecordingWaveformAudioContextRef.current) {
      void harmonyRecordingWaveformAudioContextRef.current.close();
      harmonyRecordingWaveformAudioContextRef.current = null;
    }

    const canvas = harmonyRecordingWaveformCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const startHarmonyWaveformAnimation = useCallback((stream: MediaStream) => {
    stopHarmonyWaveformAnimation();

    const canvas = harmonyRecordingWaveformCanvasRef.current;

    if (!canvas) {
      return;
    }

    const AudioContextConstructor =
      window.AudioContext ??
      (window as Window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;

    if (!AudioContextConstructor) {
      return;
    }

    const audioContext = new AudioContextConstructor();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.82;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    harmonyRecordingWaveformAudioContextRef.current = audioContext;

    const draw = () => {
      const renderCanvas = harmonyRecordingWaveformCanvasRef.current;

      if (!renderCanvas) {
        return;
      }

      const renderContext = renderCanvas.getContext("2d");

      if (!renderContext) {
        return;
      }

      const devicePixelRatio = window.devicePixelRatio || 1;
      const width = Math.floor(renderCanvas.clientWidth * devicePixelRatio);
      const height = Math.floor(renderCanvas.clientHeight * devicePixelRatio);

      if (renderCanvas.width !== width || renderCanvas.height !== height) {
        renderCanvas.width = width;
        renderCanvas.height = height;
      }

      renderContext.clearRect(0, 0, width, height);
      analyser.getByteFrequencyData(dataArray);

      const bars = 28;
      const gap = 3 * devicePixelRatio;
      const totalGap = gap * (bars - 1);
      const barWidth = Math.max(2 * devicePixelRatio, (width - totalGap) / bars);
      const gradient = renderContext.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "rgba(196, 72, 48, 0.95)");
      gradient.addColorStop(1, "rgba(210, 173, 94, 0.7)");
      renderContext.fillStyle = gradient;

      for (let index = 0; index < bars; index += 1) {
        const dataIndex = Math.floor((index / bars) * dataArray.length);
        const amplitude = dataArray[dataIndex] / 255;
        const barHeight = Math.max(4 * devicePixelRatio, amplitude * height * 0.95);
        const x = index * (barWidth + gap);
        const y = (height - barHeight) / 2;

        renderContext.beginPath();
        renderContext.roundRect(x, y, barWidth, barHeight, 10 * devicePixelRatio);
        renderContext.fill();
      }

      harmonyRecordingWaveformAnimationFrameRef.current = window.requestAnimationFrame(draw);
    };

    draw();
  }, [stopHarmonyWaveformAnimation]);

  const stopHarmonyDualPreviewPlayback = useCallback(() => {
    const ownerAudio = harmonyDualPreviewOwnerAudioRef.current;

    if (ownerAudio) {
      ownerAudio.pause();
      ownerAudio.currentTime = 0;
      ownerAudio.onended = null;
      ownerAudio.onerror = null;
      harmonyDualPreviewOwnerAudioRef.current = null;
    }

    const layerAudio = harmonyDualPreviewLayerAudioRef.current;

    if (layerAudio) {
      layerAudio.pause();
      layerAudio.currentTime = 0;
      layerAudio.onended = null;
      layerAudio.onerror = null;
      harmonyDualPreviewLayerAudioRef.current = null;
    }

    setIsHarmonyDualPreviewPlaying(false);
  }, []);

  const applyOwnerPreviewPlaybackEffect = useCallback(
    (audioElement: HTMLAudioElement, objectType: ObjectType) => {
      applyVoiceZooPlaybackEffect(audioElement, objectType);
      audioElement.volume = 1;
    },
    [],
  );

  const applyLayerPreviewPlaybackEffect = useCallback(
    (audioElement: HTMLAudioElement, objectType: ObjectType) => {
      applyVoiceZooPlaybackEffect(audioElement, objectType);
      audioElement.playbackRate = clamp(
        audioElement.playbackRate + HARMONY_LAYER_PLAYBACK_RATE_OFFSET,
        0.5,
        2,
      );
    },
    [],
  );

  const stopHarmonyIndividualPreviewPlayback = useCallback(() => {
    const ownerPreviewAudio = harmonyOwnerPreviewAudioElementRef.current;

    if (ownerPreviewAudio) {
      ownerPreviewAudio.pause();
      ownerPreviewAudio.currentTime = 0;
    }

    const layerPreviewAudio = harmonyLayerPreviewAudioElementRef.current;

    if (layerPreviewAudio) {
      layerPreviewAudio.pause();
      layerPreviewAudio.currentTime = 0;
    }
  }, []);

  const playHarmonyCombinedPreview = useCallback(() => {
    const target = harmonyRecordingModal;

    if (!target) {
      return;
    }

    if (isHarmonyDualPreviewPlaying) {
      stopHarmonyDualPreviewPlayback();
      return;
    }

    if (!harmonyPreviewOwnerAudioUrl && !harmonyPreviewLayerAudioUrl) {
      return;
    }

    stopHarmonyIndividualPreviewPlayback();
    stopHarmonyDualPreviewPlayback();

    let remainingLayers = 0;

    const finishLayerPlayback = () => {
      remainingLayers -= 1;

      if (remainingLayers <= 0) {
        setIsHarmonyDualPreviewPlaying(false);
        harmonyDualPreviewOwnerAudioRef.current = null;
        harmonyDualPreviewLayerAudioRef.current = null;
      }
    };

    const attachLayerHandlers = (audio: HTMLAudioElement) => {
      let hasFinishedLayer = false;
      remainingLayers += 1;

      const settleLayer = () => {
        if (hasFinishedLayer) {
          return;
        }

        hasFinishedLayer = true;
        finishLayerPlayback();
      };

      audio.onended = settleLayer;
      audio.onerror = settleLayer;

      return settleLayer;
    };

    let settleOwnerLayer: (() => void) | null = null;
    let settleHarmonyLayer: (() => void) | null = null;

    if (harmonyPreviewOwnerAudioUrl) {
      const ownerAudio = new Audio(harmonyPreviewOwnerAudioUrl);
      ownerAudio.preload = "auto";
      ownerAudio.volume = 1;
      applyVoiceZooPlaybackEffect(ownerAudio, target.objectType);
      harmonyDualPreviewOwnerAudioRef.current = ownerAudio;
      settleOwnerLayer = attachLayerHandlers(ownerAudio);
    }

    if (harmonyPreviewLayerAudioUrl) {
      const layerAudio = new Audio(harmonyPreviewLayerAudioUrl);
      layerAudio.preload = "auto";
      layerAudio.volume = HARMONY_LAYER_VOLUME_RATIO;
      applyVoiceZooPlaybackEffect(layerAudio, target.objectType);
      layerAudio.playbackRate = clamp(
        layerAudio.playbackRate + HARMONY_LAYER_PLAYBACK_RATE_OFFSET,
        0.5,
        2,
      );
      harmonyDualPreviewLayerAudioRef.current = layerAudio;
      settleHarmonyLayer = attachLayerHandlers(layerAudio);
    }

    if (remainingLayers === 0) {
      return;
    }

    setIsHarmonyDualPreviewPlaying(true);

    if (harmonyDualPreviewOwnerAudioRef.current) {
      void harmonyDualPreviewOwnerAudioRef.current.play().catch(() => {
        settleOwnerLayer?.();
      });
    }

    if (harmonyDualPreviewLayerAudioRef.current) {
      void harmonyDualPreviewLayerAudioRef.current.play().catch(() => {
        settleHarmonyLayer?.();
      });
    }
  }, [
    harmonyPreviewLayerAudioUrl,
    harmonyPreviewOwnerAudioUrl,
    harmonyRecordingModal,
    isHarmonyDualPreviewPlaying,
    stopHarmonyIndividualPreviewPlayback,
    stopHarmonyDualPreviewPlayback,
  ]);

  const closeHarmonyRecordingModal = useCallback(() => {
    if (isHarmonyRecording) {
      return;
    }

    stopHarmonyIndividualPreviewPlayback();
    stopHarmonyDualPreviewPlayback();
    stopHarmonyWaveformAnimation();
    setHarmonyRecordingModal(null);
    setHarmonyRecordingNotice(null);
    setHarmonyRecordingCountdown(HARMONY_RECORDING_DURATION_SECONDS);
    setHarmonyPreviewOwnerBlob(null);
    setHasCompletedHarmonyRecording(false);
  }, [
    isHarmonyRecording,
    stopHarmonyIndividualPreviewPlayback,
    stopHarmonyDualPreviewPlayback,
    stopHarmonyWaveformAnimation,
  ]);

  const openHarmonyRecordingModal = useCallback(
    (targetObject: PlacedStageObject) => {
      const objectLabel = OBJECT_VISUALS[targetObject.objectType].label;
      const hasExistingRecording = Boolean(
        harmonyRecordingIdByObjectIdRef.current[targetObject.id],
      );

      stopHarmonyIndividualPreviewPlayback();
      stopHarmonyDualPreviewPlayback();
      stopHarmonyWaveformAnimation();
      setHasCompletedHarmonyRecording(false);
      setHarmonyPreviewOwnerBlob(null);
      setHarmonyRecordingModal({
        objectId: targetObject.id,
        objectType: targetObject.objectType,
        objectLabel,
      });
      setHarmonyRecordingNotice(
        hasExistingRecording
          ? `${objectLabel}に重ねる音を録りなおせます。`
          : `${objectLabel}に3秒の音を重ねましょう。`,
      );
      setHarmonyRecordingCountdown(HARMONY_RECORDING_DURATION_SECONDS);
    },
    [
      stopHarmonyIndividualPreviewPlayback,
      stopHarmonyDualPreviewPlayback,
      stopHarmonyWaveformAnimation,
    ],
  );

  const startHarmonyObjectRecording = useCallback(async () => {
    const target = harmonyRecordingModal;

    if (
      !target ||
      isHarmonyRecording ||
      !isReadonlyVisitorGarden ||
      !allowHarmonyFromVisitors
    ) {
      return;
    }

    setHarmonyRecordingCountdown(HARMONY_RECORDING_DURATION_SECONDS);
    setHarmonyRecordingNotice(null);
    setHasCompletedHarmonyRecording(false);
    stopHarmonyIndividualPreviewPlayback();
    stopHarmonyDualPreviewPlayback();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      harmonyRecordingStreamRef.current = stream;
      harmonyRecordingChunksRef.current = [];
      startHarmonyWaveformAnimation(stream);

      let recorder: MediaRecorder;

      try {
        recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      } catch {
        recorder = new MediaRecorder(stream);
      }

      harmonyRecordingMediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          harmonyRecordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        clearHarmonyRecordingTimers();
        harmonyRecordingMediaRecorderRef.current = null;
        setIsHarmonyRecording(false);
        stopHarmonyWaveformAnimation();
        stopHarmonyRecordingStream();

        const nextBlob = new Blob(harmonyRecordingChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        if (nextBlob.size === 0) {
          setHarmonyRecordingNotice("録音データを取得できませんでした。もう一度お試しください。");
          return;
        }

        const nextRecordingId = createGardenHarmonyRecordingId(
          target.objectType,
          target.objectId,
        );
        const recordingOwnerId = viewerId || "local_guest";
        const recordingGardenOwnerId = effectiveAudioOwnerId || "local_guest";
        const nextCatalogEntry: GardenHarmonyRecordingMeta = {
          objectId: target.objectId,
          objectType: target.objectType,
          recordingId: nextRecordingId,
          createdAt: new Date().toISOString(),
        };

        const supabaseSyncResult = await saveHarmonyRecordingToSupabase({
          blob: nextBlob,
          recordingId: nextRecordingId,
          objectId: target.objectId,
          objectType: target.objectType,
          gardenOwnerId: recordingGardenOwnerId,
          uploaderId: recordingOwnerId,
        });

        if (supabaseSyncResult === "disabled") {
          setHasCompletedHarmonyRecording(false);
          setHarmonyRecordingNotice(
            `${target.objectLabel}へのハーモニー受付は停止中です。庭主の公開設定をご確認ください。`,
          );
          return;
        }

        // 訪問者本人向けと庭主向けの双方にハーモニーを保存する。
        const storageTargets = [
          {
            ownerId: recordingOwnerId,
            gardenOwnerId: recordingGardenOwnerId,
          },
          {
            ownerId: recordingGardenOwnerId,
            gardenOwnerId: recordingGardenOwnerId,
          },
        ].filter(
          (targetScope, index, list) =>
            list.findIndex(
              (candidate) =>
                candidate.ownerId === targetScope.ownerId &&
                candidate.gardenOwnerId === targetScope.gardenOwnerId,
            ) === index,
        );

        for (const storageTarget of storageTargets) {
          await set(
            getGardenHarmonyRecordingBlobStorageKey(
              storageTarget.ownerId,
              storageTarget.gardenOwnerId,
              nextRecordingId,
            ),
            nextBlob,
          );

          const catalogStorageKey = getGardenHarmonyRecordingCatalogStorageKey(
            storageTarget.ownerId,
            storageTarget.gardenOwnerId,
          );
          const currentCatalog = parseGardenHarmonyRecordingCatalog(
            window.localStorage.getItem(catalogStorageKey),
          );
          const nextCatalog = [
            ...currentCatalog.filter((entry) => entry.objectId !== target.objectId),
            nextCatalogEntry,
          ];

          window.localStorage.setItem(catalogStorageKey, JSON.stringify(nextCatalog));
        }

        setHarmonyRecordingIdByObjectId((current) => ({
          ...current,
          [target.objectId]: nextRecordingId,
        }));
        setHarmonyRecordingBlobByObjectId((current) => ({
          ...current,
          [target.objectId]: nextBlob,
        }));
        setHasCompletedHarmonyRecording(true);
        if (supabaseSyncResult === "error" && isUuidLike(recordingGardenOwnerId)) {
          setHarmonyRecordingNotice(
            `${target.objectLabel}に音を重ねました。同期に失敗したため、この端末内でのみ反映されます。`,
          );
        } else {
          setHarmonyRecordingNotice(
            `${target.objectLabel}に音を重ねました。次の再生から重なって流れます。`,
          );
        }
      };

      recorder.start();
      setIsHarmonyRecording(true);
      setHarmonyRecordingNotice("録音中です... 3秒後に自動停止します。");

      harmonyRecordingCountdownTimerRef.current = window.setInterval(() => {
        setHarmonyRecordingCountdown((current) => Math.max(0, current - 1));
      }, 1000);

      harmonyRecordingStopTimerRef.current = window.setTimeout(() => {
        if (
          harmonyRecordingMediaRecorderRef.current &&
          harmonyRecordingMediaRecorderRef.current.state !== "inactive"
        ) {
          harmonyRecordingMediaRecorderRef.current.stop();
        }
      }, HARMONY_RECORDING_DURATION_SECONDS * 1000);
    } catch {
      clearHarmonyRecordingTimers();
      harmonyRecordingMediaRecorderRef.current = null;
      stopHarmonyWaveformAnimation();
      stopHarmonyRecordingStream();
      setIsHarmonyRecording(false);
      setHarmonyRecordingNotice("マイクの利用を許可してください。");
    }
  }, [
    allowHarmonyFromVisitors,
    clearHarmonyRecordingTimers,
    effectiveAudioOwnerId,
    harmonyRecordingModal,
    isHarmonyRecording,
    isReadonlyVisitorGarden,
    startHarmonyWaveformAnimation,
    stopHarmonyIndividualPreviewPlayback,
    stopHarmonyDualPreviewPlayback,
    stopHarmonyWaveformAnimation,
    stopHarmonyRecordingStream,
    viewerId,
  ]);

  const clearAutoPlaybackScheduler = useCallback(() => {
    if (autoPlaybackSchedulerTimerRef.current !== null) {
      window.clearInterval(autoPlaybackSchedulerTimerRef.current);
      autoPlaybackSchedulerTimerRef.current = null;
    }
  }, []);

  const cleanupUnusedRecordingBlobs = useCallback(() => {
    // 配置されていないオブジェクトタイプの録音Blobをクリア
    const usedObjectTypes = new Set(
      placedObjectsRef.current.map((obj) => obj.objectType),
    );

    setRecordingBlobByRecordingId((current) => {
      const nextRecordingBlobs = { ...current };
      let hasChanges = false;

      for (const recordingId of Object.keys(nextRecordingBlobs)) {
        // 最新の録音ID以外は削除
        let isLatest = false;
        for (const objectType of usedObjectTypes) {
          if (
            latestRecordingIdByObjectTypeRef.current[objectType] === recordingId
          ) {
            isLatest = true;
            break;
          }
        }

        if (!isLatest && Math.random() < 0.3) {
          // 30%の確率で古いBlobをクリア
          delete nextRecordingBlobs[recordingId];
          hasChanges = true;
        }
      }

      return hasChanges ? nextRecordingBlobs : current;
    });
  }, []);

  const revokeAutoPlaybackAudioUrl = useCallback((objectId: string) => {
    const currentAudioUrl = autoPlaybackAudioUrlByObjectIdRef.current[objectId];

    if (!currentAudioUrl) {
      return;
    }

    URL.revokeObjectURL(currentAudioUrl);
    delete autoPlaybackAudioUrlByObjectIdRef.current[objectId];
  }, []);

  const revokeAutoPlaybackHarmonyAudioUrl = useCallback((objectId: string) => {
    const currentAudioUrl = autoPlaybackHarmonyAudioUrlByObjectIdRef.current[objectId];

    if (!currentAudioUrl) {
      return;
    }

    URL.revokeObjectURL(currentAudioUrl);
    delete autoPlaybackHarmonyAudioUrlByObjectIdRef.current[objectId];
  }, []);

  const stopAutoPlaybackObject = useCallback(
    (objectId: string) => {
      delete autoPlaybackNextAtByObjectIdRef.current[objectId];
      autoPlaybackInFlightObjectIdsRef.current.delete(objectId);

      const objectAudio = autoPlaybackAudioByObjectIdRef.current[objectId];

      if (objectAudio) {
        objectAudio.pause();
        objectAudio.currentTime = 0;
        objectAudio.onended = null;
        objectAudio.onerror = null;
        objectAudio.onplay = null;
        objectAudio.removeAttribute("src");
        objectAudio.load();
        delete autoPlaybackAudioByObjectIdRef.current[objectId];
      }

      const harmonyAudio = autoPlaybackHarmonyAudioByObjectIdRef.current[objectId];

      if (harmonyAudio) {
        harmonyAudio.pause();
        harmonyAudio.currentTime = 0;
        harmonyAudio.onended = null;
        harmonyAudio.onerror = null;
        harmonyAudio.onplay = null;
        harmonyAudio.removeAttribute("src");
        harmonyAudio.load();
        delete autoPlaybackHarmonyAudioByObjectIdRef.current[objectId];
      }

      const sourceNode = autoPlaybackSourceNodeByObjectIdRef.current[objectId];

      if (sourceNode) {
        sourceNode.disconnect();
        delete autoPlaybackSourceNodeByObjectIdRef.current[objectId];
      }

      const gainNode = autoPlaybackGainNodeByObjectIdRef.current[objectId];

      if (gainNode) {
        gainNode.disconnect();
        delete autoPlaybackGainNodeByObjectIdRef.current[objectId];
      }

      revokeAutoPlaybackAudioUrl(objectId);

      revokeAutoPlaybackHarmonyAudioUrl(objectId);
    },
    [revokeAutoPlaybackAudioUrl, revokeAutoPlaybackHarmonyAudioUrl],
  );

  const stopAutoPlayback = useCallback(() => {
    clearAutoPlaybackScheduler();

    const objectIds = new Set<string>([
      ...Object.keys(autoPlaybackNextAtByObjectIdRef.current),
      ...Object.keys(autoPlaybackAudioByObjectIdRef.current),
      ...Object.keys(autoPlaybackHarmonyAudioByObjectIdRef.current),
      ...Object.keys(autoPlaybackAudioUrlByObjectIdRef.current),
      ...Object.keys(autoPlaybackHarmonyAudioUrlByObjectIdRef.current),
      ...Array.from(autoPlaybackInFlightObjectIdsRef.current),
    ]);

    for (const objectId of objectIds) {
      stopAutoPlaybackObject(objectId);
    }

    autoPlaybackInFlightObjectIdsRef.current.clear();
  }, [clearAutoPlaybackScheduler, stopAutoPlaybackObject]);

  const resolveRecordingBlobForObject = useCallback(
    (placedObject: PlacedStageObject): Blob | null => {
      const resolvedRecordingId =
        placedObject.recordingId ??
        latestRecordingIdByObjectTypeRef.current[placedObject.objectType] ??
        null;

      if (!resolvedRecordingId) {
        return null;
      }

      return recordingBlobByRecordingIdRef.current[resolvedRecordingId] ?? null;
    },
    [],
  );

  const resolveHarmonyRecordingBlobForObject = useCallback((objectId: string) => {
    return harmonyRecordingBlobByObjectIdRef.current[objectId] ?? null;
  }, []);

  const addCoinRewardPopup = useCallback((placedObject: PlacedStageObject, coins: number) => {
    const objectLabel = OBJECT_VISUALS[placedObject.objectType].label;
    const popupId = `${placedObject.id}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    setCoinRewardPopups((current) => {
      const nextPopups = [
        ...current,
        {
          id: popupId,
          objectId: placedObject.id,
          objectLabel,
          x: placedObject.x,
          y: placedObject.y - 56,
          coins,
        },
      ];
      // 同時表示ポップアップ数を制限
      if (nextPopups.length > MAX_CONCURRENT_COIN_POPUPS) {
        return nextPopups.slice(-MAX_CONCURRENT_COIN_POPUPS);
      }
      return nextPopups;
    });

    const removalTimerId = window.setTimeout(() => {
      setCoinRewardPopups((current) =>
        current.filter((popup) => popup.id !== popupId),
      );
      coinRewardPopupTimerIdsRef.current = coinRewardPopupTimerIdsRef.current.filter(
        (timerId) => timerId !== removalTimerId,
      );
    }, COIN_POPUP_DURATION_MS);

    coinRewardPopupTimerIdsRef.current.push(removalTimerId);
  }, []);

  const triggerRewardVideoPlayback = useCallback((placedObject: PlacedStageObject) => {
    const playbackKey = Date.now();

    setRewardVideoPlaybackByObjectId((current) => ({
      ...current,
      [placedObject.id]: playbackKey,
    }));

    const existingTimerId = rewardVideoTimerByObjectIdRef.current[placedObject.id];
    if (typeof existingTimerId === "number") {
      window.clearTimeout(existingTimerId);
    }

    rewardVideoTimerByObjectIdRef.current[placedObject.id] = window.setTimeout(() => {
      setRewardVideoPlaybackByObjectId((current) => {
        if (!(placedObject.id in current)) {
          return current;
        }

        const next = { ...current };
        delete next[placedObject.id];
        return next;
      });

      delete rewardVideoTimerByObjectIdRef.current[placedObject.id];
    }, OBJECT_REWARD_VIDEO_DURATION_MS);
  }, []);

  const awardPlaybackReward = useCallback(
    (placedObject: PlacedStageObject) => {
      if (audioOwnerIdOverride) {
        // 他人の庭ではコイン報酬は付与しないが、再生演出動画は表示する。
        triggerRewardVideoPlayback(placedObject);
        return;
      }

      const rewardCoins = calculatePlaybackRewardCoins(
        getVoiceZooObjectPrice(placedObject.objectType),
      );

      try {
        const currentWallet = loadVoiceZooWallet(audioOwnerId);
        const nextWallet = {
          ...currentWallet,
          coins: currentWallet.coins + rewardCoins,
        };

        saveVoiceZooWallet(nextWallet, audioOwnerId);
        setWalletCoins(nextWallet.coins);
      } catch {
        // Fallback to local state update when storage write fails.
        setWalletCoins((currentCoins) => currentCoins + rewardCoins);
      }

      const walletGainPopupId = `${placedObject.id}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      setWalletGainPopup({
        id: walletGainPopupId,
        coins: rewardCoins,
      });

      if (walletGainPopupTimerIdRef.current !== null) {
        window.clearTimeout(walletGainPopupTimerIdRef.current);
      }

      walletGainPopupTimerIdRef.current = window.setTimeout(() => {
        setWalletGainPopup((current) =>
          current && current.id === walletGainPopupId ? null : current,
        );
        walletGainPopupTimerIdRef.current = null;
      }, WALLET_GAIN_POPUP_DURATION_MS);

      addCoinRewardPopup(placedObject, rewardCoins);
      triggerRewardVideoPlayback(placedObject);
    },
[addCoinRewardPopup, audioOwnerId, audioOwnerIdOverride, triggerRewardVideoPlayback]
  );

  const playAutoPlaybackForObject = useCallback(
    (objectId: string) => {
      if (isAudioSuppressedRef.current) {
        autoPlaybackNextAtByObjectIdRef.current[objectId] = Date.now() + getRandomPlaybackDelayMs();
        return;
      }

      // 同時再生オーディオ数を制限
      if (
        autoPlaybackInFlightObjectIdsRef.current.size >= MAX_CONCURRENT_AUTOPLAY_AUDIO &&
        !autoPlaybackInFlightObjectIdsRef.current.has(objectId)
      ) {
        autoPlaybackNextAtByObjectIdRef.current[objectId] = Date.now() + getRandomPlaybackDelayMs();
        return;
      }

      const selectedObject =
        placedObjectsRef.current.find((placedObject) => placedObject.id === objectId) ?? null;

      if (!selectedObject) {
        stopAutoPlaybackObject(objectId);
        return;
      }

      const recordingBlob = resolveRecordingBlobForObject(selectedObject);
      const harmonyRecordingBlob = resolveHarmonyRecordingBlobForObject(objectId);

      // ハーモニーは庭主音声に重ねて鳴らす前提のため、単体再生は行わない。
      if (!recordingBlob && harmonyRecordingBlob) {
        autoPlaybackNextAtByObjectIdRef.current[objectId] = Date.now() + getRandomPlaybackDelayMs();
        return;
      }

      if (!recordingBlob && !harmonyRecordingBlob) {
        autoPlaybackNextAtByObjectIdRef.current[objectId] = Date.now() + getRandomPlaybackDelayMs();
        return;
      }

      let objectAudio = autoPlaybackAudioByObjectIdRef.current[objectId];

      if (!objectAudio) {
        objectAudio = new Audio();
        objectAudio.preload = "auto";
        autoPlaybackAudioByObjectIdRef.current[objectId] = objectAudio;
      }

      let harmonyAudio = autoPlaybackHarmonyAudioByObjectIdRef.current[objectId] ?? null;

      if (harmonyRecordingBlob && !harmonyAudio) {
        harmonyAudio = new Audio();
        harmonyAudio.preload = "auto";
        autoPlaybackHarmonyAudioByObjectIdRef.current[objectId] = harmonyAudio;
      }

      autoPlaybackInFlightObjectIdsRef.current.add(objectId);

      objectAudio.pause();
      objectAudio.currentTime = 0;
      objectAudio.onended = null;
      objectAudio.onerror = null;
      objectAudio.onplay = null;

      if (harmonyAudio) {
        harmonyAudio.pause();
        harmonyAudio.currentTime = 0;
        harmonyAudio.onended = null;
        harmonyAudio.onerror = null;
        harmonyAudio.onplay = null;
      }

      revokeAutoPlaybackAudioUrl(objectId);
      const nextVolume = getAutoPlaybackVolumeForObject(selectedObject);
      if (recordingBlob) {
        const nextAudioUrl = URL.createObjectURL(recordingBlob);
        autoPlaybackAudioUrlByObjectIdRef.current[objectId] = nextAudioUrl;
        objectAudio.src = nextAudioUrl;
        objectAudio.currentTime = 0;
        setAutoPlaybackVolume(objectId, objectAudio, nextVolume);
        applyVoiceZooPlaybackEffect(objectAudio, selectedObject.objectType);
      } else {
        objectAudio.removeAttribute("src");
        objectAudio.load();
      }

      revokeAutoPlaybackHarmonyAudioUrl(objectId);
      if (harmonyRecordingBlob) {
        const activeHarmonyAudio = harmonyAudio;

        if (!activeHarmonyAudio) {
          autoPlaybackNextAtByObjectIdRef.current[objectId] = Date.now() + getRandomPlaybackDelayMs();
          autoPlaybackInFlightObjectIdsRef.current.delete(objectId);
          return;
        }

        const nextHarmonyAudioUrl = URL.createObjectURL(harmonyRecordingBlob);
        autoPlaybackHarmonyAudioUrlByObjectIdRef.current[objectId] = nextHarmonyAudioUrl;
        activeHarmonyAudio.src = nextHarmonyAudioUrl;
        activeHarmonyAudio.currentTime = 0;
        activeHarmonyAudio.volume = clamp(nextVolume * HARMONY_LAYER_VOLUME_RATIO, 0, 1);
        applyVoiceZooPlaybackEffect(activeHarmonyAudio, selectedObject.objectType);
        activeHarmonyAudio.playbackRate = clamp(
          activeHarmonyAudio.playbackRate + HARMONY_LAYER_PLAYBACK_RATE_OFFSET,
          0.5,
          2,
        );
      } else if (harmonyAudio) {
        harmonyAudio.removeAttribute("src");
        harmonyAudio.load();
        delete autoPlaybackHarmonyAudioByObjectIdRef.current[objectId];
      }

      let hasFinalizedPlayback = false;
      let hasRewardedPlayback = false;
      let remainingPlaybackLayers = 0;

      const rewardPlayback = () => {
        if (hasRewardedPlayback) {
          return;
        }

        hasRewardedPlayback = true;

        const latestObject =
          placedObjectsRef.current.find((placedObject) => placedObject.id === objectId) ?? null;

        if (latestObject) {
          awardPlaybackReward(latestObject);
        }
      };

      const finalizePlayback = () => {
        if (hasFinalizedPlayback) {
          return;
        }

        hasFinalizedPlayback = true;
        objectAudio.onended = null;
        objectAudio.onerror = null;
        objectAudio.onplay = null;
        if (harmonyAudio) {
          harmonyAudio.onended = null;
          harmonyAudio.onerror = null;
          harmonyAudio.onplay = null;
        }
        autoPlaybackInFlightObjectIdsRef.current.delete(objectId);
        revokeAutoPlaybackAudioUrl(objectId);
        revokeAutoPlaybackHarmonyAudioUrl(objectId);

        if (placedObjectsRef.current.some((placedObject) => placedObject.id === objectId)) {
          autoPlaybackNextAtByObjectIdRef.current[objectId] = Date.now() + getRandomPlaybackDelayMs();
          return;
        }

        stopAutoPlaybackObject(objectId);
      };

      const attachPlaybackLayer = (audio: HTMLAudioElement) => {
        let hasLayerEnded = false;
        remainingPlaybackLayers += 1;

        const finishLayerPlayback = () => {
          if (hasLayerEnded) {
            return;
          }

          hasLayerEnded = true;
          audio.onended = null;
          audio.onerror = null;
          remainingPlaybackLayers -= 1;

          if (remainingPlaybackLayers <= 0) {
            finalizePlayback();
          }
        };

        audio.onended = finishLayerPlayback;
        audio.onerror = finishLayerPlayback;
        audio.onplay = rewardPlayback;

        void resumeAutoPlaybackAudioContextIfNeeded()
          .then(() => audio.play())
          .then(() => {
            rewardPlayback();
          })
          .catch(() => {
            finishLayerPlayback();
          });
      };

      if (recordingBlob) {
        attachPlaybackLayer(objectAudio);
      }

      if (harmonyRecordingBlob && harmonyAudio) {
        attachPlaybackLayer(harmonyAudio);
      }

      if (remainingPlaybackLayers === 0) {
        finalizePlayback();
      }
    },
    [
      awardPlaybackReward,
      getAutoPlaybackVolumeForObject,
      resolveRecordingBlobForObject,
      resolveHarmonyRecordingBlobForObject,
      revokeAutoPlaybackAudioUrl,
      revokeAutoPlaybackHarmonyAudioUrl,
      resumeAutoPlaybackAudioContextIfNeeded,
      setAutoPlaybackVolume,
      stopAutoPlaybackObject,
    ],
  );

  const ensureOwnerRecordingBlobForPlacedObject = useCallback(
    async (placedObject: PlacedStageObject) => {
      const recordingId =
        placedObject.recordingId ??
        latestRecordingIdByObjectTypeRef.current[placedObject.objectType] ??
        null;

      if (!recordingId) {
        return null;
      }

      const currentBlob = recordingBlobByRecordingIdRef.current[recordingId];

      if (currentBlob instanceof Blob && currentBlob.size > 0) {
        return currentBlob;
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const publicBucketBaseUrl = supabaseUrl
        ? `${supabaseUrl}/storage/v1/object/public/garden-voices`
        : null;
      const ownerPathSegment = encodeURIComponent(effectiveAudioOwnerId);
      const recordingPathSegment = encodeURIComponent(recordingId);
      const remoteRecordingUrl =
        typeof placedObject.recordingUrl === "string" && placedObject.recordingUrl.length > 0
          ? placedObject.recordingUrl
          : publicBucketBaseUrl
            ? `${publicBucketBaseUrl}/${ownerPathSegment}/${recordingPathSegment}.webm`
            : null;

      if (!remoteRecordingUrl) {
        return null;
      }

      try {
        const response = await fetch(remoteRecordingUrl, {
          cache: "no-store",
        });

        if (!response.ok) {
          return null;
        }

        const blob = await response.blob();

        if (blob.size <= 0) {
          return null;
        }

        recordingBlobByRecordingIdRef.current = {
          ...recordingBlobByRecordingIdRef.current,
          [recordingId]: blob,
        };
        void Promise.resolve().then(() => {
          setRecordingBlobByRecordingId((current) => ({
            ...current,
            [recordingId]: blob,
          }));
        });

        return blob;
      } catch {
        return null;
      }
    },
    [effectiveAudioOwnerId],
  );

  const {
    isObjectLocatorVisible,
    objectLocatorIndicator,
  } = useEmptyStageObjectLocator({
    canPlaceObject: canShowObjectLocator,
    placementObjectType,
    placedPlacementObject: selectedPlacementObject,
    stageViewportSize,
    stageRef,
    stageSizeRef,
    cameraOffsetRef,
    clearPlacementState,
  });

  useEmptyStageStoredObjects({
    resolvedStorageKey,
    placedObjects,
    setPlacedObjects,
  });

  useEffect(() => {
    placedObjectsRef.current = placedObjects;
    updateActiveAutoPlaybackVolumes();
  }, [placedObjects, updateActiveAutoPlaybackVolumes]);

  useEffect(() => {
    recordingBlobByRecordingIdRef.current = recordingBlobByRecordingId;
  }, [recordingBlobByRecordingId]);

  useEffect(() => {
    latestRecordingIdByObjectTypeRef.current = latestRecordingIdByObjectType;
  }, [latestRecordingIdByObjectType]);

  useEffect(() => {
    harmonyRecordingIdByObjectIdRef.current = harmonyRecordingIdByObjectId;
  }, [harmonyRecordingIdByObjectId]);

  useEffect(() => {
    harmonyRecordingBlobByObjectIdRef.current = harmonyRecordingBlobByObjectId;
  }, [harmonyRecordingBlobByObjectId]);

  useEffect(() => {
    let cancelled = false;

    const setOwnerPreviewBlobDeferred = (nextBlob: Blob | null) => {
      void Promise.resolve().then(() => {
        if (!cancelled) {
          setHarmonyPreviewOwnerBlob(nextBlob);
        }
      });
    };

    if (!harmonyRecordingModal) {
      setOwnerPreviewBlobDeferred(null);
      return () => {
        cancelled = true;
      };
    }

    const targetObject =
      placedObjectsRef.current.find(
        (placedObject) => placedObject.id === harmonyRecordingModal.objectId,
      ) ?? null;

    if (!targetObject) {
      setOwnerPreviewBlobDeferred(null);
      return () => {
        cancelled = true;
      };
    }

    const immediateBlob = resolveRecordingBlobForObject(targetObject);

    if (immediateBlob) {
      setOwnerPreviewBlobDeferred(immediateBlob);
      return () => {
        cancelled = true;
      };
    }

    void ensureOwnerRecordingBlobForPlacedObject(targetObject).then((loadedBlob) => {
      if (cancelled) {
        return;
      }

      setOwnerPreviewBlobDeferred(loadedBlob ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [
    ensureOwnerRecordingBlobForPlacedObject,
    harmonyRecordingModal,
    resolveRecordingBlobForObject,
  ]);

  useEffect(() => {
    let cancelled = false;

    const stopPreviewPlaybackDeferred = () => {
      void Promise.resolve().then(() => {
        if (cancelled) {
          return;
        }

        stopHarmonyDualPreviewPlayback();
        stopHarmonyIndividualPreviewPlayback();
      });
    };

    const setOwnerPreviewAudioUrlDeferred = (nextUrl: string | null) => {
      void Promise.resolve().then(() => {
        if (!cancelled) {
          setHarmonyPreviewOwnerAudioUrl(nextUrl);
        }
      });
    };

    stopPreviewPlaybackDeferred();

    const previousUrl = harmonyPreviewOwnerAudioUrlRef.current;

    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
      harmonyPreviewOwnerAudioUrlRef.current = null;
    }

    if (!harmonyPreviewOwnerBlob) {
      setOwnerPreviewAudioUrlDeferred(null);
      return () => {
        cancelled = true;
      };
    }

    const nextUrl = URL.createObjectURL(harmonyPreviewOwnerBlob);
    harmonyPreviewOwnerAudioUrlRef.current = nextUrl;
    setOwnerPreviewAudioUrlDeferred(nextUrl);

    return () => {
      cancelled = true;

      if (harmonyPreviewOwnerAudioUrlRef.current === nextUrl) {
        URL.revokeObjectURL(nextUrl);
        harmonyPreviewOwnerAudioUrlRef.current = null;
      }
    };
  }, [
    harmonyPreviewOwnerBlob,
    stopHarmonyDualPreviewPlayback,
    stopHarmonyIndividualPreviewPlayback,
  ]);

  useEffect(() => {
    let cancelled = false;

    const stopPreviewPlaybackDeferred = () => {
      void Promise.resolve().then(() => {
        if (cancelled) {
          return;
        }

        stopHarmonyDualPreviewPlayback();
        stopHarmonyIndividualPreviewPlayback();
      });
    };

    const setLayerPreviewAudioUrlDeferred = (nextUrl: string | null) => {
      void Promise.resolve().then(() => {
        if (!cancelled) {
          setHarmonyPreviewLayerAudioUrl(nextUrl);
        }
      });
    };

    stopPreviewPlaybackDeferred();

    const previousUrl = harmonyPreviewLayerAudioUrlRef.current;

    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
      harmonyPreviewLayerAudioUrlRef.current = null;
    }

    if (!harmonyPreviewLayerBlob) {
      setLayerPreviewAudioUrlDeferred(null);
      return () => {
        cancelled = true;
      };
    }

    const nextUrl = URL.createObjectURL(harmonyPreviewLayerBlob);
    harmonyPreviewLayerAudioUrlRef.current = nextUrl;
    setLayerPreviewAudioUrlDeferred(nextUrl);

    return () => {
      cancelled = true;

      if (harmonyPreviewLayerAudioUrlRef.current === nextUrl) {
        URL.revokeObjectURL(nextUrl);
        harmonyPreviewLayerAudioUrlRef.current = null;
      }
    };
  }, [
    harmonyPreviewLayerBlob,
    stopHarmonyDualPreviewPlayback,
    stopHarmonyIndividualPreviewPlayback,
  ]);

  const findPlacedObjectAtPosition = useCallback(
    (targetPosition: Vector2 | null): PlacedStageObject | null => {
      if (!targetPosition) {
        return null;
      }

      for (let index = placedObjects.length - 1; index >= 0; index -= 1) {
        const candidate = placedObjects[index];

        if (isNearPlacedObject(targetPosition, candidate)) {
          return candidate;
        }
      }

      return null;
    },
    [placedObjects],
  );

  const getWorldPositionFromClient = useCallback((clientX: number, clientY: number) => {
    if (!stageRef.current) {
      return null;
    }

    const rect = stageRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const localX = clamp(clientX - rect.left, 0, rect.width);
    const localY = clamp(clientY - rect.top, 0, rect.height);

    const worldX =
      WORLD_WIDTH * 0.5 + cameraOffsetRef.current.x + (localX - rect.width * 0.5);
    const worldY =
      WORLD_HEIGHT * 0.5 + cameraOffsetRef.current.y + (localY - rect.height * 0.5);

    return {
      x: clamp(Math.round(worldX), 0, WORLD_WIDTH),
      y: clamp(Math.round(worldY), 0, WORLD_HEIGHT),
    };
  }, []);

  const isPlacementBlocked = useMemo(() => {
    if (!pointerWorldPosition) return false;

    return (
      isBlockedByHitmap(
        pointerWorldPosition.x,
        pointerWorldPosition.y,
        OBJECT_PLACEMENT_HIT_RADIUS,
        hitmapData,
      ) ||
      (!hitmapData &&
        isBlockedByCollisionZones(
          pointerWorldPosition.x,
          pointerWorldPosition.y,
          OBJECT_PLACEMENT_HIT_RADIUS,
          collisionZones,
        ))
    );
  }, [pointerWorldPosition, collisionZones, hitmapData]);

  const placeObjectAtWorldPosition = useCallback(
    (
      targetPosition: Vector2 | null,
      targetObjectType: ObjectType | null,
      targetObjectId: string | null = null,
    ): PlacementAttemptResult => {
      if (!allowObjectPlacement || !targetPosition || !targetObjectType) {
        return "skipped";
      }

      if (
        isBlockedByHitmap(
          targetPosition.x,
          targetPosition.y,
          OBJECT_PLACEMENT_HIT_RADIUS,
          hitmapRef.current,
        ) ||
        (!hitmapRef.current &&
        isBlockedByCollisionZones(
          targetPosition.x,
          targetPosition.y,
          OBJECT_PLACEMENT_HIT_RADIUS,
          collisionZones,
        ))
      ) {
        return "blocked";
      }

      setPlacedObjects((current) => {
        const latestRecordingIdForType =
          latestRecordingIdByObjectTypeRef.current[targetObjectType] ?? null;

        if (targetObjectId) {
          return current.map((object) =>
            object.id === targetObjectId
              ? {
                  ...object,
                  x: targetPosition.x,
                  y: targetPosition.y,
                }
              : object,
          );
        }

        // Keep one placement per object type: reuse the latest existing instance.
        let latestSameTypeIndex = -1;

        for (let index = current.length - 1; index >= 0; index -= 1) {
          if (current[index].objectType === targetObjectType) {
            latestSameTypeIndex = index;
            break;
          }
        }

        if (latestSameTypeIndex >= 0) {
          const nextObjects: PlacedStageObject[] = [];

          for (let index = 0; index < current.length; index += 1) {
            const object = current[index];

            if (object.objectType !== targetObjectType) {
              nextObjects.push(object);
              continue;
            }

            if (index !== latestSameTypeIndex) {
              continue;
            }

            nextObjects.push({
              ...object,
              recordingId: latestRecordingIdForType ?? object.recordingId,
              x: targetPosition.x,
              y: targetPosition.y,
            });
          }

          return nextObjects;
        }

        const nextObject: PlacedStageObject = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          objectType: targetObjectType,
          recordingId: latestRecordingIdForType,
          x: targetPosition.x,
          y: targetPosition.y,
          createdAt: new Date().toISOString(),
        };

        return [...current, nextObject].slice(-MAX_PLACED_OBJECTS);
      });

      return "placed";
    },
    [allowObjectPlacement, collisionZones],
  );

  const isNearSelectedObject = useCallback(
    (targetPosition: Vector2 | null) => {
      return isNearPlacedObject(targetPosition, placedPlacementObject);
    },
    [placedPlacementObject],
  );

  const handleStagePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!canPlaceObject) {
        return;
      }

      const targetPosition = getWorldPositionFromClient(event.clientX, event.clientY);
      if (!targetPosition) {
        return;
      }

      if (hasPlacedActiveObject) {
        if (isCoarsePointer) {
          if (isTouchPlacementArmed) {
            setPointerWorldPosition(targetPosition);
          }

          return;
        }

        if (isMousePlacementArmed) {
          setPointerWorldPosition(targetPosition);
        }

        return;
      }

      if (hasPlacedSelectedObject) {
        setPointerWorldPosition(null);
        return;
      }

      if (isCoarsePointer) {
        return;
      }

      setPointerWorldPosition(targetPosition);
    },
    [
      canPlaceObject,
      getWorldPositionFromClient,
      hasPlacedActiveObject,
      hasPlacedSelectedObject,
      isCoarsePointer,
      isMousePlacementArmed,
      isTouchPlacementArmed,
    ],
  );

  const handleStagePointerLeave = useCallback(() => {
    if (isCoarsePointer || isMousePlacementArmed) {
      return;
    }

    setPointerWorldPosition(null);
  }, [isCoarsePointer, isMousePlacementArmed]);

  const handleStagePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      const targetPosition = getWorldPositionFromClient(event.clientX, event.clientY);
      if (!targetPosition) {
        return;
      }

      if (!allowObjectPlacement) {
        if (!isReadonlyVisitorGarden || isHarmonyRecording) {
          return;
        }

        const tappedObject = findPlacedObjectAtPosition(targetPosition);

        if (tappedObject) {
          if (!allowHarmonyFromVisitors) {
            showPlacementBlockedMessage(
              targetPosition,
              "この庭ではハーモニー受付を停止しています",
            );
            return;
          }

          openHarmonyRecordingModal(tappedObject);
        }

        return;
      }

      const isPointerArmed = isCoarsePointer
        ? isTouchPlacementArmed
        : isMousePlacementArmed;
      const tappedObject = findPlacedObjectAtPosition(targetPosition);

      if (!isPointerArmed && tappedObject) {
        setGrabbedObjectType(tappedObject.objectType);
        setGrabbedObjectId(tappedObject.id);

        if (isCoarsePointer || event.pointerType !== "mouse") {
          setIsTouchPlacementArmed(true);
          setIsMousePlacementArmed(false);
        } else {
          setIsMousePlacementArmed(true);
          setIsTouchPlacementArmed(false);
        }

        setPointerWorldPosition(targetPosition);
        return;
      }

      if (!canPlaceObject) {
        return;
      }

      if (hasPlacedActiveObject) {
        if (isCoarsePointer) {
          if (!isTouchPlacementArmed) {
            if (!isNearSelectedObject(targetPosition)) {
              return;
            }

            setIsTouchPlacementArmed(true);
            setPointerWorldPosition(targetPosition);
            return;
          }

          const placeResult = placeObjectAtWorldPosition(
            targetPosition,
            activePlacementObjectType,
            grabbedObjectId,
          );
          if (placeResult === "placed") {
            setIsTouchPlacementArmed(false);
            setPointerWorldPosition(null);
            setGrabbedObjectId(null);
            setGrabbedObjectType(null);
          } else if (placeResult === "blocked") {
            showPlacementBlockedMessage(targetPosition);
          }

          return;
        }

        if (!isMousePlacementArmed) {
          if (!isNearSelectedObject(targetPosition)) {
            return;
          }

          setIsMousePlacementArmed(true);
          setPointerWorldPosition(targetPosition);
          return;
        }

        const placeResult = placeObjectAtWorldPosition(
          targetPosition,
          activePlacementObjectType,
          grabbedObjectId,
        );
        if (placeResult === "placed") {
          setIsMousePlacementArmed(false);
          setPointerWorldPosition(null);
          setGrabbedObjectId(null);
          setGrabbedObjectType(null);
        } else if (placeResult === "blocked") {
          showPlacementBlockedMessage(targetPosition);
        }

        return;
      }

      if (hasPlacedSelectedObject) {
        setPointerWorldPosition(null);
        return;
      }

      if (!isCoarsePointer && event.pointerType === "mouse") {
        const placeResult = placeObjectAtWorldPosition(
          targetPosition,
          activePlacementObjectType,
        );
        if (placeResult === "blocked") {
          showPlacementBlockedMessage(targetPosition);
        }
        setPointerWorldPosition(null);
        return;
      }

      if (!isTouchPlacementArmed) {
        setIsTouchPlacementArmed(true);
        setPointerWorldPosition(targetPosition);
        return;
      }

      const placeResult = placeObjectAtWorldPosition(
        targetPosition,
        activePlacementObjectType,
      );
      if (placeResult === "placed") {
        setIsTouchPlacementArmed(false);
        setPointerWorldPosition(null);
        setGrabbedObjectId(null);
        setGrabbedObjectType(null);
      } else if (placeResult === "blocked") {
        showPlacementBlockedMessage(targetPosition);
      }
    },
    [
      activePlacementObjectType,
      allowHarmonyFromVisitors,
      allowObjectPlacement,
      canPlaceObject,
      findPlacedObjectAtPosition,
      getWorldPositionFromClient,
      grabbedObjectId,
      hasPlacedActiveObject,
      hasPlacedSelectedObject,
      isCoarsePointer,
      isHarmonyRecording,
      isMousePlacementArmed,
      isReadonlyVisitorGarden,
      isNearSelectedObject,
      isTouchPlacementArmed,
      openHarmonyRecordingModal,
      placeObjectAtWorldPosition,
      showPlacementBlockedMessage,
    ],
  );

  useEffect(() => {
    characterVoiceVolumeRef.current = characterVoiceVolume;
    updateActiveAutoPlaybackVolumes();
  }, [characterVoiceVolume, updateActiveAutoPlaybackVolumes]);

  useEffect(() => {
    isAudioSuppressedRef.current = isAudioSuppressed;
  }, [isAudioSuppressed]);

  useEffect(() => {
    const handleAudioSuppression: EventListener = (event) => {
      const customEvent = event as CustomEvent<KazenagareAudioSuppressionDetail>;
      setIsAudioSuppressed(Boolean(customEvent.detail?.isSuppressed));
    };

    window.addEventListener(
      KAZENAGARE_AUDIO_SUPPRESSION_EVENT,
      handleAudioSuppression,
    );

    return () => {
      window.removeEventListener(
        KAZENAGARE_AUDIO_SUPPRESSION_EVENT,
        handleAudioSuppression,
      );
    };
  }, []);

  useEffect(() => {
    activeKeysRef.current.clear();
    clearJoystickInput();
    velocityRef.current = { x: 0, y: 0 };
    desiredOffsetRef.current = { x: initialCharacterOffset.x, y: initialCharacterOffset.y };
    cameraOffsetRef.current = clampCameraBounds(desiredOffsetRef.current);
    previousTimestampRef.current = 0;
    // 速度を 0 にリセット済みなのでアニメーションループが次フレームで isWalking を解決する
    // effect 内での setState 呼び出しを避けるため ref のみ更新する
    walkingRef.current = false;
    applyWorldTransform();
    applyCharacterTransform();
  }, [
    applyCharacterTransform,
    applyWorldTransform,
    clampCameraBounds,
    clearJoystickInput,
    initialCharacterOffset.x,
    initialCharacterOffset.y,
  ]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      setCharacterVoiceVolume(loadKazenagareAudioSettings().characterVoiceVolume);
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
    };
  }, []);

  useEffect(() => {
    const handleLocalAudioSettingsUpdate: EventListener = (event) => {
      const customEvent = event as CustomEvent<KazenagareAudioSettings>;

      if (customEvent.detail) {
        setCharacterVoiceVolume(customEvent.detail.characterVoiceVolume);
        return;
      }

      setCharacterVoiceVolume(loadKazenagareAudioSettings().characterVoiceVolume);
    };

    const handleAudioSettingsStorageUpdate = (event: StorageEvent) => {
      if (event.key !== KAZENAGARE_AUDIO_SETTINGS_STORAGE_KEY) {
        return;
      }

      const parsedSettings = parseKazenagareAudioSettings(event.newValue);
      setCharacterVoiceVolume(parsedSettings.characterVoiceVolume);
    };

    window.addEventListener(
      KAZENAGARE_AUDIO_SETTINGS_EVENT,
      handleLocalAudioSettingsUpdate,
    );
    window.addEventListener("storage", handleAudioSettingsStorageUpdate);

    return () => {
      window.removeEventListener(
        KAZENAGARE_AUDIO_SETTINGS_EVENT,
        handleLocalAudioSettingsUpdate,
      );
      window.removeEventListener("storage", handleAudioSettingsStorageUpdate);
    };
  }, []);

  useEffect(() => {
    initializeStage();

    const observer = new ResizeObserver(() => {
      initializeStage();
    });

    if (stageRef.current) {
      observer.observe(stageRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [initializeStage]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const handlePointerTypeChange = () => {
      setIsCoarsePointer(mediaQuery.matches);
      clearPlacementState();
    };

    const initializePointerTypeTimer = window.setTimeout(() => {
      handlePointerTypeChange();
    }, 0);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handlePointerTypeChange);

      return () => {
        window.clearTimeout(initializePointerTypeTimer);
        mediaQuery.removeEventListener("change", handlePointerTypeChange);
      };
    }

    mediaQuery.addListener(handlePointerTypeChange);

    return () => {
      window.clearTimeout(initializePointerTypeTimer);
      mediaQuery.removeListener(handlePointerTypeChange);
    };
  }, [clearPlacementState]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      const wallet = loadVoiceZooWallet(audioOwnerId);
      setWalletCoins(wallet.coins);
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
    };
  }, [audioOwnerId]);

  useEffect(() => {
    const walletStorageKey = getVoiceZooWalletStorageKey(audioOwnerId);

    const handleWalletStorageUpdate = (event: StorageEvent) => {
      if (event.key !== walletStorageKey) {
        return;
      }

      const wallet = parseVoiceZooWallet(event.newValue);
      setWalletCoins(wallet.coins);
    };

    const handleLocalWalletUpdate: EventListener = (event) => {
      const customEvent = event as CustomEvent<VoiceZooWalletUpdatedEventDetail>;

      if (customEvent.detail && customEvent.detail.ownerId !== audioOwnerId) {
        return;
      }

      if (customEvent.detail?.wallet) {
        setWalletCoins(customEvent.detail.wallet.coins);
        return;
      }

      const wallet = loadVoiceZooWallet(audioOwnerId);
      setWalletCoins(wallet.coins);
    };

    window.addEventListener("storage", handleWalletStorageUpdate);
    window.addEventListener(VOICE_ZOO_WALLET_UPDATED_EVENT, handleLocalWalletUpdate);

    return () => {
      window.removeEventListener("storage", handleWalletStorageUpdate);
      window.removeEventListener(VOICE_ZOO_WALLET_UPDATED_EVENT, handleLocalWalletUpdate);
    };
  }, [audioOwnerId]);

  useEffect(() => {
    const applySessionUserDeferred = (sessionUserId: string | undefined) => {
      const resolvedUserId = sessionUserId || "local_guest";

      void Promise.resolve().then(() => {
        setViewerId(resolvedUserId);

        if (!audioOwnerIdOverride) {
          setAudioOwnerId(resolvedUserId);
        }
      });
    };

    const supabase = getSupabaseClient();

    if (!supabase) {
      applySessionUserDeferred(undefined);
      return;
    }

    const applySessionUser = (sessionUserId: string | undefined) => {
      applySessionUserDeferred(sessionUserId);
    };

    void getSupabaseSessionOrNull(supabase).then((session) => {
      applySessionUser(session?.user?.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySessionUser(session?.user?.id);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [audioOwnerIdOverride]);

  const saveCharacterPosition = useCallback(() => {
    if (!characterPositionStorageKey) {
      return;
    }

    const currentWorldPosition = toCharacterWorldPosition(
      desiredOffsetRef.current,
      movementBounds,
    );
    const serializedPosition = JSON.stringify(currentWorldPosition);

    if (serializedPosition === lastSavedCharacterPositionRef.current) {
      return;
    }

    window.localStorage.setItem(characterPositionStorageKey, serializedPosition);
    lastSavedCharacterPositionRef.current = serializedPosition;
  }, [characterPositionStorageKey, movementBounds]);

  useEffect(() => {
    if (!characterPositionStorageKey) {
      return;
    }

    const loadTimer = window.setTimeout(() => {
      const storedPosition = parseGardenCharacterPosition(
        window.localStorage.getItem(characterPositionStorageKey),
      );

      if (!storedPosition) {
        return;
      }

      const nextOffset = toCharacterOffset(storedPosition, movementBounds);
      desiredOffsetRef.current = clampCharacterBounds(nextOffset);
      cameraOffsetRef.current = clampCameraBounds(desiredOffsetRef.current);
      velocityRef.current = { x: 0, y: 0 };
      previousTimestampRef.current = 0;
      applyWorldTransform();
      applyCharacterTransform();

      const clampedWorldPosition = toCharacterWorldPosition(
        desiredOffsetRef.current,
        movementBounds,
      );
      updateActiveAutoPlaybackVolumes(clampedWorldPosition.x, clampedWorldPosition.y);
      lastSavedCharacterPositionRef.current = JSON.stringify(clampedWorldPosition);
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
    };
  }, [
    applyCharacterTransform,
    applyWorldTransform,
    characterPositionStorageKey,
    clampCameraBounds,
    clampCharacterBounds,
    movementBounds,
    updateActiveAutoPlaybackVolumes,
  ]);

  useEffect(() => {
    if (!characterPositionStorageKey) {
      return;
    }

    const handlePageHide = () => {
      saveCharacterPosition();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        saveCharacterPosition();
      }
    };

    const timerId = window.setInterval(() => {
      saveCharacterPosition();
    }, CHARACTER_POSITION_SAVE_INTERVAL_MS);

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(timerId);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      saveCharacterPosition();
    };
  }, [characterPositionStorageKey, saveCharacterPosition]);

  useEffect(() => {
    const handleRecordingUpdate: EventListener = (event) => {
      const customEvent = event as CustomEvent<VoiceZooRecordingUpdatedEventDetail>;
      const ownerId = customEvent.detail?.ownerId;
      const objectType = customEvent.detail?.objectType;
      const recordingId = customEvent.detail?.recordingId;

      if (ownerId && ownerId !== effectiveAudioOwnerId) {
        return;
      }

      if (objectType && recordingId) {
        setPlacedObjects((current) => {
          let didChange = false;

          const nextObjects = current.map((placedObject) => {
            if (placedObject.objectType !== objectType) {
              return placedObject;
            }

            if (placedObject.recordingId === recordingId) {
              return placedObject;
            }

            didChange = true;
            return {
              ...placedObject,
              recordingId,
            };
          });

          return didChange ? nextObjects : current;
        });
      }

      setRecordingReloadNonce((current) => current + 1);
    };

    window.addEventListener(VOICE_ZOO_RECORDING_UPDATED_EVENT, handleRecordingUpdate);

    return () => {
      window.removeEventListener(VOICE_ZOO_RECORDING_UPDATED_EVENT, handleRecordingUpdate);
    };
  }, [effectiveAudioOwnerId]);

  useEffect(() => {
    if (shouldUseMobileLightweightMode) {
      return;
    }

    let cancelled = false;

    const loadRecordingCatalogAndBlobs = async () => {
      const catalogStorageKey = getVoiceZooRecordingCatalogStorageKey(effectiveAudioOwnerId);
      let recordingCatalog = parseVoiceZooRecordingCatalog(
        window.localStorage.getItem(catalogStorageKey),
      );

      const hasRecordingForType = (objectType: ObjectType) =>
        recordingCatalog.some((recording) => recording.objectType === objectType);

      let didCatalogChange = false;

      // Migrate legacy single-recording keys into the new per-recording catalog.
      for (const objectType of VOICE_ZOO_SUPPORTED_OBJECT_TYPES) {
        if (hasRecordingForType(objectType)) {
          continue;
        }

        const legacyBlob = await get(
          getVoiceZooLegacyRecordingStorageKey(effectiveAudioOwnerId, objectType),
        );

        if (!(legacyBlob instanceof Blob)) {
          continue;
        }

        const migratedRecordingId = createVoiceZooRecordingId(objectType);
        await set(
          getVoiceZooRecordingBlobStorageKey(effectiveAudioOwnerId, migratedRecordingId),
          legacyBlob,
        );

        recordingCatalog = [
          ...recordingCatalog,
          {
            id: migratedRecordingId,
            objectType,
            createdAt: new Date().toISOString(),
          },
        ];
        didCatalogChange = true;
      }

      if (didCatalogChange) {
        window.localStorage.setItem(catalogStorageKey, JSON.stringify(recordingCatalog));
      }

      const loadedBlobEntries = await Promise.all(
        recordingCatalog.map(async (recordingMeta) => {
          const blob = await get(
            getVoiceZooRecordingBlobStorageKey(effectiveAudioOwnerId, recordingMeta.id),
          );

          if (!(blob instanceof Blob)) {
            return {
              recordingId: recordingMeta.id,
              blob: null,
            };
          }

          return {
            recordingId: recordingMeta.id,
            blob,
          };
        }),
      );

      if (cancelled) {
        return;
      }

      const nextRecordingBlobByRecordingId: Record<string, Blob> = {};

      for (const loadedEntry of loadedBlobEntries) {
        if (!loadedEntry.blob) {
          continue;
        }

        nextRecordingBlobByRecordingId[loadedEntry.recordingId] = loadedEntry.blob;
      }

      setRecordingBlobByRecordingId(nextRecordingBlobByRecordingId);
      setLatestRecordingIdByObjectType(
        getLatestRecordingIdByObjectType(recordingCatalog),
      );
    };

    void loadRecordingCatalogAndBlobs();

    return () => {
      cancelled = true;
    };
  }, [effectiveAudioOwnerId, recordingReloadNonce, shouldUseMobileLightweightMode]);

  useEffect(() => {
    let cancelled = false;
    const recordingGardenOwnerId = effectiveAudioOwnerId || "local_guest";
    const recordingOwnerId = isReadonlyVisitorGarden
      ? viewerId || "local_guest"
      : recordingGardenOwnerId;
    const catalogStorageKey = getGardenHarmonyRecordingCatalogStorageKey(
      recordingOwnerId,
      recordingGardenOwnerId,
    );

    const loadHarmonyRecordings = async () => {
      const catalog = parseGardenHarmonyRecordingCatalog(
        window.localStorage.getItem(catalogStorageKey),
      );

      const loadedEntries = await Promise.all(
        catalog.map(async (entry) => {
          const blob = await get(
            getGardenHarmonyRecordingBlobStorageKey(
              recordingOwnerId,
              recordingGardenOwnerId,
              entry.recordingId,
            ),
          );

          if (!(blob instanceof Blob) || blob.size === 0) {
            return null;
          }

          return {
            objectId: entry.objectId,
            objectType: entry.objectType,
            recordingId: entry.recordingId,
            createdAt: entry.createdAt,
            blob,
          };
        }),
      );

      if (cancelled) {
        return;
      }

      const mergedEntryByObjectId = new Map<string, LoadedHarmonyRecording>();

      for (const loadedEntry of loadedEntries) {
        if (!loadedEntry) {
          continue;
        }

        mergedEntryByObjectId.set(loadedEntry.objectId, loadedEntry);
      }

      if (isUuidLike(recordingGardenOwnerId)) {
        const remoteEntries = await fetchHarmonyRecordingsFromSupabase(
          recordingGardenOwnerId,
        );

        if (cancelled) {
          return;
        }

        for (const remoteEntry of remoteEntries) {
          mergedEntryByObjectId.set(remoteEntry.objectId, remoteEntry);
        }

        if (remoteEntries.length > 0) {
          await Promise.allSettled(
            remoteEntries.map((remoteEntry) =>
              set(
                getGardenHarmonyRecordingBlobStorageKey(
                  recordingOwnerId,
                  recordingGardenOwnerId,
                  remoteEntry.recordingId,
                ),
                remoteEntry.blob,
              ),
            ),
          );

          if (cancelled) {
            return;
          }
        }

        const mergedCatalog = Array.from(mergedEntryByObjectId.values()).map(
          ({ objectId, objectType, recordingId, createdAt }) => ({
            objectId,
            objectType,
            recordingId,
            createdAt,
          }),
        );

        window.localStorage.setItem(catalogStorageKey, JSON.stringify(mergedCatalog));
      }

      const nextRecordingIdByObjectId: Record<string, string> = {};
      const nextBlobByObjectId: Record<string, Blob> = {};

      for (const loadedEntry of mergedEntryByObjectId.values()) {
        nextRecordingIdByObjectId[loadedEntry.objectId] = loadedEntry.recordingId;
        nextBlobByObjectId[loadedEntry.objectId] = loadedEntry.blob;
      }

      setHarmonyRecordingIdByObjectId(nextRecordingIdByObjectId);
      setHarmonyRecordingBlobByObjectId(nextBlobByObjectId);
    };

    void loadHarmonyRecordings();

    const handleStorageUpdate = (event: StorageEvent) => {
      if (event.key !== catalogStorageKey) {
        return;
      }

      void loadHarmonyRecordings();
    };

    window.addEventListener("storage", handleStorageUpdate);

    const unsubscribeHarmonyUpdates = isUuidLike(recordingGardenOwnerId)
      ? subscribeToHarmonyRecordingUpdates(recordingGardenOwnerId, () => {
          void loadHarmonyRecordings();
        })
      : null;

    return () => {
      cancelled = true;
      window.removeEventListener("storage", handleStorageUpdate);
      unsubscribeHarmonyUpdates?.();
    };
  }, [effectiveAudioOwnerId, isReadonlyVisitorGarden, viewerId]);

  useEffect(() => {
    if (shouldUseMobileLightweightMode) {
      return;
    }

    let cancelled = false;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publicBucketBaseUrl = supabaseUrl
      ? `${supabaseUrl}/storage/v1/object/public/garden-voices`
      : null;

    const resolveRemoteRecordingUrl = (placedObject: PlacedStageObject) => {
      if (typeof placedObject.recordingUrl === "string" && placedObject.recordingUrl.length > 0) {
        return placedObject.recordingUrl;
      }

      if (!publicBucketBaseUrl || typeof placedObject.recordingId !== "string") {
        return null;
      }

      const ownerPathSegment = encodeURIComponent(effectiveAudioOwnerId);
      const recordingPathSegment = encodeURIComponent(placedObject.recordingId);
      return `${publicBucketBaseUrl}/${ownerPathSegment}/${recordingPathSegment}.webm`;
    };

    const preloadRemoteRecordingBlobs = async () => {
      const targets = placedObjects.filter(
        (placedObject) =>
          typeof placedObject.recordingId === "string" &&
          Boolean(resolveRemoteRecordingUrl(placedObject)) &&
          !recordingBlobByRecordingIdRef.current[placedObject.recordingId],
      );

      if (targets.length === 0) {
        return;
      }

      const loadedEntries = await Promise.all(
        targets.map(async (placedObject) => {
          const remoteRecordingUrl = resolveRemoteRecordingUrl(placedObject);
          if (!remoteRecordingUrl) {
            return null;
          }

          try {
            const response = await fetch(remoteRecordingUrl, {
              cache: "no-store",
            });
            if (!response.ok) {
              return null;
            }

            const blob = await response.blob();
            if (!blob.size || !placedObject.recordingId) {
              return null;
            }

            return {
              recordingId: placedObject.recordingId,
              blob,
            };
          } catch {
            return null;
          }
        }),
      );

      if (cancelled) {
        return;
      }

      const nextEntries = loadedEntries.filter(
        (entry): entry is { recordingId: string; blob: Blob } => entry !== null,
      );

      if (nextEntries.length === 0) {
        return;
      }

      setRecordingBlobByRecordingId((current) => {
        const nextState = { ...current };
        for (const entry of nextEntries) {
          nextState[entry.recordingId] = entry.blob;
        }
        return nextState;
      });
    };

    void preloadRemoteRecordingBlobs();

    return () => {
      cancelled = true;
    };
  }, [
    effectiveAudioOwnerId,
    placedObjects,
    shouldUseMobileLightweightMode,
  ]);

  const syncAutoPlaybackSchedules = useCallback(() => {
    const activeObjectIds = new Set(
      placedObjectsRef.current.map((placedObject) => placedObject.id),
    );

    for (const objectId of Object.keys(autoPlaybackNextAtByObjectIdRef.current)) {
      if (!activeObjectIds.has(objectId)) {
        stopAutoPlaybackObject(objectId);
      }
    }

    for (const placedObject of placedObjectsRef.current) {
      if (!(placedObject.id in autoPlaybackNextAtByObjectIdRef.current)) {
        autoPlaybackNextAtByObjectIdRef.current[placedObject.id] =
          Date.now() + getRandomPlaybackDelayMs();
      }
    }
  }, [stopAutoPlaybackObject]);

  const runAutoPlaybackSchedulerTick = useCallback(() => {
    if (harmonyRecordingModal) {
      stopAutoPlayback();
      return;
    }

    if (isAudioSuppressedRef.current) {
      stopAutoPlayback();
      return;
    }

    syncAutoPlaybackSchedules();

    // 定期的にメモリクリーンアップを実行（5分ごと）
    if (!autoPlaybackSchedulerTimerRef.current || Date.now() % 30000 < AUTO_PLAYBACK_SCHEDULER_TICK_MS) {
      cleanupUnusedRecordingBlobs();
    }

    const now = Date.now();

    for (const placedObject of placedObjectsRef.current) {
      const objectId = placedObject.id;

      if (autoPlaybackInFlightObjectIdsRef.current.has(objectId)) {
        continue;
      }

      const nextPlaybackAt = autoPlaybackNextAtByObjectIdRef.current[objectId] ?? 0;

      if (nextPlaybackAt > now) {
        continue;
      }

      autoPlaybackNextAtByObjectIdRef.current[objectId] = now + getRandomPlaybackDelayMs();
      playAutoPlaybackForObject(objectId);
    }
  }, [
    cleanupUnusedRecordingBlobs,
    harmonyRecordingModal,
    playAutoPlaybackForObject,
    stopAutoPlayback,
    syncAutoPlaybackSchedules,
  ]);

  const startAutoPlaybackScheduler = useCallback(() => {
    if (harmonyRecordingModal) {
      stopAutoPlayback();
      return;
    }

    if (isAudioSuppressedRef.current) {
      return;
    }

    clearAutoPlaybackScheduler();
    runAutoPlaybackSchedulerTick();
    autoPlaybackSchedulerTimerRef.current = window.setInterval(
      runAutoPlaybackSchedulerTick,
      AUTO_PLAYBACK_SCHEDULER_TICK_MS,
    );
  }, [
    clearAutoPlaybackScheduler,
    harmonyRecordingModal,
    runAutoPlaybackSchedulerTick,
    stopAutoPlayback,
  ]);

  const ensureAutoPlaybackSchedulerRunning = useCallback(() => {
    if (autoPlaybackSchedulerTimerRef.current !== null) {
      return;
    }

    startAutoPlaybackScheduler();
  }, [startAutoPlaybackScheduler]);

  useEffect(() => {
    if (harmonyRecordingModal) {
      stopAutoPlayback();
      return;
    }

    if (!pathname.startsWith("/garden")) {
      stopAutoPlayback();
      return;
    }

    if (shouldUseMobileLightweightMode) {
      stopAutoPlayback();
      return;
    }

    if (isAudioSuppressed) {
      stopAutoPlayback();
      return;
    }

    startAutoPlaybackScheduler();

    return () => {
      stopAutoPlayback();
    };
  }, [
    harmonyRecordingModal,
    isAudioSuppressed,
    pathname,
    shouldUseMobileLightweightMode,
    startAutoPlaybackScheduler,
    stopAutoPlayback,
  ]);

  useEffect(() => {
    const handlePageHide = () => {
      stopAutoPlayback();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAutoPlayback();
        return;
      }

      if (
        pathname.startsWith("/garden") &&
        !shouldUseMobileLightweightMode &&
        !isAudioSuppressedRef.current &&
        !harmonyRecordingModal
      ) {
        ensureAutoPlaybackSchedulerRunning();
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    ensureAutoPlaybackSchedulerRunning,
    harmonyRecordingModal,
    pathname,
    shouldUseMobileLightweightMode,
    stopAutoPlayback,
  ]);

  useEffect(() => {
    if (!pathname.startsWith("/garden") || shouldUseMobileLightweightMode) {
      return;
    }

    const handleInteraction = () => {
      if (isAudioSuppressedRef.current || harmonyRecordingModal) {
        return;
      }

      ensureAutoPlaybackSchedulerRunning();
      void resumeAutoPlaybackAudioContextIfNeeded();
    };

    window.addEventListener("pointerdown", handleInteraction);
    window.addEventListener("keydown", handleInteraction);
    window.addEventListener("touchstart", handleInteraction);

    return () => {
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
    };
  }, [
    ensureAutoPlaybackSchedulerRunning,
    harmonyRecordingModal,
    pathname,
    shouldUseMobileLightweightMode,
    resumeAutoPlaybackAudioContextIfNeeded,
  ]);

  useEffect(() => {
    return () => {
      for (const timerId of coinRewardPopupTimerIdsRef.current) {
        window.clearTimeout(timerId);
      }

      if (walletGainPopupTimerIdRef.current !== null) {
        window.clearTimeout(walletGainPopupTimerIdRef.current);
        walletGainPopupTimerIdRef.current = null;
      }

      if (placementBlockedNoticeTimerIdRef.current !== null) {
        window.clearTimeout(placementBlockedNoticeTimerIdRef.current);
        placementBlockedNoticeTimerIdRef.current = null;
      }

      for (const timerId of Object.values(rewardVideoTimerByObjectIdRef.current)) {
        window.clearTimeout(timerId);
      }

      rewardVideoTimerByObjectIdRef.current = {};

      coinRewardPopupTimerIdsRef.current = [];
    };
  }, []);

  useEffect(() => {
    return () => {
      clearHarmonyRecordingTimers();
      stopHarmonyIndividualPreviewPlayback();
      stopHarmonyDualPreviewPlayback();
      stopHarmonyWaveformAnimation();

      const recorder = harmonyRecordingMediaRecorderRef.current;
      harmonyRecordingMediaRecorderRef.current = null;

      if (recorder && recorder.state !== "inactive") {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.stop();
      }

      stopHarmonyRecordingStream();

      const ownerPreviewUrl = harmonyPreviewOwnerAudioUrlRef.current;
      if (ownerPreviewUrl) {
        URL.revokeObjectURL(ownerPreviewUrl);
        harmonyPreviewOwnerAudioUrlRef.current = null;
      }

      const layerPreviewUrl = harmonyPreviewLayerAudioUrlRef.current;
      if (layerPreviewUrl) {
        URL.revokeObjectURL(layerPreviewUrl);
        harmonyPreviewLayerAudioUrlRef.current = null;
      }
    };
  }, [
    clearHarmonyRecordingTimers,
    stopHarmonyIndividualPreviewPlayback,
    stopHarmonyDualPreviewPlayback,
    stopHarmonyRecordingStream,
    stopHarmonyWaveformAnimation,
  ]);

  useEffect(() => {
    return () => {
      for (const sourceNode of Object.values(autoPlaybackSourceNodeByObjectIdRef.current)) {
        sourceNode.disconnect();
      }

      for (const gainNode of Object.values(autoPlaybackGainNodeByObjectIdRef.current)) {
        gainNode.disconnect();
      }

      autoPlaybackSourceNodeByObjectIdRef.current = {};
      autoPlaybackGainNodeByObjectIdRef.current = {};

      const audioContext = autoPlaybackAudioContextRef.current;
      autoPlaybackAudioContextRef.current = null;

      if (audioContext) {
        void audioContext.close();
      }
    };
  }, []);

  useEffect(() => {
    if (isCoarsePointer || !isMousePlacementArmed) {
      return;
    }

    const handleWindowPointerMove = (event: PointerEvent) => {
      const targetPosition = getWorldPositionFromClient(event.clientX, event.clientY);
      if (!targetPosition) {
        return;
      }

      setPointerWorldPosition(targetPosition);
    };

    window.addEventListener("pointermove", handleWindowPointerMove, {
      passive: true,
    });

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
    };
  }, [getWorldPositionFromClient, isCoarsePointer, isMousePlacementArmed]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (MOVEMENT_KEYS.includes(key)) {
        event.preventDefault();
        activeKeysRef.current.add(key);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (MOVEMENT_KEYS.includes(key)) {
        event.preventDefault();
        activeKeysRef.current.delete(key);
      }
    };

    const handleWindowBlur = () => {
      activeKeysRef.current.clear();
      clearJoystickInput();
      velocityRef.current = { x: 0, y: 0 };
      resetCharacterAnimationState();
      clearPlacementState();
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp, { passive: false });
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [clearJoystickInput, clearPlacementState, resetCharacterAnimationState]);

  useEffect(() => {
    const animate = (timestamp: number) => {
      const deltaSeconds =
        previousTimestampRef.current === 0
          ? 0
          : Math.min(MAX_DELTA_SECONDS, (timestamp - previousTimestampRef.current) / 1000);
      previousTimestampRef.current = timestamp;

      const inputAxis = getInputAxis(activeKeysRef.current);
      const joystickAxis = joystickVectorRef.current;
      const combinedTargetVelocity = limitVectorMagnitude(
        {
          x: inputAxis.x * MOVE_MAX_SPEED + joystickAxis.x * MOVE_MAX_SPEED,
          y: inputAxis.y * MOVE_MAX_SPEED + joystickAxis.y * MOVE_MAX_SPEED,
        },
        MOVE_MAX_SPEED,
      );
      const hasInput = combinedTargetVelocity.x !== 0 || combinedTargetVelocity.y !== 0;
      const response = hasInput ? ACCEL_RESPONSE : BRAKE_RESPONSE;

      const targetVelocityX = combinedTargetVelocity.x;
      const targetVelocityY = combinedTargetVelocity.y;

      velocityRef.current.x +=
        (targetVelocityX - velocityRef.current.x) * Math.min(1, response * deltaSeconds);
      velocityRef.current.y +=
        (targetVelocityY - velocityRef.current.y) * Math.min(1, response * deltaSeconds);

      if (Math.abs(velocityRef.current.x) < 0.2) {
        velocityRef.current.x = 0;
      }

      if (Math.abs(velocityRef.current.y) < 0.2) {
        velocityRef.current.y = 0;
      }

      syncCharacterAnimationState(velocityRef.current);

      if (velocityRef.current.x !== 0 || velocityRef.current.y !== 0) {
        const rawNextOffset = clampCharacterBounds({
          x: desiredOffsetRef.current.x + velocityRef.current.x * deltaSeconds,
          y: desiredOffsetRef.current.y + velocityRef.current.y * deltaSeconds,
        });

        desiredOffsetRef.current = resolveMovement(
          desiredOffsetRef.current,
          rawNextOffset,
          hitmapRef.current ? [] : collisionZones,
          CHARACTER_HITBOX_RADIUS,
          hitmapRef.current,
        );

        cameraOffsetRef.current = clampCameraBounds({
          x: desiredOffsetRef.current.x,
          y: desiredOffsetRef.current.y,
        });
        applyWorldTransform();
        applyCharacterTransform();
        updateActiveAutoPlaybackVolumes(
          WORLD_WIDTH / 2 + desiredOffsetRef.current.x,
          WORLD_HEIGHT / 2 + desiredOffsetRef.current.y,
        );
      }

      animationFrameRef.current = window.requestAnimationFrame(animate);
    };

    animationFrameRef.current = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrameRef.current);
    };
  }, [
    applyCharacterTransform,
    applyWorldTransform,
    clampCameraBounds,
    clampCharacterBounds,
    collisionZones,
    syncCharacterAnimationState,
    updateActiveAutoPlaybackVolumes,
  ]);

  const objectChipFillColor = darkMode ? "rgba(43,43,43,0.78)" : "rgba(242,242,242,0.95)";
  const objectChipStrokeColor = darkMode
    ? "rgba(242,242,242,0.45)"
    : "rgba(43,43,43,0.22)";
  const objectChipTextColor = darkMode ? "#F2F2F2" : "#2B2B2B";
  const liftedShadowColor = darkMode
    ? "rgba(0,0,0,0.45)"
    : "rgba(43,43,43,0.28)";
  const placementGuideFillColor = canPlaceObject
    ? darkMode
      ? "rgba(74,222,128,0.28)"
      : "rgba(34,197,94,0.22)"
    : darkMode
      ? "rgba(242,242,242,0.15)"
      : "rgba(165,33,117,0.14)";
  const placementGuideStrokeColor = canPlaceObject
    ? darkMode
      ? "rgba(134,239,172,0.9)"
      : "rgba(22,163,74,0.88)"
    : darkMode
      ? "rgba(242,242,242,0.7)"
      : "rgba(165,33,117,0.75)";
  const locatorArrowFillColor = darkMode
    ? "rgba(134,239,172,0.92)"
    : "rgba(22,163,74,0.96)";
  const locatorArrowChipFillColor = darkMode
    ? "rgba(15,23,42,0.8)"
    : "rgba(255,255,255,0.9)";
  const isPointerPlacementArmed = isCoarsePointer
    ? isTouchPlacementArmed
    : isMousePlacementArmed;
  const isTouchPlacementLifted = hasPlacedActiveObject && isPointerPlacementArmed;
  const liftedObjectId =
    hasPlacedActiveObject &&
    isTouchPlacementLifted &&
    grabbedPlacedObject
      ? grabbedPlacedObject.id
      : null;
  const previewIconY = isTouchPlacementLifted ? -18 : 0;
  const previewChipY = previewIconY + 24;
  const previewChipTextY = previewIconY + 34;
  const stageCursorClass =
    canPlaceObject && !isCoarsePointer
      ? hasPlacedActiveObject
        ? isMousePlacementArmed
          ? "cursor-grabbing"
          : "cursor-grab"
        : hasPlacedSelectedObject
          ? "cursor-default"
        : "cursor-crosshair"
      : "";
  const shouldRenderPlacementPreview =
    canPlaceObject &&
    Boolean(pointerWorldPosition) &&
    ((hasPlacedActiveObject && isPointerPlacementArmed) ||
      (!hasPlacedSelectedObject && (!isCoarsePointer || isTouchPlacementArmed)));
  const shouldRenderObjectLocator =
    isObjectLocatorVisible &&
    Boolean(objectLocatorIndicator);
  const characterImageSrc =
    isWalking && isCharacterWalkFrame
      ? CHARACTER_WALK_IMAGE_SRC
      : CHARACTER_IDLE_IMAGE_SRC;
  const characterImageSizePx =
    characterImageSrc === CHARACTER_IDLE_IMAGE_SRC
      ? CHARACTER_IDLE_IMAGE_SIZE_PX
      : CHARACTER_WALK_IMAGE_SIZE_PX;
  const hasHarmonyRecordingForModal = harmonyRecordingModal
    ? Boolean(harmonyRecordingIdByObjectId[harmonyRecordingModal.objectId])
    : false;
  const canCloseHarmonyRecordingModal = !isHarmonyRecording;
  const canPreviewOwnerAudio = Boolean(harmonyPreviewOwnerAudioUrl);
  const canPreviewLayerAudio = Boolean(harmonyPreviewLayerAudioUrl);
  const canPlayCombinedPreview = canPreviewOwnerAudio || canPreviewLayerAudio;

  const mobileStickPanelClass = `pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] right-3 z-40 rounded-2xl border p-2 backdrop-blur-sm sm:hidden ${
    darkMode
      ? "border-wa-white/30 bg-wa-black/40"
      : "border-wa-black/20 bg-wa-white/70"
  }`;

  return (
    <>
      <EmptyStageCharacterStage
        darkMode={darkMode}
        isWalking={isWalking}
        characterImageSrc={characterImageSrc}
        characterImageSizePx={characterImageSizePx}
        characterFacingDirection={characterFacingDirection}
        characterHorizontalFacing={characterHorizontalFacing}
        isPlacementBlocked={isPlacementBlocked}
        placementBlockedNotice={placementBlockedNotice}
        stageRef={stageRef}
        worldRef={worldRef}
        characterRef={characterRef}
        stageCursorClass={stageCursorClass}
        onStagePointerMove={handleStagePointerMove}
        onStagePointerDown={handleStagePointerDown}
        onStagePointerLeave={handleStagePointerLeave}
        placedObjects={placedObjects}
        rewardVideoPlaybackByObjectId={rewardVideoPlaybackByObjectId}
        coinRewardPopups={coinRewardPopups}
        liftedObjectId={liftedObjectId}
        objectChipFillColor={objectChipFillColor}
        objectChipStrokeColor={objectChipStrokeColor}
        objectChipTextColor={objectChipTextColor}
        shouldRenderPlacementPreview={shouldRenderPlacementPreview}
        pointerWorldPosition={pointerWorldPosition}
        activePlacementObject={activePlacementObject}
        isTouchPlacementLifted={isTouchPlacementLifted}
        liftedShadowColor={liftedShadowColor}
        placementGuideFillColor={placementGuideFillColor}
        placementGuideStrokeColor={placementGuideStrokeColor}
        previewIconY={previewIconY}
        previewChipY={previewChipY}
        previewChipTextY={previewChipTextY}
        shouldRenderObjectLocator={shouldRenderObjectLocator}
        objectLocatorIndicator={objectLocatorIndicator}
        locatorArrowFillColor={locatorArrowFillColor}
        locatorArrowChipFillColor={locatorArrowChipFillColor}
      >
        {children}
      </EmptyStageCharacterStage>

      <EmptyStageCharacterControls
        allowObjectPlacement={allowObjectPlacement}
        walletCoins={walletCoins}
        walletGainPopup={walletGainPopup}
        mobileStickPanelClass={mobileStickPanelClass}
        darkMode={darkMode}
        stickPadRef={stickPadRef}
        stickKnobRef={stickKnobRef}
        onStickPointerDown={handleStickPointerDown}
        onStickPointerMove={handleStickPointerMove}
        onStickPointerEnd={handleStickPointerEnd}
      />

      {canAcceptHarmonyFromVisitors && harmonyRecordingModal ? (
        <div className="fixed inset-0 z-[210] isolate grid place-items-center p-4 sm:p-6">
          <button
            type="button"
            aria-label="ハーモニー録音モーダルを閉じる"
            className="absolute inset-0 bg-wa-black/85 backdrop-blur-md"
            onClick={canCloseHarmonyRecordingModal ? closeHarmonyRecordingModal : undefined}
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-label={`${harmonyRecordingModal.objectLabel}のハーモニー録音`}
            className={`relative z-10 grid w-full max-w-xl gap-4 overflow-hidden rounded-[1.75rem] border p-5 shadow-[0_40px_110px_rgba(0,0,0,0.55)] ${
              darkMode
                ? "border-[#e6d2b3]/40 bg-[radial-gradient(circle_at_12%_4%,rgba(255,255,255,0.24)_0%,rgba(79,61,40,0.88)_52%,rgba(28,22,17,0.95)_100%)] text-[#fff7ea]"
                : "border-[#b78c58]/55 bg-[radial-gradient(circle_at_12%_4%,rgba(255,255,255,0.98)_0%,rgba(248,236,214,0.96)_54%,rgba(230,204,163,0.94)_100%)] text-[#2f2319]"
            }`}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div
              className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border ${
                darkMode
                  ? "border-[#f0d9b4]/20 bg-[#f0d9b4]/10"
                  : "border-[#c5965f]/30 bg-[#f0d7ad]/35"
              }`}
            />
            <div
              className={`pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full blur-2xl ${
                darkMode
                  ? "bg-[#f0d9b4]/8"
                  : "bg-[#e9c58a]/25"
              }`}
            />
            <div
              className={`pointer-events-none absolute inset-y-6 left-4 w-px ${
                darkMode ? "bg-[#f3dfc0]/20" : "bg-[#b7874d]/30"
              }`}
            />
            <div
              className={`pointer-events-none absolute inset-y-6 right-4 w-px ${
                darkMode ? "bg-[#f3dfc0]/20" : "bg-[#b7874d]/30"
              }`}
            />

            <div className="relative z-10 flex items-start gap-3">
              <div
                className={`grid h-12 w-12 place-items-center rounded-full border text-2xl ${
                  darkMode
                    ? "border-[#f2dfc3]/30 bg-[#f2dfc3]/12"
                    : "border-[#b7874d]/35 bg-[#fff9ee]/90"
                }`}
              >
                ♪
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  {harmonyRecordingModal.objectLabel}にハーモニーを重ねる
                </h2>
              </div>
            </div>

            <div
              className={`relative z-10 grid gap-2 rounded-xl border p-4 ${
                darkMode
                  ? "border-[#f2dfc3]/25 bg-[#2b2118]/80"
                  : "border-[#b7874d]/25 bg-[#fff8ea]/90"
              }`}
            >
              <p className={`text-xs ${darkMode ? "text-[#f9e9cf]/75" : "text-[#5e4531]/75"}`}>
                録音カウントダウン
              </p>
              <p className="text-4xl font-bold leading-none">
                {isHarmonyRecording
                  ? `${harmonyRecordingCountdown}s`
                  : `${HARMONY_RECORDING_DURATION_SECONDS}s`}
              </p>
            </div>

            <div
              className={`relative z-10 mb-1 rounded-xl border p-3 ${
                darkMode
                  ? "border-[#f2dfc3]/20 bg-[#2a2017]/75"
                  : "border-[#b7874d]/20 bg-[#fff8ea]/85"
              }`}
            >
              <canvas
                ref={harmonyRecordingWaveformCanvasRef}
                className={`h-16 w-full rounded-lg transition-opacity ${isHarmonyRecording ? "opacity-100" : "opacity-45"}`}
                aria-hidden
              />
              <p className={`mt-2 text-center text-[11px] font-medium tracking-wide ${darkMode ? "text-[#f9e9cf]/62" : "text-[#6b5039]/62"}`}>
                {isHarmonyRecording ? "音声を検出中..." : "録音を開始すると波形が動きます"}
              </p>
            </div>

            {harmonyRecordingNotice ? (
              <p
                className={`relative z-10 rounded-lg border px-3 py-2 text-xs ${
                  darkMode
                    ? "border-[#f2dfc3]/25 bg-[#2b2219]/85 text-[#fff7ea]/90"
                    : "border-[#b7874d]/25 bg-[#fffdf5] text-[#2f2319]"
                }`}
              >
                {harmonyRecordingNotice}
              </p>
            ) : null}

            <div
              className={`relative z-10 grid gap-3 rounded-xl border p-3 ${
                darkMode
                  ? "border-[#f2dfc3]/25 bg-[#2a2017]/75"
                  : "border-[#b7874d]/25 bg-[#fff8ea]/88"
              }`}
            >
              <p className={`text-xs font-semibold ${darkMode ? "text-[#f9e9cf]/82" : "text-[#4f3927]/82"}`}>
                プレビュー
              </p>

              <button
                type="button"
                onClick={playHarmonyCombinedPreview}
                disabled={!canPlayCombinedPreview || isHarmonyRecording}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-all duration-150 ease-out ${
                  !canPlayCombinedPreview || isHarmonyRecording
                    ? darkMode
                      ? "cursor-not-allowed border-[#f2dfc3]/20 bg-[#f2dfc3]/10 text-[#fff7ea]/45"
                      : "cursor-not-allowed border-[#b7874d]/20 bg-[#b7874d]/10 text-[#4f3927]/50"
                    : darkMode
                      ? "border-[#f2dfc3]/40 hover:-translate-y-0.5 hover:bg-[#f2dfc3]/20 active:translate-y-[1px] active:scale-[0.98]"
                      : "border-[#b7874d]/35 bg-[#fffdf5] hover:-translate-y-0.5 hover:bg-[#f8ecd6] active:translate-y-[1px] active:scale-[0.98]"
                }`}
              >
                {isHarmonyDualPreviewPlaying
                  ? "同時プレビューを停止"
                  : "2つの音声を同時に聞く"}
              </button>

              <details
                className={`rounded-lg border px-3 py-2 ${
                  darkMode
                    ? "border-[#f2dfc3]/20 bg-[#2b2219]/70"
                    : "border-[#b7874d]/20 bg-[#fffdf5]"
                }`}
              >
                <summary
                  className={`cursor-pointer text-xs font-semibold ${
                    darkMode ? "text-[#f9e9cf]/85" : "text-[#4f3927]/82"
                  }`}
                >
                  個別プレビュー
                </summary>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1">
                    <p className={`text-[11px] font-medium ${darkMode ? "text-[#f9e9cf]/70" : "text-[#6b5039]/70"}`}>
                      庭主の音声
                    </p>
                    {harmonyPreviewOwnerAudioUrl ? (
                      <audio
                        ref={harmonyOwnerPreviewAudioElementRef}
                        controls
                        preload="auto"
                        src={harmonyPreviewOwnerAudioUrl}
                        onLoadedMetadata={(event) => {
                          applyOwnerPreviewPlaybackEffect(
                            event.currentTarget,
                            harmonyRecordingModal.objectType,
                          );
                        }}
                        onPlay={(event) => {
                          stopHarmonyDualPreviewPlayback();
                          const layerPreviewAudio = harmonyLayerPreviewAudioElementRef.current;

                          if (layerPreviewAudio && layerPreviewAudio !== event.currentTarget) {
                            layerPreviewAudio.pause();
                            layerPreviewAudio.currentTime = 0;
                          }
                        }}
                        className="w-full"
                      />
                    ) : (
                      <p className={`rounded-lg border px-2 py-2 text-[11px] ${
                        darkMode
                          ? "border-[#f2dfc3]/20 bg-[#f2dfc3]/5 text-[#f9e9cf]/65"
                          : "border-[#b7874d]/20 bg-[#b7874d]/5 text-[#6b5039]/65"
                      }`}>
                        庭主の録音がまだ見つかりません。
                      </p>
                    )}
                  </div>

                  <div className="grid gap-1">
                    <p className={`text-[11px] font-medium ${darkMode ? "text-[#f9e9cf]/70" : "text-[#6b5039]/70"}`}>
                      あなたのハーモニー
                    </p>
                    {harmonyPreviewLayerAudioUrl ? (
                      <audio
                        ref={harmonyLayerPreviewAudioElementRef}
                        controls
                        preload="auto"
                        src={harmonyPreviewLayerAudioUrl}
                        onLoadedMetadata={(event) => {
                          applyLayerPreviewPlaybackEffect(
                            event.currentTarget,
                            harmonyRecordingModal.objectType,
                          );
                        }}
                        onPlay={(event) => {
                          stopHarmonyDualPreviewPlayback();
                          const ownerPreviewAudio = harmonyOwnerPreviewAudioElementRef.current;

                          if (ownerPreviewAudio && ownerPreviewAudio !== event.currentTarget) {
                            ownerPreviewAudio.pause();
                            ownerPreviewAudio.currentTime = 0;
                          }
                        }}
                        className="w-full"
                      />
                    ) : (
                      <p className={`rounded-lg border px-2 py-2 text-[11px] ${
                        darkMode
                          ? "border-[#f2dfc3]/20 bg-[#f2dfc3]/5 text-[#f9e9cf]/65"
                          : "border-[#b7874d]/20 bg-[#b7874d]/5 text-[#6b5039]/65"
                      }`}>
                        3秒録音するとここで確認できます。
                      </p>
                    )}
                  </div>
                </div>
              </details>
            </div>

            <div
              className={`relative z-10 mt-1 flex flex-wrap gap-2 border-t pt-3 ${
                darkMode
                  ? "border-[#f2dfc3]/20"
                  : "border-[#b7874d]/20"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  void startHarmonyObjectRecording();
                }}
                disabled={isHarmonyRecording}
                className={`rounded-md border px-4 py-2 text-sm font-semibold transition-all duration-150 ease-out ${
                  isHarmonyRecording
                    ? darkMode
                      ? "cursor-not-allowed border-[#f2dfc3]/20 bg-[#f2dfc3]/10 text-[#fff7ea]/45"
                      : "cursor-not-allowed border-[#b7874d]/20 bg-[#b7874d]/10 text-[#4f3927]/50"
                    : darkMode
                      ? "border-[#f2c58f]/40 bg-[#8a5c34]/45 hover:-translate-y-0.5 hover:bg-[#9d6b3f]/55 active:translate-y-[1px] active:scale-[0.98]"
                      : "border-[#b05f48]/35 bg-[#c8674c]/14 hover:-translate-y-0.5 hover:bg-[#c8674c]/22 active:translate-y-[1px] active:scale-[0.98]"
                }`}
              >
                {isHarmonyRecording
                  ? "録音中..."
                  : hasHarmonyRecordingForModal
                    ? "録音しなおす（3秒）"
                    : "3秒録音を開始"}
              </button>

              <button
                type="button"
                onClick={closeHarmonyRecordingModal}
                disabled={isHarmonyRecording}
                className={`rounded-md border px-4 py-2 text-sm transition-all duration-150 ease-out ${
                  !canCloseHarmonyRecordingModal
                    ? darkMode
                      ? "cursor-not-allowed border-[#f2dfc3]/20 bg-[#f2dfc3]/10 text-[#fff7ea]/45"
                      : "cursor-not-allowed border-[#b7874d]/20 bg-[#b7874d]/10 text-[#4f3927]/50"
                    : darkMode
                      ? "border-[#f2dfc3]/40 hover:-translate-y-0.5 hover:bg-[#f2dfc3]/10 active:translate-y-[1px] active:scale-[0.98]"
                      : "border-[#b7874d]/40 hover:-translate-y-0.5 hover:bg-[#f3e1bf]/45 active:translate-y-[1px] active:scale-[0.98]"
                }`}
              >
                {hasCompletedHarmonyRecording ? "完了" : "閉じる"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

type SupabaseHarmonyRecordingRow = {
  garden_owner_id: string;
  object_id: string;
  object_type: ObjectType;
  recording_id: string;
  recording_path: string;
  created_at: string | null;
  updated_at: string | null;
};

function isUuidLike(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isSupportedObjectType(value: unknown): value is ObjectType {
  return (
    typeof value === "string" &&
    VOICE_ZOO_SUPPORTED_OBJECT_TYPES.includes(value as ObjectType)
  );
}

function parseSupabaseHarmonyRecordingRow(value: unknown): SupabaseHarmonyRecordingRow | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<{
    garden_owner_id: unknown;
    object_id: unknown;
    object_type: unknown;
    recording_id: unknown;
    recording_path: unknown;
    created_at: unknown;
    updated_at: unknown;
  }>;

  if (
    typeof candidate.garden_owner_id !== "string" ||
    typeof candidate.object_id !== "string" ||
    !isSupportedObjectType(candidate.object_type) ||
    typeof candidate.recording_id !== "string" ||
    typeof candidate.recording_path !== "string"
  ) {
    return null;
  }

  return {
    garden_owner_id: candidate.garden_owner_id,
    object_id: candidate.object_id,
    object_type: candidate.object_type,
    recording_id: candidate.recording_id,
    recording_path: candidate.recording_path,
    created_at: typeof candidate.created_at === "string" ? candidate.created_at : null,
    updated_at: typeof candidate.updated_at === "string" ? candidate.updated_at : null,
  };
}

function resolveHarmonyRecordingStoragePath(
  uploaderId: string,
  objectId: string,
  recordingId: string,
) {
  const uploaderSegment = encodeURIComponent(uploaderId);
  const objectSegment = encodeURIComponent(objectId);
  const recordingSegment = encodeURIComponent(recordingId);
  return `${uploaderSegment}/harmony/${objectSegment}/${recordingSegment}.webm`;
}

type SaveHarmonyRecordingResult = "synced" | "disabled" | "error";

async function saveHarmonyRecordingToSupabase({
  blob,
  recordingId,
  objectId,
  objectType,
  gardenOwnerId,
  uploaderId,
}: {
  blob: Blob;
  recordingId: string;
  objectId: string;
  objectType: ObjectType;
  gardenOwnerId: string;
  uploaderId: string;
}): Promise<SaveHarmonyRecordingResult> {
  const supabase = getSupabaseClient();

  if (!supabase || !isUuidLike(gardenOwnerId) || !isUuidLike(uploaderId)) {
    return "error";
  }

  const { data: postRow, error: postRowError } = await supabase
    .from("garden_posts")
    .select("allow_harmony_overlays")
    .eq("user_id", gardenOwnerId)
    .maybeSingle();

  if (postRowError) {
    console.warn("Failed to check harmony permission:", postRowError.message);
    return "error";
  }

  if (
    typeof postRow?.allow_harmony_overlays === "boolean" &&
    !postRow.allow_harmony_overlays
  ) {
    return "disabled";
  }

  const recordingPath = resolveHarmonyRecordingStoragePath(
    uploaderId,
    objectId,
    recordingId,
  );
  const uploadResult = await supabase.storage
    .from("garden-voices")
    .upload(recordingPath, blob, {
      contentType: blob.type || "audio/webm",
      upsert: true,
    });

  if (uploadResult.error) {
    console.warn("Failed to upload harmony recording:", uploadResult.error.message);
    return "error";
  }

  const upsertResult = await supabase.from("garden_harmony_recordings").upsert(
    {
      garden_owner_id: gardenOwnerId,
      object_id: objectId,
      object_type: objectType,
      recording_id: recordingId,
      recording_path: recordingPath,
      created_by: uploaderId,
    },
    {
      onConflict: "garden_owner_id,object_id",
    },
  );

  if (upsertResult.error) {
    console.warn(
      "Failed to upsert harmony recording metadata:",
      upsertResult.error.message,
    );
    return "error";
  }

  return "synced";
}

async function fetchHarmonyRecordingsFromSupabase(
  gardenOwnerId: string,
): Promise<LoadedHarmonyRecording[]> {
  const supabase = getSupabaseClient();

  if (!supabase || !isUuidLike(gardenOwnerId)) {
    return [];
  }

  const { data, error } = await supabase
    .from("garden_harmony_recordings")
    .select(
      "garden_owner_id,object_id,object_type,recording_id,recording_path,created_at,updated_at",
    )
    .eq("garden_owner_id", gardenOwnerId);

  if (error || !Array.isArray(data)) {
    if (error) {
      console.warn("Failed to load harmony recording metadata:", error.message);
    }

    return [];
  }

  const normalizedRows = data
    .map((row) => parseSupabaseHarmonyRecordingRow(row))
    .filter((row): row is SupabaseHarmonyRecordingRow => row !== null);
  const loadedEntries = await Promise.all(
    normalizedRows.map(async (row) => {
      const { data: blob, error: downloadError } = await supabase.storage
        .from("garden-voices")
        .download(row.recording_path);

      if (downloadError || !(blob instanceof Blob) || blob.size <= 0) {
        return null;
      }

      return {
        objectId: row.object_id,
        objectType: row.object_type,
        recordingId: row.recording_id,
        createdAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
        blob,
      };
    }),
  );

  return loadedEntries.filter(
    (entry): entry is LoadedHarmonyRecording => entry !== null,
  );
}

function subscribeToHarmonyRecordingUpdates(
  gardenOwnerId: string,
  onUpdate: () => void,
) {
  const supabase = getSupabaseClient();

  if (!supabase || !isUuidLike(gardenOwnerId)) {
    return null;
  }

  const channel = supabase
    .channel(`garden-harmony:${gardenOwnerId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "garden_harmony_recordings",
        filter: `garden_owner_id=eq.${gardenOwnerId}`,
      },
      () => {
        onUpdate();
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
