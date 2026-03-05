"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GardenSummary } from "@/components/garden/garden-summary";
import { GardenField } from "@/components/garden/GardenField";
import {
  GARDEN_BACKGROUNDS,
  GARDEN_SEASONS,
  GARDEN_TIME_SLOTS,
} from "@/lib/garden/options";
import {
  clampVirtualPosition,
  type VirtualPosition,
} from "@/components/visual/garden-p5-stage";
import { FurinCanvas } from "@/components/visual/furin-canvas";
import { useAudio } from "@/hooks/useAudio";
import { useGarden } from "@/hooks/useGarden";

const GardenP5Stage = dynamic(
  () =>
    import("@/components/visual/garden-p5-stage").then(
      (module) => module.GardenP5Stage,
    ),
  {
    ssr: false,
  },
);

const Joystick = dynamic(
  () =>
    import("react-joystick-component").then((module) => module.Joystick),
  {
    ssr: false,
  },
);

const MOVE_STEP = 0.16;

type InputVector = {
  x: number;
  y: number;
};

type JoystickEventLike = {
  x?: number | null;
  y?: number | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeVector(vector: InputVector): InputVector {
  const magnitude = Math.hypot(vector.x, vector.y);

  if (magnitude === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
  };
}

function getKeyboardVector(pressedKeys: Set<string>): InputVector {
  let horizontal = 0;
  let vertical = 0;

  if (pressedKeys.has("a") || pressedKeys.has("arrowleft")) {
    horizontal -= 1;
  }

  if (pressedKeys.has("d") || pressedKeys.has("arrowright")) {
    horizontal += 1;
  }

  if (pressedKeys.has("w") || pressedKeys.has("arrowup")) {
    vertical += 1;
  }

  if (pressedKeys.has("s") || pressedKeys.has("arrowdown")) {
    vertical -= 1;
  }

  return normalizeVector({ x: horizontal, y: vertical });
}

export function GardenFieldPlayground() {
  const searchParams = useSearchParams();
  const { isListening, volume, toggleListening } = useAudio();
  const [virtualPosition, setVirtualPosition] = useState<VirtualPosition>({
    x: 0,
    y: 0,
  });
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const joystickVectorRef = useRef<InputVector>({ x: 0, y: 0 });

  const {
    profile,
    selectedBackground,
    randomGardenPath,
    selectNextBackground,
    visitAnotherGarden,
  } = useGarden();

  const selectedBackgroundFromSetup =
    searchParams.get("background") ?? selectedBackground.id;
  const selectedSeasonFromSetup = searchParams.get("season") ?? "spring";
  const selectedTimeFromSetup = searchParams.get("time") ?? "morning";

  const selectedBackgroundLabel =
    GARDEN_BACKGROUNDS.find((option) => option.id === selectedBackgroundFromSetup)
      ?.name ?? selectedBackground.name;
  const selectedSeasonLabel =
    GARDEN_SEASONS.find((option) => option.id === selectedSeasonFromSetup)?.name ?? "春";
  const selectedTimeLabel =
    GARDEN_TIME_SLOTS.find((option) => option.id === selectedTimeFromSetup)?.name ?? "朝";

  useEffect(() => {
    const relevantKeys = new Set([
      "w",
      "a",
      "s",
      "d",
      "arrowup",
      "arrowleft",
      "arrowdown",
      "arrowright",
    ]);

    const handleKeyDown = (event: KeyboardEvent) => {
      const normalizedKey = event.key.toLowerCase();

      if (!relevantKeys.has(normalizedKey)) {
        return;
      }

      event.preventDefault();
      pressedKeysRef.current.add(normalizedKey);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const normalizedKey = event.key.toLowerCase();

      if (!relevantKeys.has(normalizedKey)) {
        return;
      }

      event.preventDefault();
      pressedKeysRef.current.delete(normalizedKey);
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp, { passive: false });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    let frameId = 0;

    const tick = () => {
      const keyboardVector = getKeyboardVector(pressedKeysRef.current);
      const joystickVector = joystickVectorRef.current;

      const combinedX = clamp(keyboardVector.x + joystickVector.x, -1, 1);
      const combinedY = clamp(keyboardVector.y + joystickVector.y, -1, 1);

      if (combinedX !== 0 || combinedY !== 0) {
        setVirtualPosition((current) =>
          clampVirtualPosition({
            x: current.x + combinedX * MOVE_STEP,
            y: current.y + combinedY * MOVE_STEP,
          }),
        );
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  const handleJoystickMove = useCallback((event: JoystickEventLike) => {
    const rawX = (event.x ?? 0) / 100;
    const rawY = -((event.y ?? 0) / 100);

    joystickVectorRef.current = normalizeVector({
      x: clamp(rawX, -1, 1),
      y: clamp(rawY, -1, 1),
    });
  }, []);

  const handleJoystickStop = useCallback(() => {
    joystickVectorRef.current = { x: 0, y: 0 };
  }, []);

  return (
    <GardenField>
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-8 px-6 py-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">GardenField UI Playground</h1>
          <p className="text-sm">開発用ルート: /test-ui（WASD + ジョイスティック対応）</p>
          <p className="text-sm">
            適用設定: {selectedBackgroundLabel} / {selectedSeasonLabel} / {selectedTimeLabel}
          </p>
        </header>

        <div className="h-[40dvh] min-h-[320px]">
          <GardenP5Stage
            virtualPosition={virtualPosition}
            onVirtualPositionChange={setVirtualPosition}
          />
        </div>

        <div className="grid gap-3 rounded-lg border border-wa-black/20 bg-white/70 p-4 md:grid-cols-[1fr_auto] md:items-center">
          <p className="text-sm">PC: WASD / 矢印キー ・ スマホ: ジョイスティック入力</p>
          <div className="justify-self-start md:justify-self-end">
            <Joystick size={96} move={handleJoystickMove} stop={handleJoystickStop} />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <GardenSummary
            profile={profile}
            backgroundName={selectedBackground.name}
          />
          <FurinCanvas isListening={isListening} volume={volume} />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={toggleListening}
            className="rounded-md border border-wa-black px-4 py-2 text-sm"
          >
            {isListening ? "収音を止める" : "収音を始める"}
          </button>

          <button
            type="button"
            onClick={selectNextBackground}
            className="rounded-md border border-wa-black px-4 py-2 text-sm"
          >
            背景を切り替える
          </button>

          <Link
            href={`/garden/${profile.userId}`}
            className="rounded-md border border-wa-black px-4 py-2 text-sm"
          >
            自分の庭に入る
          </Link>

          <Link
            href={randomGardenPath}
            onClick={visitAnotherGarden}
            className="rounded-md border border-wa-black px-4 py-2 text-sm"
          >
            ランダムな庭へ
          </Link>
        </div>
      </div>
    </GardenField>
  );
}
