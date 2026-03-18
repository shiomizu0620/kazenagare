export type ObjectType =
  | "furin"
  | "shishi-odoshi"
  | "hanabi"
  | "kane"
  | "obake"
  | "tyo-tyo"
  | "kaeru"
  | "hue"
  | "suzume"
  | "sansin"
  | "mattya"
  | "semi"
  | "takibi"
  | "akimusi"
  | "ka";

export type GardenBackground = {
  id: string;
  name: string;
};

export type GardenProfile = {
  userId: string;
  username: string;
  selectedBackgroundId: string;
};

export type VoiceParameters = {
  pitch: number;
  reverb: number;
};

export type VoiceRecord = {
  id: string;
  userId: string;
  objectType: ObjectType;
  voiceUrl: string;
  parameters: VoiceParameters;
  createdAt: string;
};
