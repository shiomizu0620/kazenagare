"use client";

import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

type EmptyStageCharacterProps = {
  children?: ReactNode;
  darkMode?: boolean;
};

type Vector2 = {
  x: number;
  y: number;
};

export const WORLD_WIDTH = 3840;
export const WORLD_HEIGHT = 2160;
const MOVE_MAX_SPEED = 400;
const ACCEL_RESPONSE = 22;
const BRAKE_RESPONSE = 14;
const JOYSTICK_DEAD_ZONE = 0.12;
const STICK_KNOB_SIZE = 36;
const MAX_DELTA_SECONDS = 0.1;
const WALK_ANIMATION_SPEED_THRESHOLD = 10;
const MOVEMENT_KEYS = [
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toUnitDirection(vector: Vector2, deadZone = 0): Vector2 {
  const magnitude = Math.hypot(vector.x, vector.y);

  if (magnitude <= deadZone) {
    return { x: 0, y: 0 };
  }

  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
  };
}

function limitVectorMagnitude(vector: Vector2, maxMagnitude: number): Vector2 {
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

function getInputAxis(keys: Set<string>) {
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

export function EmptyStageCharacter({ children, darkMode = false }: EmptyStageCharacterProps) {
  const [isWalking, setIsWalking] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const stickPadRef = useRef<HTMLDivElement | null>(null);
  const stickKnobRef = useRef<HTMLDivElement | null>(null);
  const walkingRef = useRef(false);
  const stickPointerIdRef = useRef<number | null>(null);
  const stageSizeRef = useRef<Vector2>({ x: 0, y: 0 });
  const cameraOffsetRef = useRef<Vector2>({ x: 0, y: 0 });
  const velocityRef = useRef<Vector2>({ x: 0, y: 0 });
  const previousTimestampRef = useRef(0);
  const animationFrameRef = useRef(0);
  const activeKeysRef = useRef<Set<string>>(new Set());
  const joystickVectorRef = useRef<Vector2>({ x: 0, y: 0 });

  const applyWorldTransform = useCallback(() => {
    if (!worldRef.current) {
      return;
    }

    const worldLeft = stageSizeRef.current.x * 0.5 - WORLD_WIDTH * 0.5;
    const worldTop = stageSizeRef.current.y * 0.5 - WORLD_HEIGHT * 0.5;

    worldRef.current.style.transform = `translate3d(${worldLeft - cameraOffsetRef.current.x}px, ${worldTop - cameraOffsetRef.current.y}px, 0)`;
  }, []);

  const clampCameraBounds = useCallback((nextOffset: Vector2) => {
    const maxX = Math.max(0, WORLD_WIDTH * 0.5 - stageSizeRef.current.x * 0.5);
    const maxY = Math.max(0, WORLD_HEIGHT * 0.5 - stageSizeRef.current.y * 0.5);

    return {
      x: clamp(nextOffset.x, -maxX, maxX),
      y: clamp(nextOffset.y, -maxY, maxY),
    };
  }, []);

  const initializeStage = useCallback(() => {
    if (!stageRef.current) {
      return;
    }

    const rect = stageRef.current.getBoundingClientRect();
    stageSizeRef.current = {
      x: rect.width,
      y: rect.height,
    };

    cameraOffsetRef.current = clampCameraBounds(cameraOffsetRef.current);
    applyWorldTransform();
  }, [applyWorldTransform, clampCameraBounds]);

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
    if (isWalking) {
      setIsWalking(false);
    }
  }, [isWalking]);

  const resetToStart = useCallback(() => {
    activeKeysRef.current.clear();
    clearJoystickInput();
    velocityRef.current = { x: 0, y: 0 };
    cameraOffsetRef.current = { x: 0, y: 0 };
    previousTimestampRef.current = 0;
    resetCharacterAnimationState();
    applyWorldTransform();
  }, [applyWorldTransform, clearJoystickInput, resetCharacterAnimationState]);

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
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp, { passive: false });
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [clearJoystickInput, resetCharacterAnimationState]);

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
        cameraOffsetRef.current = clampCameraBounds({
          x: cameraOffsetRef.current.x + velocityRef.current.x * deltaSeconds,
          y: cameraOffsetRef.current.y + velocityRef.current.y * deltaSeconds,
        });
        applyWorldTransform();
      }

      animationFrameRef.current = window.requestAnimationFrame(animate);
    };

    animationFrameRef.current = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrameRef.current);
    };
  }, [applyWorldTransform, clampCameraBounds, syncCharacterAnimationState]);

  const resetButtonClass = `rounded-md border px-3 py-2 text-xs font-semibold transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98] ${
    darkMode
      ? "border-wa-white/40 bg-wa-white/10 text-wa-white hover:bg-wa-white/20"
      : "border-wa-black/20 bg-wa-white/90 text-wa-black hover:bg-wa-red/10"
  }`;

  const helperTextClass = `text-[10px] ${darkMode ? "text-wa-white/80" : "text-wa-black/70"}`;

  const resetPanelClass = `absolute bottom-5 left-5 z-30 grid gap-2 rounded-xl border p-2 backdrop-blur-sm ${
    darkMode
      ? "border-wa-white/30 bg-wa-black/40"
      : "border-wa-black/20 bg-wa-white/70"
  }`;

  const mobileStickPanelClass = `absolute bottom-5 right-5 z-40 rounded-2xl border p-2 backdrop-blur-sm sm:hidden ${
    darkMode
      ? "border-wa-white/30 bg-wa-black/40"
      : "border-wa-black/20 bg-wa-white/70"
  }`;

  return (
    <>
      <div ref={stageRef} className="absolute inset-0 z-20 overflow-hidden">
        <div
          ref={worldRef}
          className="pointer-events-none absolute left-0 top-0 h-[2160px] w-[3840px] will-change-transform"
        >
          {children}
        </div>

        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div
            className={`grid justify-items-center gap-1 ${
              isWalking
                ? "animate-[kazenagare-walk-bob_0.36s_ease-in-out_infinite]"//ここで上下の揺れる速度
                : ""
            }`}
          >
            <div
              className={`h-7 w-7 rounded-full border-2 ${
                darkMode
                  ? "border-wa-white/70 bg-wa-white/20"
                  : "border-wa-black/50 bg-wa-white"
              }`}
            />
            <div className="h-9 w-8 rounded-t-2xl border-2 border-wa-red/70 bg-wa-red/70" />
          </div>
        </div>
      </div>

      <div className={resetPanelClass}>
        <button
          type="button"
          onClick={resetToStart}
          className={resetButtonClass}
        >
          開始地点に戻る
        </button>
        <p className={helperTextClass}>
          PC: WASD / 矢印キー ・ スマホ: スティック
        </p>
      </div>

      <div className={mobileStickPanelClass}>
        <div
          ref={stickPadRef}
          className={`relative grid h-[108px] w-[108px] place-items-center rounded-full border touch-none select-none ${
            darkMode
              ? "border-wa-white/40 bg-wa-white/10"
              : "border-wa-black/20 bg-wa-white/80"
          }`}
          onPointerDown={handleStickPointerDown}
          onPointerMove={handleStickPointerMove}
          onPointerUp={handleStickPointerEnd}
          onPointerCancel={handleStickPointerEnd}
        >
          <div
            className={`pointer-events-none absolute inset-2 rounded-full border ${
              darkMode ? "border-wa-white/25" : "border-wa-black/10"
            }`}
          />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div
              ref={stickKnobRef}
              className={`h-9 w-9 rounded-full border will-change-transform ${
                darkMode
                  ? "border-wa-white/70 bg-wa-white/70"
                  : "border-wa-black/25 bg-wa-black/30"
              }`}
            />
          </div>
        </div>
      </div>
    </>
  );
}
