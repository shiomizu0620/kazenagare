"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_KAZENAGARE_AUDIO_SETTINGS,
  type KazenagareAudioSettings,
  KAZENAGARE_AUDIO_SETTINGS_EVENT,
  KAZENAGARE_AUDIO_SETTINGS_STORAGE_KEY,
  loadKazenagareAudioSettings,
  parseKazenagareAudioSettings,
} from "@/lib/audio/settings";
import {
  GARDEN_BGM_MANIFEST_PATH,
  parseGardenBgmManifest,
  resolveGardenBgmTrack,
} from "@/lib/audio/garden-bgm";

type GardenStageBgmProps = {
  backgroundId: string;
  seasonId: string;
  timeSlotId: string;
};

const GARDEN_BGM_EXTENSIONS = ["mp3", "ogg", "m4a", "wav", "webm"] as const;

function buildGardenBgmCandidates(
  backgroundId: string,
  seasonId: string,
  timeSlotId: string,
) {
  const baseNames = [
    `${backgroundId}-${seasonId}-${timeSlotId}`,
    `${backgroundId}-${seasonId}`,
    `${backgroundId}-${timeSlotId}`,
    backgroundId,
    `${seasonId}-${timeSlotId}`,
    seasonId,
    timeSlotId,
    "default",
    "bgm",
  ];
  const candidates: string[] = [];

  for (const baseName of baseNames) {
    for (const extension of GARDEN_BGM_EXTENSIONS) {
      candidates.push(`/audio/garden/${baseName}.${extension}`);
    }
  }

  return Array.from(new Set(candidates));
}

function probeAudioSource(sourcePath: string, signal: AbortSignal) {
  return new Promise<boolean>((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }

    const probeAudio = new Audio();
    probeAudio.preload = "metadata";

    let hasSettled = false;

    const settle = (didLoad: boolean) => {
      if (hasSettled) {
        return;
      }

      hasSettled = true;
      cleanup();
      resolve(didLoad);
    };

    const handleLoaded = () => settle(true);
    const handleError = () => settle(false);
    const handleAbort = () => settle(false);
    const timeoutId = window.setTimeout(() => settle(false), 2500);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      signal.removeEventListener("abort", handleAbort);
      probeAudio.removeEventListener("loadedmetadata", handleLoaded);
      probeAudio.removeEventListener("canplay", handleLoaded);
      probeAudio.removeEventListener("error", handleError);
      probeAudio.pause();
      probeAudio.removeAttribute("src");
      probeAudio.load();
    };

    signal.addEventListener("abort", handleAbort, { once: true });
    probeAudio.addEventListener("loadedmetadata", handleLoaded, { once: true });
    probeAudio.addEventListener("canplay", handleLoaded, { once: true });
    probeAudio.addEventListener("error", handleError, { once: true });

    probeAudio.src = sourcePath;
    probeAudio.load();
  });
}

