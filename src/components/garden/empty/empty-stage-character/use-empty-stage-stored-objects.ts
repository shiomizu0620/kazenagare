import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  GARDEN_PLACED_OBJECTS_UPDATED_EVENT,
  type GardenPlacedObjectsUpdatedEventDetail,
} from "@/lib/garden/placed-objects-storage";
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

    const serializedPlacedObjects = JSON.stringify(placedObjects);

    if (window.localStorage.getItem(resolvedStorageKey) === serializedPlacedObjects) {
      return;
    }

    window.localStorage.setItem(resolvedStorageKey, serializedPlacedObjects);
  }, [placedObjects, resolvedStorageKey]);

  useEffect(() => {
    if (!resolvedStorageKey) {
      return;
    }

    const applyStoredObjects = (rawValue: string | null) => {
      const nextStoredObjects = parseStoredObjects(rawValue);
      hasLoadedStoredObjectsRef.current = true;
      setPlacedObjects(nextStoredObjects);
    };

    const handleLocalObjectsUpdate: EventListener = (event) => {
      const customEvent = event as CustomEvent<GardenPlacedObjectsUpdatedEventDetail>;

      if (customEvent.detail?.storageKey !== resolvedStorageKey) {
        return;
      }

      applyStoredObjects(window.localStorage.getItem(resolvedStorageKey));
    };

    const handleStorageUpdate = (event: StorageEvent) => {
      if (event.key !== resolvedStorageKey) {
        return;
      }

      applyStoredObjects(event.newValue);
    };

    window.addEventListener(
      GARDEN_PLACED_OBJECTS_UPDATED_EVENT,
      handleLocalObjectsUpdate,
    );
    window.addEventListener("storage", handleStorageUpdate);

    return () => {
      window.removeEventListener(
        GARDEN_PLACED_OBJECTS_UPDATED_EVENT,
        handleLocalObjectsUpdate,
      );
      window.removeEventListener("storage", handleStorageUpdate);
    };
  }, [resolvedStorageKey, setPlacedObjects]);
}
