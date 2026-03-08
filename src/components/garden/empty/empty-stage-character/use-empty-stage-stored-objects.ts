import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { PlacedStageObject } from "./empty-stage-character.types";
import { parseStoredObjects } from "./empty-stage-character.utils";

type UseEmptyStageStoredObjectsArgs = {
  resolvedStorageKey: string | null;
  placedObjects: PlacedStageObject[];
  setPlacedObjects: Dispatch<SetStateAction<PlacedStageObject[]>>;
};

export function useEmptyStageStoredObjects({
  resolvedStorageKey,
  placedObjects,
  setPlacedObjects,
}: UseEmptyStageStoredObjectsArgs) {
  const hasLoadedStoredObjectsRef = useRef(false);

  useEffect(() => {
    hasLoadedStoredObjectsRef.current = false;

    if (!resolvedStorageKey) {
      return;
    }

    const loadTimer = window.setTimeout(() => {
      const storedObjects = parseStoredObjects(
        window.localStorage.getItem(resolvedStorageKey),
      );
      hasLoadedStoredObjectsRef.current = true;
      setPlacedObjects(storedObjects);
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
    };
  }, [resolvedStorageKey, setPlacedObjects]);

  useEffect(() => {
    if (!resolvedStorageKey || !hasLoadedStoredObjectsRef.current) {
      return;
    }

    window.localStorage.setItem(
      resolvedStorageKey,
      JSON.stringify(placedObjects),
    );
  }, [placedObjects, resolvedStorageKey]);
}