export function GardenStageBgm({
  backgroundId,
  seasonId,
  timeSlotId,
}: GardenStageBgmProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [bgmVolume, setBgmVolume] = useState(DEFAULT_KAZENAGARE_AUDIO_SETTINGS.bgmVolume);
  const bgmVolumeRef = useRef(DEFAULT_KAZENAGARE_AUDIO_SETTINGS.bgmVolume);
  const resolvedVolumeMultiplierRef = useRef(1);
  const [resolvedSource, setResolvedSource] = useState<string | null>(null);
  const [resolvedVolumeMultiplier, setResolvedVolumeMultiplier] = useState(1);

  const candidates = useMemo(
    () => buildGardenBgmCandidates(backgroundId, seasonId, timeSlotId),
    [backgroundId, seasonId, timeSlotId],
  );

  const startPlayback = useCallback(async () => {
    const audioElement = audioRef.current;

    if (!audioElement || !resolvedSource) {
      return;
    }

    const effectiveVolume = Math.min(
      1,
      Math.max(0, bgmVolumeRef.current * resolvedVolumeMultiplierRef.current),
    );
    audioElement.volume = effectiveVolume;

    if (!audioElement.paused && !audioElement.ended) {
      return;
    }

    try {
      await audioElement.play();
    } catch {
      // Autoplay may be blocked until user interaction.
    }
  }, [resolvedSource]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      setBgmVolume(loadKazenagareAudioSettings().bgmVolume);
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
    };
  }, []);

  useEffect(() => {
    const handleLocalAudioSettingsUpdate: EventListener = (event) => {
      const customEvent = event as CustomEvent<KazenagareAudioSettings>;

      if (customEvent.detail) {
        setBgmVolume(customEvent.detail.bgmVolume);
        return;
      }

      setBgmVolume(loadKazenagareAudioSettings().bgmVolume);
    };

    const handleAudioSettingsStorageUpdate = (event: StorageEvent) => {
      if (event.key !== KAZENAGARE_AUDIO_SETTINGS_STORAGE_KEY) {
        return;
      }

      const parsedSettings = parseKazenagareAudioSettings(event.newValue);
      setBgmVolume(parsedSettings.bgmVolume);
    };

    window.addEventListener(
      KAZENAGARE_AUDIO_SETTINGS_EVENT,
      handleLocalAudioSettingsUpdate,
    );
    window.addEventListener("storage", handleAudioSettingsStorageUpdate);

    return () => {
      window.removeEventListener(
        KAZENAGARE_AUDIO_SETTINGS_EVENT,
        handleLocalAudioSettingsUpdate,
      );
      window.removeEventListener("storage", handleAudioSettingsStorageUpdate);
    };
  }, []);

  useEffect(() => {
    bgmVolumeRef.current = bgmVolume;
    resolvedVolumeMultiplierRef.current = resolvedVolumeMultiplier;

    const audioElement = audioRef.current;

    if (!audioElement) {
      return;
    }

    audioElement.volume = Math.min(
      1,
      Math.max(0, bgmVolume * resolvedVolumeMultiplier),
    );
  }, [bgmVolume, resolvedVolumeMultiplier]);

  useEffect(() => {
    const abortController = new AbortController();
    const audioElement = audioRef.current;

    if (audioElement) {
      audioElement.pause();
    }

    void (async () => {
      try {
        const manifestResponse = await fetch(GARDEN_BGM_MANIFEST_PATH, {
          cache: "no-store",
          signal: abortController.signal,
        });

        if (manifestResponse.ok) {
          const rawManifest = (await manifestResponse.json()) as unknown;
          const parsedManifest = parseGardenBgmManifest(rawManifest);

          if (parsedManifest) {
            const resolvedTrack = resolveGardenBgmTrack(
              parsedManifest,
              { backgroundId, seasonId, timeSlotId },
            );

            if (resolvedTrack) {
              const isResolvedTrackAvailable = await probeAudioSource(
                resolvedTrack.src,
                abortController.signal,
              );

              if (isResolvedTrackAvailable && !abortController.signal.aborted) {
                setResolvedSource(resolvedTrack.src);
                setResolvedVolumeMultiplier(resolvedTrack.volumeMultiplier);
                return;
              }
            }
          }
        }
      } catch {
        // Fall back to filename-based discovery when manifest cannot be loaded.
      }

      for (const candidate of candidates) {
        if (abortController.signal.aborted) {
          return;
        }

        const isAvailable = await probeAudioSource(candidate, abortController.signal);

        if (isAvailable) {
          if (!abortController.signal.aborted) {
            setResolvedSource(candidate);
          }
          return;
        }
      }

      if (!abortController.signal.aborted) {
        setResolvedSource(null);
        setResolvedVolumeMultiplier(1);
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [backgroundId, candidates, seasonId, timeSlotId]);

  useEffect(() => {
    const audioElement = audioRef.current;

    if (!audioElement) {
      return;
    }

    if (!resolvedSource) {
      audioElement.pause();
      audioElement.removeAttribute("src");
      audioElement.load();
      return;
    }

    audioElement.currentTime = 0;
    void startPlayback();

    return () => {
      audioElement.pause();
    };
  }, [resolvedSource, startPlayback]);

  useEffect(() => {
    if (!resolvedSource) {
      return;
    }

    const resumePlayback = () => {
      void startPlayback();
    };

    window.addEventListener("pointerdown", resumePlayback);
    window.addEventListener("keydown", resumePlayback);
    window.addEventListener("touchstart", resumePlayback);

    return () => {
      window.removeEventListener("pointerdown", resumePlayback);
      window.removeEventListener("keydown", resumePlayback);
      window.removeEventListener("touchstart", resumePlayback);
    };
  }, [resolvedSource, startPlayback]);

  if (!resolvedSource) {
    return null;
  }

  return (
    <audio
      ref={audioRef}
      src={resolvedSource}
      loop
      preload="auto"
      playsInline
      aria-hidden="true"
      className="hidden"
    />
  );
}