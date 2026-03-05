"use client";

import { useCallback, useEffect, useRef } from "react";

type EmptyStageCharacterProps = {
  darkMode?: boolean;
};

type Direction = "up" | "down" | "left" | "right";

type Vector2 = {
  x: number;
  y: number;
};

const CHARACTER_WIDTH = 32;
const CHARACTER_HEIGHT = 64;
const NUDGE_STEP = 28;
const MAX_SPEED = 320;
const ACCEL_RESPONSE = 14;
const BRAKE_RESPONSE = 10;
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

function getInputAxis(activeDirections: Set<Direction>, keys: Set<string>) {
  let horizontal = 0;
  let vertical = 0;

  if (
    activeDirections.has("left") ||
    keys.has("a") ||
    keys.has("arrowleft")
  ) {
    horizontal -= 1;
  }

  if (
    activeDirections.has("right") ||
    keys.has("d") ||
    keys.has("arrowright")
  ) {
    horizontal += 1;
  }

  if (
    activeDirections.has("up") ||
    keys.has("w") ||
    keys.has("arrowup")
  ) {
    vertical -= 1;
  }

  if (
    activeDirections.has("down") ||
    keys.has("s") ||
    keys.has("arrowdown")
  ) {
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

export function EmptyStageCharacter({ darkMode = false }: EmptyStageCharacterProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const characterRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);
  const stageSizeRef = useRef<Vector2>({ x: 0, y: 0 });
  const positionRef = useRef<Vector2>({ x: 0, y: 0 });
  const velocityRef = useRef<Vector2>({ x: 0, y: 0 });
  const previousTimestampRef = useRef(0);
  const animationFrameRef = useRef(0);
  const activeKeysRef = useRef<Set<string>>(new Set());
  const activeDirectionsRef = useRef<Set<Direction>>(new Set());

  const applyCharacterTransform = useCallback(() => {
    if (!characterRef.current) {
      return;
    }

    characterRef.current.style.transform = `translate3d(${positionRef.current.x}px, ${positionRef.current.y}px, 0)`;
  }, []);

  const clampToStageBounds = useCallback((nextPosition: Vector2) => {
    const maxX = Math.max(0, stageSizeRef.current.x - CHARACTER_WIDTH);
    const maxY = Math.max(0, stageSizeRef.current.y - CHARACTER_HEIGHT);

    return {
      x: clamp(nextPosition.x, 0, maxX),
      y: clamp(nextPosition.y, 0, maxY),
    };
  }, []);

  const initializeCharacter = useCallback(() => {
    if (!stageRef.current) {
      return;
    }

    const rect = stageRef.current.getBoundingClientRect();
    stageSizeRef.current = {
      x: rect.width,
      y: rect.height,
    };

    if (!initializedRef.current) {
      positionRef.current = {
        x: rect.width * 0.5 - CHARACTER_WIDTH * 0.5,
        y: rect.height * 0.62 - CHARACTER_HEIGHT * 0.5,
      };
      positionRef.current = clampToStageBounds(positionRef.current);
      initializedRef.current = true;
      applyCharacterTransform();
      return;
    }

    positionRef.current = clampToStageBounds(positionRef.current);
    applyCharacterTransform();
  }, [applyCharacterTransform, clampToStageBounds]);

  const nudgeCharacter = useCallback(
    (nextDirection: Direction) => {
      if (nextDirection === "up") {
        positionRef.current.y -= NUDGE_STEP;
      } else if (nextDirection === "down") {
        positionRef.current.y += NUDGE_STEP;
      } else if (nextDirection === "left") {
        positionRef.current.x -= NUDGE_STEP;
      } else {
        positionRef.current.x += NUDGE_STEP;
      }

      positionRef.current = clampToStageBounds(positionRef.current);
      applyCharacterTransform();
    },
    [applyCharacterTransform, clampToStageBounds],
  );

  const setDirectionPressed = useCallback(
    (direction: Direction, pressed: boolean) => {
      if (pressed) {
        activeDirectionsRef.current.add(direction);
        return;
      }

      activeDirectionsRef.current.delete(direction);
    },
    [],
  );

  useEffect(() => {
    initializeCharacter();

    const observer = new ResizeObserver(() => {
      initializeCharacter();
    });

    if (stageRef.current) {
      observer.observe(stageRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [initializeCharacter]);

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
      activeDirectionsRef.current.clear();
      velocityRef.current = { x: 0, y: 0 };
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp, { passive: false });
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  useEffect(() => {
    const animate = (timestamp: number) => {
      const deltaSeconds =
        previousTimestampRef.current === 0
          ? 0
          : Math.min(0.05, (timestamp - previousTimestampRef.current) / 1000);
      previousTimestampRef.current = timestamp;

      const inputAxis = getInputAxis(activeDirectionsRef.current, activeKeysRef.current);
      const hasInput = inputAxis.x !== 0 || inputAxis.y !== 0;
      const response = hasInput ? ACCEL_RESPONSE : BRAKE_RESPONSE;

      const targetVelocityX = inputAxis.x * MAX_SPEED;
      const targetVelocityY = inputAxis.y * MAX_SPEED;

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

      if (velocityRef.current.x !== 0 || velocityRef.current.y !== 0) {
        positionRef.current = clampToStageBounds({
          x: positionRef.current.x + velocityRef.current.x * deltaSeconds,
          y: positionRef.current.y + velocityRef.current.y * deltaSeconds,
        });
        applyCharacterTransform();
      }

      animationFrameRef.current = window.requestAnimationFrame(animate);
    };

    animationFrameRef.current = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrameRef.current);
    };
  }, [applyCharacterTransform, clampToStageBounds]);

  const controlButtonClass = `grid h-8 w-8 place-items-center rounded-md border text-sm font-semibold transition-all active:scale-95 ${
    darkMode
      ? "border-wa-white/40 bg-wa-white/10 text-wa-white hover:bg-wa-white/20"
      : "border-wa-black/20 bg-wa-white/90 text-wa-black hover:bg-wa-red/10"
  }`;

  return (
    <>
      <div ref={stageRef} className="pointer-events-none absolute inset-0 z-20">
        <div ref={characterRef} className="absolute left-0 top-0 will-change-transform">
          <div className="grid justify-items-center gap-1">
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

      <div className="absolute bottom-5 left-5 z-30 grid gap-1 rounded-xl border border-wa-black/20 bg-wa-white/70 p-2 backdrop-blur-sm">
        <div className="grid grid-cols-3 gap-1">
          <div />
          <button
            type="button"
            aria-label="上へ移動"
            onClick={() => nudgeCharacter("up")}
            onPointerDown={() => setDirectionPressed("up", true)}
            onPointerUp={() => setDirectionPressed("up", false)}
            onPointerLeave={() => setDirectionPressed("up", false)}
            onPointerCancel={() => setDirectionPressed("up", false)}
            className={controlButtonClass}
          >
            ▲
          </button>
          <div />
          <button
            type="button"
            aria-label="左へ移動"
            onClick={() => nudgeCharacter("left")}
            onPointerDown={() => setDirectionPressed("left", true)}
            onPointerUp={() => setDirectionPressed("left", false)}
            onPointerLeave={() => setDirectionPressed("left", false)}
            onPointerCancel={() => setDirectionPressed("left", false)}
            className={controlButtonClass}
          >
            ◀
          </button>
          <button
            type="button"
            aria-label="下へ移動"
            onClick={() => nudgeCharacter("down")}
            onPointerDown={() => setDirectionPressed("down", true)}
            onPointerUp={() => setDirectionPressed("down", false)}
            onPointerLeave={() => setDirectionPressed("down", false)}
            onPointerCancel={() => setDirectionPressed("down", false)}
            className={controlButtonClass}
          >
            ▼
          </button>
          <button
            type="button"
            aria-label="右へ移動"
            onClick={() => nudgeCharacter("right")}
            onPointerDown={() => setDirectionPressed("right", true)}
            onPointerUp={() => setDirectionPressed("right", false)}
            onPointerLeave={() => setDirectionPressed("right", false)}
            onPointerCancel={() => setDirectionPressed("right", false)}
            className={controlButtonClass}
          >
            ▶
          </button>
        </div>
        <p className={`px-1 text-[10px] ${darkMode ? "text-wa-white/80" : "text-wa-black/70"}`}>
          WASD / 矢印キーでも移動
        </p>
      </div>
    </>
  );
}
