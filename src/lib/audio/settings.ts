export const KAZENAGARE_AUDIO_SETTINGS_STORAGE_KEY = "kazenagare_audio_settings";
export const KAZENAGARE_AUDIO_SETTINGS_EVENT = "kazenagare:audio-settings-changed";

export type KazenagareAudioSettings = {
  bgmVolume: number;
  characterVoiceVolume: number;
};

export const DEFAULT_KAZENAGARE_AUDIO_SETTINGS: KazenagareAudioSettings = {
  bgmVolume: 0.45,
  characterVoiceVolume: 0.8,
};

function clampVolume(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

export function parseKazenagareAudioSettings(
  rawValue: string | null,
): KazenagareAudioSettings {
  if (!rawValue) {
    return DEFAULT_KAZENAGARE_AUDIO_SETTINGS;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<KazenagareAudioSettings> | null;

    if (!parsed || typeof parsed !== "object") {
      return DEFAULT_KAZENAGARE_AUDIO_SETTINGS;
    }

    return {
      bgmVolume: clampVolume(
        typeof parsed.bgmVolume === "number"
          ? parsed.bgmVolume
          : DEFAULT_KAZENAGARE_AUDIO_SETTINGS.bgmVolume,
      ),
      characterVoiceVolume: clampVolume(
        typeof parsed.characterVoiceVolume === "number"
          ? parsed.characterVoiceVolume
          : DEFAULT_KAZENAGARE_AUDIO_SETTINGS.characterVoiceVolume,
      ),
    };
  } catch {
    return DEFAULT_KAZENAGARE_AUDIO_SETTINGS;
  }
}

export function loadKazenagareAudioSettings(): KazenagareAudioSettings {
  if (typeof window === "undefined") {
    return DEFAULT_KAZENAGARE_AUDIO_SETTINGS;
  }

  return parseKazenagareAudioSettings(
    window.localStorage.getItem(KAZENAGARE_AUDIO_SETTINGS_STORAGE_KEY),
  );
}

export function saveKazenagareAudioSettings(settings: KazenagareAudioSettings) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedSettings: KazenagareAudioSettings = {
    bgmVolume: clampVolume(settings.bgmVolume),
    characterVoiceVolume: clampVolume(settings.characterVoiceVolume),
  };

  window.localStorage.setItem(
    KAZENAGARE_AUDIO_SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizedSettings),
  );
  window.dispatchEvent(
    new CustomEvent<KazenagareAudioSettings>(KAZENAGARE_AUDIO_SETTINGS_EVENT, {
      detail: normalizedSettings,
    }),
  );
}
