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
  stageRef: RefObject<HTMLDivElement | null>;
  worldRef: RefObject<HTMLDivElement | null>;
  characterRef: RefObject<HTMLDivElement | null>;
  stageCursorClass: string;
  onStagePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onStagePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onStagePointerLeave: () => void;
  placedObjects: PlacedStageObject[];
  coinRewardPopups: CoinRewardPopup[];
  liftedObjectId: string | null;
  objectChipFillColor: string;
  objectChipStrokeColor: string;
  objectChipTextColor: string;
  shouldRenderPlacementPreview: boolean;
  pointerWorldPosition: Vector2 | null;
  activePlacementObject: { icon: string; label: string } | null;
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
  stageRef,
  worldRef,
  characterRef,
  stageCursorClass,
  onStagePointerMove,
  onStagePointerDown,
  onStagePointerLeave,
  placedObjects,
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

              if (liftedObjectId && placedObject.id === liftedObjectId) {
                return null;
              }

              return (
                <g
                  key={placedObject.id}
                  transform={`translate(${placedObject.x} ${placedObject.y})`}
                >
                  <text
                    x="0"
                    y="0"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="30"
                  >
                    {objectVisual.icon}
                  </text>
                  <rect
                    x="-34"
                    y="18"
                    width="68"
                    height="20"
                    rx="10"
                    fill={objectChipFillColor}
                    stroke={objectChipStrokeColor}
                  />
                  <text
                    x="0"
                    y="28"
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
                    +{popup.coins} coin
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
                  fill={placementGuideFillColor}
                  stroke={placementGuideStrokeColor}
                  strokeDasharray="6 4"
                />
                <text
                  x="0"
                  y={previewIconY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="30"
                >
                  {activePlacementObject.icon}
                </text>
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
    </>
  );
}
