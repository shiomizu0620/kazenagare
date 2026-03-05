"use client";

import { useEffect, useRef } from "react";
import type P5 from "p5";

export type VirtualPosition = {
  x: number;
  y: number;
};

const WA_BLACK = "#2B2B2B";
const WA_WHITE = "#F2F2F2";
const WA_RED = "#A52175";

export const VIRTUAL_LIMIT = 10;
const STAGE_PADDING = 36;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function clampVirtualPosition(value: VirtualPosition): VirtualPosition {
  return {
    x: clamp(value.x, -VIRTUAL_LIMIT, VIRTUAL_LIMIT),
    y: clamp(value.y, -VIRTUAL_LIMIT, VIRTUAL_LIMIT),
  };
}

function toScreenPosition(
  virtualPosition: VirtualPosition,
  width: number,
  height: number,
) {
  const availableX = width / 2 - STAGE_PADDING;
  const availableY = height / 2 - STAGE_PADDING;

  return {
    x: width / 2 + (virtualPosition.x / VIRTUAL_LIMIT) * availableX,
    y: height / 2 - (virtualPosition.y / VIRTUAL_LIMIT) * availableY,
  };
}

function toVirtualPosition(
  screenX: number,
  screenY: number,
  width: number,
  height: number,
): VirtualPosition {
  const availableX = width / 2 - STAGE_PADDING;
  const availableY = height / 2 - STAGE_PADDING;

  const virtualX = ((screenX - width / 2) / availableX) * VIRTUAL_LIMIT;
  const virtualY = -((screenY - height / 2) / availableY) * VIRTUAL_LIMIT;

  return clampVirtualPosition({
    x: virtualX,
    y: virtualY,
  });
}

type GardenP5StageProps = {
  virtualPosition: VirtualPosition;
  onVirtualPositionChange: (nextVirtualPosition: VirtualPosition) => void;
};

export function GardenP5Stage({
  virtualPosition,
  onVirtualPositionChange,
}: GardenP5StageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const virtualPositionRef = useRef<VirtualPosition>(virtualPosition);
  const onVirtualPositionChangeRef = useRef(onVirtualPositionChange);

  useEffect(() => {
    virtualPositionRef.current = virtualPosition;
  }, [virtualPosition]);

  useEffect(() => {
    onVirtualPositionChangeRef.current = onVirtualPositionChange;
  }, [onVirtualPositionChange]);

  useEffect(() => {
    let removed = false;
    let instance: P5 | null = null;

    const mountSketch = async () => {
      const { default: p5 } = await import("p5");

      if (removed || !containerRef.current) {
        return;
      }

      instance = new p5((sketch: P5) => {
        const getCanvasSize = () => {
          const bounds = containerRef.current?.getBoundingClientRect();

          return {
            width: Math.max(320, Math.floor(bounds?.width ?? 320)),
            height: Math.max(240, Math.floor(bounds?.height ?? 240)),
          };
        };

        sketch.setup = () => {
          const { width, height } = getCanvasSize();
          sketch.createCanvas(width, height).parent(containerRef.current!);
        };

        sketch.windowResized = () => {
          const { width, height } = getCanvasSize();
          sketch.resizeCanvas(width, height);
        };

        sketch.mousePressed = () => {
          const nextVirtualPosition = toVirtualPosition(
            sketch.mouseX,
            sketch.mouseY,
            sketch.width,
            sketch.height,
          );

          onVirtualPositionChangeRef.current(nextVirtualPosition);
        };

        sketch.draw = () => {
          const position = virtualPositionRef.current;
          const centerX = sketch.width / 2;
          const centerY = sketch.height / 2;
          const character = toScreenPosition(position, sketch.width, sketch.height);

          sketch.background(WA_WHITE);

          sketch.stroke(WA_BLACK);
          sketch.strokeWeight(1);
          sketch.line(0, centerY, sketch.width, centerY);
          sketch.line(centerX, 0, centerX, sketch.height);

          sketch.noStroke();
          sketch.fill(WA_RED);
          sketch.circle(character.x, character.y, 34);

          sketch.noFill();
          sketch.stroke(WA_BLACK);
          sketch.strokeWeight(2);
          sketch.circle(character.x, character.y, 44);
        };
      }, containerRef.current);
    };

    void mountSketch();

    return () => {
      removed = true;

      if (instance) {
        instance.remove();
      }
    };
  }, []);

  return (
    <section className="relative h-full w-full overflow-hidden rounded-lg border border-wa-black/20 bg-white/70">
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-wa-black/20 bg-white/80 px-3 py-1 text-xs">
        仮想座標 X: {virtualPosition.x.toFixed(1)} / Y: {virtualPosition.y.toFixed(1)}
      </div>
      <p className="pointer-events-none absolute bottom-3 left-3 text-xs">
        クリックでキャラクターを移動
      </p>
    </section>
  );
}
