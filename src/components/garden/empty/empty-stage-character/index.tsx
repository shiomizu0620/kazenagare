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
import { getSupabaseClient } from "@/lib/supabase/client";
import { getVoiceZooObjectPrice } from "@/lib/voice-zoo/catalog";
import { applyVoiceZooPlaybackEffect } from "@/lib/voice-zoo/playback-effects";
import {
  createVoiceZooRecordingId,
  getLatestRecordingIdByObjectType,
  getVoiceZooLegacyRecordingStorageKey,
  getVoiceZooRecordingBlobStorageKey,
  getVoiceZooRecordingCatalogStorageKey,
  parseVoiceZooRecordingCatalog,
  VOICE_ZOO_RECORDING_UPDATED_EVENT,
  type VoiceZooRecordingUpdatedEventDetail,
  VOICE_ZOO_SUPPORTED_OBJECT_TYPES,
} from "@/lib/voice-zoo/recordings";
import {
  calculatePlaybackRewardCoins,
  parseVoiceZooWallet,
  type VoiceZooWallet,
  VOICE_ZOO_WALLET_STORAGE_KEY,
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
  MOVE_MAX_SPEED,
  MOVEMENT_KEYS,
  OBJECT_VISUALS,
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
  limitVectorMagnitude,
  resolveMovement,
  toUnitDirection,
} from "./empty-stage-character.utils";
import { EmptyStageCharacterStage } from "./empty-stage-character-stage";
import { EmptyStageCharacterControls } from "./empty-stage-character-controls";
import { useEmptyStageObjectLocator } from "./use-empty-stage-object-locator";
import { useEmptyStageStoredObjects } from "./use-empty-stage-stored-objects";

export { WORLD_HEIGHT, WORLD_WIDTH };

const AUTO_PLAYBACK_MIN_DELAY_MS = 2800;
const AUTO_PLAYBACK_MAX_DELAY_MS = 4800;
const AUTO_PLAYBACK_SCHEDULER_TICK_MS = 220;
const COIN_POPUP_DURATION_MS = 1200;
const WALLET_GAIN_POPUP_DURATION_MS = 1050;
const AUTO_PLAYBACK_DISTANCE_NEAR_PX = 130;
const AUTO_PLAYBACK_DISTANCE_FAR_PX = 760;
const AUTO_PLAYBACK_DISTANCE_MIN_GAIN = 0.04;

type CompatibleAudioContextWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

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

