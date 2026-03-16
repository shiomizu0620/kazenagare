export type GardenOption = {
  id: string;
  name: string;
};

export type GardenSetupSelection = {
  backgroundId: string;
  seasonId: string;
  timeSlotId: string;
};

export const GARDEN_BACKGROUNDS: GardenOption[] = [
  { id: "garden-all", name: "庭" },
  { id: "bamboo-forest", name: "竹林" },
  { id: "night-pond", name: "夜の池" },
  { id: "misty-temple", name: "霧の寺" },
];

export const GARDEN_SEASONS: GardenOption[] = [
  { id: "spring", name: "春" },
  { id: "summer", name: "夏" },
  { id: "autumn", name: "秋" },
  { id: "winter", name: "冬" },
];

export const GARDEN_TIME_SLOTS: GardenOption[] = [
  { id: "daytime", name: "昼" },
  { id: "morning", name: "朝" },
  { id: "evening", name: "夕方" },
  { id: "night", name: "夜" },
];
