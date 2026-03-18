import Image from "next/image";
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import {
  OBJECT_VISUALS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./empty-stage-character.constants";
import type {
  CoinRewardPopup,
  ObjectLocatorIndicator,
  PlacedStageObject,
  Vector2,
} from "./empty-stage-character.types";

type EmptyStageCharacterStageProps = {
  children?: ReactNode;
  darkMode: boolean;
  isWalking: boolean;
  characterImageSrc: string;
  characterImageSizePx: number;
  characterFacingDirection:
    | "right"
    | "down-right"
    | "down"
    | "down-left"
    | "left"
    | "up-left"
    | "up"
    | "up-right";
  characterHorizontalFacing: "left" | "right";
  isPlacementBlocked: boolean;
  placementBlockedNotice: {
    id: string;
    message: string;
    position: Vector2;
  } | null;
  stageRef: RefObject<HTMLDivElement | null>;
  worldRef: RefObject<HTMLDivElement | null>;
  characterRef: RefObject<HTMLDivElement | null>;
  stageCursorClass: string;
  onStagePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onStagePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onStagePointerLeave: () => void;
  placedObjects: PlacedStageObject[];
  rewardVideoPlaybackByObjectId: Record<string, number>;
  coinRewardPopups: CoinRewardPopup[];
  liftedObjectId: string | null;
  objectChipFillColor: string;
  objectChipStrokeColor: string;
  objectChipTextColor: string;
  shouldRenderPlacementPreview: boolean;
  pointerWorldPosition: Vector2 | null;
  activePlacementObject: { imageSrc: string; label: string; stageImageSize: number } | null;
  isTouchPlacementLifted: boolean;
  liftedShadowColor: string;
  placementGuideFillColor: string;
  placementGuideStrokeColor: string;
  previewIconY: number;
  previewChipY: number;
  previewChipTextY: number;
  shouldRenderObjectLocator: boolean;
  objectLocatorIndicator: ObjectLocatorIndicator | null;
  locatorArrowFillColor: string;
  locatorArrowChipFillColor: string;
};

export function EmptyStageCharacterStage({
  children,
  darkMode,
  isWalking,
  characterImageSrc,
  characterImageSizePx,
  characterFacingDirection,
  characterHorizontalFacing,
  stageRef,
  worldRef,
  characterRef,
  stageCursorClass,
  onStagePointerMove,
  onStagePointerDown,
  onStagePointerLeave,
  isPlacementBlocked,
  placementBlockedNotice,
  placedObjects,
  rewardVideoPlaybackByObjectId,
  coinRewardPopups,
  liftedObjectId,
  objectChipFillColor,
  objectChipStrokeColor,
  objectChipTextColor,
  shouldRenderPlacementPreview,
  pointerWorldPosition,
  activePlacementObject,
  isTouchPlacementLifted,
  liftedShadowColor,
  placementGuideFillColor,
  placementGuideStrokeColor,
  previewIconY,
  previewChipY,
  previewChipTextY,
  shouldRenderObjectLocator,
  objectLocatorIndicator,
  locatorArrowFillColor,
  locatorArrowChipFillColor,
}: EmptyStageCharacterStageProps) {
  const previewHalfImageSize = activePlacementObject
    ? activePlacementObject.stageImageSize * 0.5
    : 0;
  const effectiveHorizontalFacing =
    characterFacingDirection === "left" ||
    characterFacingDirection === "down-left" ||
    characterFacingDirection === "up-left"
      ? "left"
      : characterFacingDirection === "right" ||
          characterFacingDirection === "down-right" ||
          characterFacingDirection === "up-right"
        ? "right"
        : characterHorizontalFacing;
  const characterFacingTransformClassName =
    effectiveHorizontalFacing === "right"
      ? "-scale-x-100 rotate-0"
      : "scale-x-100 rotate-0";

  return (
    <>
      <div
        ref={stageRef}
        className={`absolute inset-0 z-20 overflow-hidden ${stageCursorClass}`}
        onPointerMove={onStagePointerMove}
        onPointerDown={onStagePointerDown}
        onPointerLeave={onStagePointerLeave}
      >
        <div
          ref={worldRef}
          className="pointer-events-none absolute left-0 top-0 h-[2160px] w-[3840px] will-change-transform"
        >
          {children}

          <svg
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
            aria-hidden
          >
            {placedObjects.map((placedObject) => {
              const objectVisual = OBJECT_VISUALS[placedObject.objectType];
              const halfImageSize = objectVisual.stageImageSize * 0.5;
              const halfVideoSize = objectVisual.stageVideoSize * 0.5;
              const rewardVideoPlaybackKey = rewardVideoPlaybackByObjectId[placedObject.id];

              if (liftedObjectId && placedObject.id === liftedObjectId) {
                return null;
              }

              return (
                <g
                  key={placedObject.id}
                  transform={`translate(${placedObject.x} ${placedObject.y})`}
                >
                  {rewardVideoPlaybackKey ? (
                    <foreignObject
                      x={-halfVideoSize}
                      y={-halfVideoSize}
                      width={objectVisual.stageVideoSize}
                      height={objectVisual.stageVideoSize}
                      className="overflow-visible mix-blend-normal opacity-100"
                    >
                      <div
                        {...({ xmlns: "http://www.w3.org/1999/xhtml" } as Record<string, string>)}
                        className="flex h-full w-full items-center justify-center bg-transparent"
                      >
                        <video
                          key={`${placedObject.id}-${rewardVideoPlaybackKey}`}
                          src={objectVisual.stageVideoSrc}
                          autoPlay
                          muted
                          playsInline
                          preload="auto"
                          className="block h-full w-full object-cover opacity-100 visible"
                        />
                      </div>
                    </foreignObject>
                  ) : (
                    <image
                      href={objectVisual.imageSrc}
                      x={-halfImageSize}
                      y={-halfImageSize}
                      width={objectVisual.stageImageSize}
                      height={objectVisual.stageImageSize}
                      preserveAspectRatio="xMidYMid slice"
                    />
                  )}
                  <rect
                    x="-34"
                    y="40"
                    width="68"
                    height="20"
                    rx="10"
                    fill={objectChipFillColor}
                    stroke={objectChipStrokeColor}
                  />
                  <text
                    x="0"
                    y="50"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="10"
                    fill={objectChipTextColor}
                  >
                    {objectVisual.label}
                  </text>
                </g>
              );
            })}

            {coinRewardPopups.map((popup) => (
              <g
                key={popup.id}
                transform={`translate(${popup.x} ${popup.y})`}
              >
                {/* Keep world anchoring separate from animation to avoid transform conflicts in SVG. */}
                <g className="animate-[kazenagare-coin-pop_1.2s_ease-out_forwards]">
                  <rect
                    x="-52"
                    y="-24"
                    width="104"
                    height="34"
                    rx="12"
                    fill="rgba(255,247,220,0.96)"
                    stroke="rgba(184,134,11,0.75)"
                  />
                  <text
                    x="0"
                    y="-12"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill="#9A3412"
                  >
                    +{popup.coins} コイン
                  </text>
                  <text
                    x="0"
                    y="-1"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="9"
                    fill="#78350F"
                  >
                    {popup.objectLabel}
                  </text>
                </g>
              </g>
            ))}

            {placementBlockedNotice ? (
              <g
                key={placementBlockedNotice.id}
                transform={`translate(${placementBlockedNotice.position.x} ${placementBlockedNotice.position.y})`}
              >
                <g className="animate-[kazenagare-wallet-coin-pop_1.05s_ease-out_forwards]">
                  <rect
                    x="-64"
                    y="-58"
                    width="128"
                    height="20"
                    rx="10"
                    fill="rgba(127, 29, 29, 0.92)"
                    stroke="rgba(248, 113, 113, 0.95)"
                  />
                  <text
                    x="0"
                    y="-48"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="#FEF2F2"
                  >
                    {placementBlockedNotice.message}
                  </text>
                </g>
              </g>
            ) : null}

            {shouldRenderPlacementPreview && pointerWorldPosition && activePlacementObject ? (
              <g
                transform={`translate(${pointerWorldPosition.x} ${pointerWorldPosition.y})`}
                opacity="0.9"
              >
                {isTouchPlacementLifted ? (
                  <ellipse
                    cx="0"
                    cy="10"
                    rx="22"
                    ry="6"
                    fill={liftedShadowColor}
                    opacity="0.8"
                  />
                ) : null}
                <circle
                  cx="0"
                  cy="0"
                  r="28"
                  fill={isPlacementBlocked ? "rgba(255, 0, 0, 0.3)" : placementGuideFillColor}
                  stroke={isPlacementBlocked ? "#ef4444" : placementGuideStrokeColor}
                  strokeDasharray="6 4"
                  strokeWidth="2"
                />
                <image
                  href={activePlacementObject.imageSrc}
                  x={-previewHalfImageSize}
                  y={previewIconY - previewHalfImageSize}
                  width={activePlacementObject.stageImageSize}
                  height={activePlacementObject.stageImageSize}
                  preserveAspectRatio="xMidYMid slice"
                />
                {isTouchPlacementLifted ? (
                  <>
                    <rect
                      x="-34"
                      y={previewChipY}
                      width="68"
                      height="20"
                      rx="10"
                      fill={objectChipFillColor}
                      stroke={objectChipStrokeColor}
                    />
                    <text
                      x="0"
                      y={previewChipTextY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="10"
                      fill={objectChipTextColor}
                    >
                      {activePlacementObject.label}
                    </text>
                  </>
                ) : null}
              </g>
            ) : null}
          </svg>

        </div>

        {shouldRenderObjectLocator && objectLocatorIndicator ? (
          <svg
            className="pointer-events-none absolute inset-0 z-30 h-full w-full overflow-visible"
            aria-hidden
          >
            <g
              transform={`translate(${objectLocatorIndicator.x} ${objectLocatorIndicator.y}) rotate(${objectLocatorIndicator.angleDeg})`}
            >
              <circle
                cx="0"
                cy="0"
                r="17"
                fill={locatorArrowChipFillColor}
                stroke={placementGuideStrokeColor}
              />
              <path
                d="M 0 -10 L 9 6 L 0 1 L -9 6 Z"
                fill={locatorArrowFillColor}
                stroke={placementGuideStrokeColor}
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        ) : null}

        <div
          ref={characterRef}
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform-gpu"
        >
          <div
            className={`grid justify-items-center gap-1 ${
              isWalking
                ? "animate-[kazenagare-walk-bob_0.36s_ease-in-out_infinite]"
                : ""
            }`}
          >
            <Image
              src={characterImageSrc}
              alt=""
              aria-hidden={true}
              draggable={false}
              width={characterImageSizePx}
              height={characterImageSizePx}
              unoptimized
              className={`select-none object-contain transition-transform duration-100 ${characterFacingTransformClassName} ${
                darkMode ? "brightness-95" : ""
              }`}
            />
          </div>
        </div>
      </div>
    </>
  );
}