export function EmptyStageCharacter({
  children,
  darkMode = false,
  allowObjectPlacement = false,
  placementObjectType = null,
  objectStorageKey,
  initialCharacterWorldPosition,
  movementBounds = DEFAULT_WORLD_BOUNDS,
  collisionZones = [],
}: EmptyStageCharacterProps) {
  const initialCharacterOffset = useMemo(
    () => toCharacterOffset(initialCharacterWorldPosition, movementBounds),
    [initialCharacterWorldPosition, movementBounds],
  );
  const pathname = usePathname();
  const resolvedStorageKey = objectStorageKey ?? null;
  const [isWalking, setIsWalking] = useState(false);
  const [placedObjects, setPlacedObjects] = useState<PlacedStageObject[]>([]);
  const [grabbedObjectId, setGrabbedObjectId] = useState<string | null>(null);
  const [grabbedObjectType, setGrabbedObjectType] = useState<ObjectType | null>(null);
  const [pointerWorldPosition, setPointerWorldPosition] = useState<Vector2 | null>(null);
  const [isTouchPlacementArmed, setIsTouchPlacementArmed] = useState(false);
  const [isMousePlacementArmed, setIsMousePlacementArmed] = useState(false);
  const [stageViewportSize, setStageViewportSize] = useState<Vector2>({ x: 0, y: 0 });
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [coinRewardPopups, setCoinRewardPopups] = useState<CoinRewardPopup[]>([]);
  const [walletCoins, setWalletCoins] = useState(0);
  const [walletGainPopup, setWalletGainPopup] = useState<{ id: string; coins: number } | null>(
    null,
  );
  const [characterVoiceVolume, setCharacterVoiceVolume] = useState(
    DEFAULT_KAZENAGARE_AUDIO_SETTINGS.characterVoiceVolume,
  );
  const [audioOwnerId, setAudioOwnerId] = useState<string>("local_guest");
  const [recordingReloadNonce, setRecordingReloadNonce] = useState(0);
  const [recordingBlobByRecordingId, setRecordingBlobByRecordingId] = useState<
    Record<string, Blob>
  >({});
  const [latestRecordingIdByObjectType, setLatestRecordingIdByObjectType] = useState<
    Partial<Record<ObjectType, string>>
  >({});
  const stageRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const characterRef = useRef<HTMLDivElement | null>(null);
  const stickPadRef = useRef<HTMLDivElement | null>(null);
  const stickKnobRef = useRef<HTMLDivElement | null>(null);
  const walkingRef = useRef(false);
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
  const characterVoiceVolumeRef = useRef(characterVoiceVolume);
  const autoPlaybackSchedulerTimerRef = useRef<number | null>(null);
  const autoPlaybackNextAtByObjectIdRef = useRef<Record<string, number>>({});
  const autoPlaybackAudioByObjectIdRef = useRef<Record<string, HTMLAudioElement>>({});
  const autoPlaybackAudioContextRef = useRef<AudioContext | null>(null);
  const autoPlaybackSourceNodeByObjectIdRef = useRef<
    Record<string, MediaElementAudioSourceNode>
  >({});
  const autoPlaybackGainNodeByObjectIdRef = useRef<Record<string, GainNode>>({});
  const autoPlaybackAudioUrlByObjectIdRef = useRef<Record<string, string>>({});
  const autoPlaybackInFlightObjectIdsRef = useRef<Set<string>>(new Set());
  const coinRewardPopupTimerIdsRef = useRef<number[]>([]);
  const walletGainPopupTimerIdRef = useRef<number | null>(null);
  const activePlacementObjectType = grabbedObjectType ?? placementObjectType;
  const activePlacementObject = activePlacementObjectType
    ? OBJECT_VISUALS[activePlacementObjectType]
    : null;
  const canPlaceObject = allowObjectPlacement && Boolean(activePlacementObject);
  const grabbedPlacedObject = grabbedObjectId
    ? placedObjects.find((object) => object.id === grabbedObjectId) ?? null
    : null;
  const placedPlacementObject = grabbedPlacedObject;
  const hasPlacedActiveObject = Boolean(canPlaceObject && grabbedPlacedObject);
  const hasAnyPlacedObject = placedObjects.length > 0;
  const canShowObjectLocator = allowObjectPlacement && Boolean(placementObjectType);
  const selectedPlacementObject = placementObjectType
    ? [...placedObjects]
        .reverse()
        .find((object) => object.objectType === placementObjectType) ?? null
    : null;
  const hasPlacedSelectedObject = Boolean(canPlaceObject && selectedPlacementObject);

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

    if (!autoPlaybackAudioContextRef.current) {
      autoPlaybackAudioContextRef.current = new AudioContextConstructor();
    }

    return autoPlaybackAudioContextRef.current;
  }, []);

  const resumeAutoPlaybackAudioContextIfNeeded = useCallback(async () => {
    const audioContext = autoPlaybackAudioContextRef.current;

    if (!audioContext || audioContext.state !== "suspended") {
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
  }, []);

  const resetCharacterAnimationState = useCallback(() => {
    walkingRef.current = false;
    setIsWalking(false);
  }, []);

  const resetToStart = useCallback(() => {
    activeKeysRef.current.clear();
    clearJoystickInput();
    velocityRef.current = { x: 0, y: 0 };
    desiredOffsetRef.current = { x: initialCharacterOffset.x, y: initialCharacterOffset.y };
    cameraOffsetRef.current = { x: initialCharacterOffset.x, y: initialCharacterOffset.y };
    previousTimestampRef.current = 0;
    resetCharacterAnimationState();
    applyWorldTransform();
    applyCharacterTransform();
  }, [
    applyCharacterTransform,
    applyWorldTransform,
    clearJoystickInput,
    initialCharacterOffset.x,
    initialCharacterOffset.y,
    resetCharacterAnimationState,
  ]);

  const clearPlacementState = useCallback(() => {
    setIsMousePlacementArmed(false);
    setIsTouchPlacementArmed(false);
    setPointerWorldPosition(null);
    setGrabbedObjectId(null);
    setGrabbedObjectType(null);
  }, []);

  const clearAutoPlaybackScheduler = useCallback(() => {
    if (autoPlaybackSchedulerTimerRef.current !== null) {
      window.clearInterval(autoPlaybackSchedulerTimerRef.current);
      autoPlaybackSchedulerTimerRef.current = null;
    }
  }, []);

  const revokeAutoPlaybackAudioUrl = useCallback((objectId: string) => {
    const currentAudioUrl = autoPlaybackAudioUrlByObjectIdRef.current[objectId];

    if (!currentAudioUrl) {
      return;
    }

    URL.revokeObjectURL(currentAudioUrl);
    delete autoPlaybackAudioUrlByObjectIdRef.current[objectId];
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
    },
    [revokeAutoPlaybackAudioUrl],
  );

  const stopAutoPlayback = useCallback(() => {
    clearAutoPlaybackScheduler();

    const objectIds = new Set<string>([
      ...Object.keys(autoPlaybackNextAtByObjectIdRef.current),
      ...Object.keys(autoPlaybackAudioByObjectIdRef.current),
      ...Object.keys(autoPlaybackAudioUrlByObjectIdRef.current),
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

  const addCoinRewardPopup = useCallback((placedObject: PlacedStageObject, coins: number) => {
    const objectLabel = OBJECT_VISUALS[placedObject.objectType].label;
    const popupId = `${placedObject.id}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    setCoinRewardPopups((current) => [
      ...current,
      {
        id: popupId,
        objectId: placedObject.id,
        objectLabel,
        x: placedObject.x,
        y: placedObject.y - 56,
        coins,
      },
    ]);

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

  const awardPlaybackReward = useCallback(
    (placedObject: PlacedStageObject) => {
      const rewardCoins = calculatePlaybackRewardCoins(
        getVoiceZooObjectPrice(placedObject.objectType),
      );

      try {
        const currentWallet = parseVoiceZooWallet(
          window.localStorage.getItem(VOICE_ZOO_WALLET_STORAGE_KEY),
        );
        const nextWallet = {
          ...currentWallet,
          coins: currentWallet.coins + rewardCoins,
        };

        window.localStorage.setItem(
          VOICE_ZOO_WALLET_STORAGE_KEY,
          JSON.stringify(nextWallet),
        );
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
    },
    [addCoinRewardPopup],
  );

  const playAutoPlaybackForObject = useCallback(
    (objectId: string) => {
      const selectedObject =
        placedObjectsRef.current.find((placedObject) => placedObject.id === objectId) ?? null;

      if (!selectedObject) {
        stopAutoPlaybackObject(objectId);
        return;
      }

      const recordingBlob = resolveRecordingBlobForObject(selectedObject);

      if (!recordingBlob) {
        autoPlaybackNextAtByObjectIdRef.current[objectId] = Date.now() + getRandomPlaybackDelayMs();
        return;
      }

      let objectAudio = autoPlaybackAudioByObjectIdRef.current[objectId];

      if (!objectAudio) {
        objectAudio = new Audio();
        objectAudio.preload = "auto";
        autoPlaybackAudioByObjectIdRef.current[objectId] = objectAudio;
      }

      autoPlaybackInFlightObjectIdsRef.current.add(objectId);

      objectAudio.pause();
      objectAudio.currentTime = 0;
      objectAudio.onended = null;
      objectAudio.onerror = null;
      objectAudio.onplay = null;

      revokeAutoPlaybackAudioUrl(objectId);
      const nextAudioUrl = URL.createObjectURL(recordingBlob);
      autoPlaybackAudioUrlByObjectIdRef.current[objectId] = nextAudioUrl;
      objectAudio.src = nextAudioUrl;
      objectAudio.currentTime = 0;
      const nextVolume = getAutoPlaybackVolumeForObject(selectedObject);
      setAutoPlaybackVolume(objectId, objectAudio, nextVolume);
      applyVoiceZooPlaybackEffect(objectAudio, selectedObject.objectType);

      let hasFinalizedPlayback = false;
      let hasRewardedPlayback = false;

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
        autoPlaybackInFlightObjectIdsRef.current.delete(objectId);
        revokeAutoPlaybackAudioUrl(objectId);

        if (placedObjectsRef.current.some((placedObject) => placedObject.id === objectId)) {
          autoPlaybackNextAtByObjectIdRef.current[objectId] = Date.now() + getRandomPlaybackDelayMs();
          return;
        }

        stopAutoPlaybackObject(objectId);
      };

      objectAudio.onended = () => {
        finalizePlayback();
      };

      objectAudio.onerror = () => {
        finalizePlayback();
      };

      objectAudio.onplay = () => {
        rewardPlayback();
      };

      void resumeAutoPlaybackAudioContextIfNeeded()
        .then(() => objectAudio.play())
        .then(() => {
          rewardPlayback();
        })
        .catch(() => {
          finalizePlayback();
        });
    },
    [
      awardPlaybackReward,
      getAutoPlaybackVolumeForObject,
      resolveRecordingBlobForObject,
      revokeAutoPlaybackAudioUrl,
      resumeAutoPlaybackAudioContextIfNeeded,
      setAutoPlaybackVolume,
      stopAutoPlaybackObject,
    ],
  );

  const {
    isObjectLocatorVisible,
    objectLocatorIndicator,
    showPlacedObjectLocator,
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

  const placeObjectAtWorldPosition = useCallback(
    (
      targetPosition: Vector2 | null,
      targetObjectType: ObjectType | null,
      targetObjectId: string | null = null,
    ) => {
      if (!allowObjectPlacement || !targetPosition || !targetObjectType) {
        return false;
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

      return true;
    },
    [allowObjectPlacement],
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
      if (!allowObjectPlacement) {
        return;
      }

      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      const targetPosition = getWorldPositionFromClient(event.clientX, event.clientY);
      if (!targetPosition) {
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

          const didPlace = placeObjectAtWorldPosition(
            targetPosition,
            activePlacementObjectType,
            grabbedObjectId,
          );
          if (didPlace) {
            setIsTouchPlacementArmed(false);
            setPointerWorldPosition(null);
            setGrabbedObjectId(null);
            setGrabbedObjectType(null);
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

        const didPlace = placeObjectAtWorldPosition(
          targetPosition,
          activePlacementObjectType,
          grabbedObjectId,
        );
        if (didPlace) {
          setIsMousePlacementArmed(false);
          setPointerWorldPosition(null);
          setGrabbedObjectId(null);
          setGrabbedObjectType(null);
        }

        return;
      }

      if (hasPlacedSelectedObject) {
        setPointerWorldPosition(null);
        return;
      }

      if (!isCoarsePointer && event.pointerType === "mouse") {
        placeObjectAtWorldPosition(targetPosition, activePlacementObjectType);
        setPointerWorldPosition(null);
        return;
      }

      if (!isTouchPlacementArmed) {
        setIsTouchPlacementArmed(true);
        setPointerWorldPosition(targetPosition);
        return;
      }

      const didPlace = placeObjectAtWorldPosition(
        targetPosition,
        activePlacementObjectType,
      );
      if (didPlace) {
        setIsTouchPlacementArmed(false);
        setPointerWorldPosition(null);
        setGrabbedObjectId(null);
        setGrabbedObjectType(null);
      }
    },
    [
      activePlacementObjectType,
      allowObjectPlacement,
      canPlaceObject,
      findPlacedObjectAtPosition,
      getWorldPositionFromClient,
      grabbedObjectId,
      hasPlacedActiveObject,
      hasPlacedSelectedObject,
      isCoarsePointer,
      isMousePlacementArmed,
      isNearSelectedObject,
      isTouchPlacementArmed,
      placeObjectAtWorldPosition,
    ],
  );

  useEffect(() => {
    characterVoiceVolumeRef.current = characterVoiceVolume;
    updateActiveAutoPlaybackVolumes();
  }, [characterVoiceVolume, updateActiveAutoPlaybackVolumes]);

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
      const wallet = parseVoiceZooWallet(
        window.localStorage.getItem(VOICE_ZOO_WALLET_STORAGE_KEY),
      );
      setWalletCoins(wallet.coins);
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
    };
  }, []);

  useEffect(() => {
    const handleWalletStorageUpdate = (event: StorageEvent) => {
      if (event.key !== VOICE_ZOO_WALLET_STORAGE_KEY) {
        return;
      }

      const wallet = parseVoiceZooWallet(event.newValue);
      setWalletCoins(wallet.coins);
    };

    const handleLocalWalletUpdate: EventListener = (event) => {
      const customEvent = event as CustomEvent<VoiceZooWallet>;

      if (customEvent.detail) {
        setWalletCoins(customEvent.detail.coins);
        return;
      }

      const wallet = parseVoiceZooWallet(
        window.localStorage.getItem(VOICE_ZOO_WALLET_STORAGE_KEY),
      );
      setWalletCoins(wallet.coins);
    };

    window.addEventListener("storage", handleWalletStorageUpdate);
    window.addEventListener(VOICE_ZOO_WALLET_UPDATED_EVENT, handleLocalWalletUpdate);

    return () => {
      window.removeEventListener("storage", handleWalletStorageUpdate);
      window.removeEventListener(VOICE_ZOO_WALLET_UPDATED_EVENT, handleLocalWalletUpdate);
    };
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setAudioOwnerId(session?.user?.id || "local_guest");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAudioOwnerId(session?.user?.id || "local_guest");
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleRecordingUpdate: EventListener = (event) => {
      const customEvent = event as CustomEvent<VoiceZooRecordingUpdatedEventDetail>;
      const ownerId = customEvent.detail?.ownerId;

      if (ownerId && ownerId !== audioOwnerId) {
        return;
      }

      setRecordingReloadNonce((current) => current + 1);
    };

    window.addEventListener(VOICE_ZOO_RECORDING_UPDATED_EVENT, handleRecordingUpdate);

    return () => {
      window.removeEventListener(VOICE_ZOO_RECORDING_UPDATED_EVENT, handleRecordingUpdate);
    };
  }, [audioOwnerId]);

  useEffect(() => {
    let cancelled = false;

    const loadRecordingCatalogAndBlobs = async () => {
      const catalogStorageKey = getVoiceZooRecordingCatalogStorageKey(audioOwnerId);
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
          getVoiceZooLegacyRecordingStorageKey(audioOwnerId, objectType),
        );

        if (!(legacyBlob instanceof Blob)) {
          continue;
        }

        const migratedRecordingId = createVoiceZooRecordingId(objectType);
        await set(
          getVoiceZooRecordingBlobStorageKey(audioOwnerId, migratedRecordingId),
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
            getVoiceZooRecordingBlobStorageKey(audioOwnerId, recordingMeta.id),
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
  }, [audioOwnerId, recordingReloadNonce]);

  useEffect(() => {
    if (!pathname.startsWith("/garden")) {
      stopAutoPlayback();
    }
  }, [pathname, stopAutoPlayback]);

  useEffect(() => {
    const handlePageHide = () => {
      stopAutoPlayback();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAutoPlayback();
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
  }, [stopAutoPlayback]);

  useEffect(() => {
    if (!allowObjectPlacement) {
      stopAutoPlayback();
      return;
    }

    const syncObjectSchedules = () => {
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
    };

    const runSchedulerTick = () => {
      syncObjectSchedules();

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
    };

    runSchedulerTick();
    clearAutoPlaybackScheduler();
    autoPlaybackSchedulerTimerRef.current = window.setInterval(
      runSchedulerTick,
      AUTO_PLAYBACK_SCHEDULER_TICK_MS,
    );

    return () => {
      stopAutoPlayback();
    };
  }, [
    allowObjectPlacement,
    clearAutoPlaybackScheduler,
    playAutoPlaybackForObject,
    stopAutoPlaybackObject,
    stopAutoPlayback,
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

      coinRewardPopupTimerIdsRef.current = [];
    };
  }, []);

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
          collisionZones,
          CHARACTER_HITBOX_RADIUS,
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

  const resetButtonClass = `pointer-events-auto rounded-md border px-3 py-2 text-xs font-semibold transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98] ${
    darkMode
      ? "border-wa-white/40 bg-wa-white/10 text-wa-white hover:bg-wa-white/20"
      : "border-wa-black/20 bg-wa-white/90 text-wa-black hover:bg-wa-red/10"
  }`;

  const helperTextClass = `text-[10px] ${darkMode ? "text-wa-white/80" : "text-wa-black/70"}`;

  const resetPanelClass = `pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+8.75rem)] left-3 right-3 z-30 grid gap-2 rounded-xl border p-2 backdrop-blur-sm sm:bottom-5 sm:left-5 sm:right-auto sm:max-w-[24rem] ${
    darkMode
      ? "border-wa-white/30 bg-wa-black/40"
      : "border-wa-black/20 bg-wa-white/70"
  }`;

  const placementDividerClass = darkMode ? "border-wa-white/20" : "border-wa-black/15";
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
  const selectedObjectLabel = activePlacementObject?.label ?? "オブジェクト";
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
  const previewChipY = previewIconY + 18;
  const previewChipTextY = previewIconY + 28;
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

  const interactionGuideText = canPlaceObject
    ? hasPlacedActiveObject
      ? isCoarsePointer
        ? isTouchPlacementArmed
          ? `${selectedObjectLabel}を置く場所をタップで離します。`
          : `${selectedObjectLabel}をタップで浮かせます。`
        : isMousePlacementArmed
          ? `${selectedObjectLabel}を置く場所をクリックで離します。`
          : `${selectedObjectLabel}をクリックで浮かせます。`
      : hasPlacedSelectedObject
        ? `${selectedObjectLabel}をタップしてつかむと移動できます。`
      : isCoarsePointer
        ? isTouchPlacementArmed
          ? `${selectedObjectLabel}を置く場所をタップで配置`
          : `${selectedObjectLabel}をタップで浮かせます。`
        : `${selectedObjectLabel}を置く場所をクリックで配置`
    : hasAnyPlacedObject
      ? "図鑑を選ばなくても、置いてあるオブジェクトをタップでつかんで移動できます。"
      : "図鑑でオブジェクトを選ぶと、この庭で配置できます。";

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
        stageRef={stageRef}
        worldRef={worldRef}
        characterRef={characterRef}
        stageCursorClass={stageCursorClass}
        onStagePointerMove={handleStagePointerMove}
        onStagePointerDown={handleStagePointerDown}
        onStagePointerLeave={handleStagePointerLeave}
        placedObjects={placedObjects}
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
        canPlaceObject={canPlaceObject}
        canShowObjectLocator={canShowObjectLocator}
        hasPlacedActiveObject={Boolean(canPlaceObject && (grabbedPlacedObject ?? selectedPlacementObject))}
        walletCoins={walletCoins}
        walletGainPopup={walletGainPopup}
        isTouchPlacementArmed={isTouchPlacementArmed}
        isMousePlacementArmed={isMousePlacementArmed}
        resetPanelClass={resetPanelClass}
        resetButtonClass={resetButtonClass}
        helperTextClass={helperTextClass}
        placementDividerClass={placementDividerClass}
        interactionGuideText={interactionGuideText}
        onResetToStart={resetToStart}
        onShowPlacedObjectLocator={showPlacedObjectLocator}
        onReleaseGrab={clearPlacementState}
        mobileStickPanelClass={mobileStickPanelClass}
        darkMode={darkMode}
        stickPadRef={stickPadRef}
        stickKnobRef={stickKnobRef}
        onStickPointerDown={handleStickPointerDown}
        onStickPointerMove={handleStickPointerMove}
        onStickPointerEnd={handleStickPointerEnd}
      />
    </>
  );
}
