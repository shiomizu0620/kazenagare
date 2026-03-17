export const GARDEN_OBJECTS_STORAGE_KEY_ME = "kazenagare_objects_me";
export const GARDEN_PLACED_OBJECTS_UPDATED_EVENT = "kazenagare:placed-objects-updated";

export function getGardenObjectsStorageKeyForOwner(ownerId: string) {
  return `${GARDEN_OBJECTS_STORAGE_KEY_ME}_${ownerId || "local_guest"}`;
}

export type GardenPlacedObjectsUpdatedEventDetail = {
  storageKey: string;
};

export function dispatchGardenPlacedObjectsUpdated(storageKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<GardenPlacedObjectsUpdatedEventDetail>(
      GARDEN_PLACED_OBJECTS_UPDATED_EVENT,
      {
        detail: { storageKey },
      },
    ),
  );
}

export function resetGardenPlacedObjects(storageKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(storageKey);
  dispatchGardenPlacedObjectsUpdated(storageKey);
}