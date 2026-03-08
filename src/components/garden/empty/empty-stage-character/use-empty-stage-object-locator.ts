import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject, RefObject } from "react";
import type { ObjectType } from "@/types/garden";
import type {
  ObjectLocatorIndicator,
  PlacedStageObject,
  Vector2,
} from "./empty-stage-character.types";
import { calculateObjectLocatorIndicator } from "./empty-stage-character.utils";

type UseEmptyStageObjectLocatorArgs = {
  canPlaceObject: boolean;
  placementObjectType: ObjectType | null;
  placedPlacementObject: PlacedStageObject | null;
  stageViewportSize: Vector2;
  stageRef: RefObject<HTMLDivElement | null>;
  stageSizeRef: MutableRefObject<Vector2>;
  cameraOffsetRef: MutableRefObject<Vector2>;
  clearPlacementState: () => void;
};

type UseEmptyStageObjectLocatorResult = {
  isObjectLocatorVisible: boolean;
  objectLocatorIndicator: ObjectLocatorIndicator | null;
  showPlacedObjectLocator: () => boolean;
};

export function useEmptyStageObjectLocator({
  canPlaceObject,
  placementObjectType,
  placedPlacementObject,
  stageViewportSize,
  stageRef,
  stageSizeRef,
  cameraOffsetRef,
  clearPlacementState,
}: UseEmptyStageObjectLocatorArgs): UseEmptyStageObjectLocatorResult {
  const [isObjectLocatorVisible, setIsObjectLocatorVisible] = useState(false);
  const [objectLocatorIndicator, setObjectLocatorIndicator] =
    useState<ObjectLocatorIndicator | null>(null);
  const objectLocatorHideTimerRef = useRef<number | null>(null);
  const autoLocatorShownKeyRef = useRef<string | null>(null);

  const getObjectLocatorIndicatorFromWorld = useCallback(
    (targetWorldPosition: Vector2): ObjectLocatorIndicator | null => {
      return calculateObjectLocatorIndicator({
        stageSize: {
          x: stageRef.current?.clientWidth ?? stageSizeRef.current.x,
          y: stageRef.current?.clientHeight ?? stageSizeRef.current.y,
        },
        cameraOffset: cameraOffsetRef.current,
        targetWorldPosition,
      });
    },
    [cameraOffsetRef, stageRef, stageSizeRef],
  );

  const showPlacedObjectLocator = useCallback(() => {
    if (!placedPlacementObject) {
      return false;
    }

    clearPlacementState();

    const nextIndicator = getObjectLocatorIndicatorFromWorld({
      x: placedPlacementObject.x,
      y: placedPlacementObject.y,
    });

    if (!nextIndicator) {
      return false;
    }

    setObjectLocatorIndicator(nextIndicator);

    setIsObjectLocatorVisible(true);
    if (objectLocatorHideTimerRef.current !== null) {
      window.clearTimeout(objectLocatorHideTimerRef.current);
    }

    objectLocatorHideTimerRef.current = window.setTimeout(() => {
      setIsObjectLocatorVisible(false);
      setObjectLocatorIndicator(null);
      objectLocatorHideTimerRef.current = null;
    }, 2600);

    return true;
  }, [clearPlacementState, getObjectLocatorIndicatorFromWorld, placedPlacementObject]);

  useEffect(() => {
    if (!canPlaceObject || !placementObjectType || !placedPlacementObject) {
      autoLocatorShownKeyRef.current = null;
      return;
    }

    if (stageViewportSize.x <= 0 || stageViewportSize.y <= 0) {
      return;
    }

    const placementKey = `${placementObjectType}:${placedPlacementObject.id}`;
    if (autoLocatorShownKeyRef.current === placementKey) {
      return;
    }

    const showTimer = window.setTimeout(() => {
      const didShow = showPlacedObjectLocator();
      if (didShow) {
        autoLocatorShownKeyRef.current = placementKey;
      }
    }, 0);

    return () => {
      window.clearTimeout(showTimer);
    };
  }, [
    canPlaceObject,
    placedPlacementObject,
    placementObjectType,
    showPlacedObjectLocator,
    stageViewportSize.x,
    stageViewportSize.y,
  ]);

  useEffect(() => {
    return () => {
      if (objectLocatorHideTimerRef.current !== null) {
        window.clearTimeout(objectLocatorHideTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isObjectLocatorVisible || !placedPlacementObject) {
      return;
    }

    const refreshLocatorIndicator = () => {
      const nextIndicator = getObjectLocatorIndicatorFromWorld({
        x: placedPlacementObject.x,
        y: placedPlacementObject.y,
      });

      if (!nextIndicator) {
        return;
      }

      setObjectLocatorIndicator((current) => {
        if (!current) {
          return nextIndicator;
        }

        const movedEnough =
          Math.abs(current.x - nextIndicator.x) > 0.5 ||
          Math.abs(current.y - nextIndicator.y) > 0.5 ||
          Math.abs(current.angleDeg - nextIndicator.angleDeg) > 0.5;

        return movedEnough ? nextIndicator : current;
      });
    };

    refreshLocatorIndicator();
    const refreshIntervalId = window.setInterval(refreshLocatorIndicator, 120);

    return () => {
      window.clearInterval(refreshIntervalId);
    };
  }, [
    getObjectLocatorIndicatorFromWorld,
    isObjectLocatorVisible,
    placedPlacementObject,
  ]);

  return {
    isObjectLocatorVisible,
    objectLocatorIndicator,
    showPlacedObjectLocator,
  };
}
