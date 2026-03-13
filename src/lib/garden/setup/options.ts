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
  { id: "bamboo-forest", name: "竹林" },
  { id: "night-pond", name: "夜の池" },
  { id: "misty-temple", name: "霧の寺" },
  // NOTE: `garden-all` は実験用の背景 ID であり、あえて public/images/README.md の「現在の ID」一覧には含めていません。
  { id: "garden-all", name: "庭" },
];

export const GARDEN_SEASONS: GardenOption[] = [
  { id: "spring", name: "春" },
  { id: "summer", name: "夏" },
  { id: "autumn", name: "秋" },
  { id: "winter", name: "冬" },
];

export const GARDEN_TIME_SLOTS: GardenOption[] = [
  { id: "morning", name: "朝" },
  { id: "daytime", name: "昼" },
  { id: "evening", name: "夕方" },
  { id: "night", name: "夜" },
];
