export const KAZENAGARE_AUDIO_SUPPRESSION_EVENT = "kazenagare:audio-suppression";

export type KazenagareAudioSuppressionDetail = {
  isSuppressed: boolean;
  reason: "catalog";
};
