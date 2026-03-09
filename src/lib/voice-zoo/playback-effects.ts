import type { ObjectType } from "@/types/garden";

type AudioWithPitchControl = HTMLAudioElement & {
  preservesPitch?: boolean;
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
};

export function getVoiceZooPlaybackRate(objectType: ObjectType) {
  if (objectType === "furin") {
    return 1.08;
  }

  return 0.94;
}

export function applyVoiceZooPlaybackEffect(
  audioElement: HTMLAudioElement,
  objectType: ObjectType,
) {
  const playbackRate = getVoiceZooPlaybackRate(objectType);
  const audioWithPitchControl = audioElement as AudioWithPitchControl;

  audioElement.playbackRate = playbackRate;
  audioWithPitchControl.preservesPitch = false;
  audioWithPitchControl.mozPreservesPitch = false;
  audioWithPitchControl.webkitPreservesPitch = false;
}
