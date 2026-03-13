"use client";

import { del, set } from "idb-keyval";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  DEFAULT_KAZENAGARE_AUDIO_SETTINGS,
  type KazenagareAudioSettings,
  loadKazenagareAudioSettings,
  saveKazenagareAudioSettings,
} from "@/lib/audio/settings";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  type VoiceZooEntry,
  type VoiceZooEntryStatus,
  VOICE_ZOO_ENTRIES,
} from "@/lib/voice-zoo/catalog";
import { applyVoiceZooPlaybackEffect } from "@/lib/voice-zoo/playback-effects";
import {
  createVoiceZooRecordingId,
  getVoiceZooLegacyRecordingStorageKey,
  getVoiceZooRecordingBlobStorageKey,
  getVoiceZooRecordingCatalogStorageKey,
  parseVoiceZooRecordingCatalog,
  type VoiceZooRecordingMeta,
  VOICE_ZOO_RECORDING_UPDATED_EVENT,
  VOICE_ZOO_SUPPORTED_OBJECT_TYPES,
} from "@/lib/voice-zoo/recordings";
import {
  calculatePlaybackRewardCoins,
  createInitialVoiceZooWallet,
  INITIAL_VOICE_ZOO_COINS,
  parseVoiceZooWallet,
  saveVoiceZooWallet,
  VOICE_ZOO_WALLET_STORAGE_KEY,
} from "@/lib/voice-zoo/wallet";
import type { ObjectType } from "@/types/garden";

const RECORDING_DURATION_SECONDS = 3;

export type GardenOptionAction = {
  href: string;
  label: string;
  description?: string;
};

type GardenOptionsMenuProps = {
  actions: GardenOptionAction[];
  buttonLabel?: string;
  title?: string;
  darkMode?: boolean;
  catalogLabel?: string;
};

function catalogStatusLabel(status: VoiceZooEntryStatus) {
  if (status === "prototype") {
    return "試作中";
  }

  return "企画中";
}

function catalogStatusClass(status: VoiceZooEntryStatus, darkMode: boolean) {
  if (status === "prototype") {
    return darkMode
      ? "border-emerald-200/40 bg-emerald-300/15 text-emerald-100"
      : "border-emerald-700/30 bg-emerald-100 text-emerald-900";
  }

  return darkMode
    ? "border-amber-200/40 bg-amber-300/15 text-amber-100"
    : "border-amber-700/30 bg-amber-100 text-amber-900";
}

export function GardenOptionsMenu({
  actions,
  buttonLabel = "オプション",
  title = "庭のメニュー",
  darkMode = false,
  catalogLabel = "図鑑を開く",
}: GardenOptionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [catalogActionNotice, setCatalogActionNotice] = useState<string | null>(null);
  const [testingNotice, setTestingNotice] = useState<string | null>(null);
  const [ownedCatalogObjectTypes, setOwnedCatalogObjectTypes] = useState<ObjectType[]>([]);
  const [audioOwnerId, setAudioOwnerId] = useState<string>("local_guest");
  const [recordingEntry, setRecordingEntry] = useState<VoiceZooEntry | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingCountdown, setRecordingCountdown] = useState(RECORDING_DURATION_SECONDS);
  const [recordingNotice, setRecordingNotice] = useState<string | null>(null);
  const [recordingPreviewAudioUrls, setRecordingPreviewAudioUrls] = useState<
    Partial<Record<ObjectType, string>>
  >({});
  const [audioSettings, setAudioSettings] = useState<KazenagareAudioSettings>(
    DEFAULT_KAZENAGARE_AUDIO_SETTINGS,
  );
  const [selectedCatalogObjectType, setSelectedCatalogObjectType] =
    useState<ObjectType>(VOICE_ZOO_ENTRIES[0]?.objectType ?? "furin");
  const panelId = useId();
  const catalogPanelId = useId();
  const recordingPreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordingMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStopTimerRef = useRef<number | null>(null);
  const recordingCountdownTimerRef = useRef<number | null>(null);
  const recordingPreviewAudioUrlsRef = useRef<Partial<Record<ObjectType, string>>>({});

  const iconButtonClass = `grid h-11 w-11 place-items-center rounded-full border transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98] ${
    darkMode
      ? "border-wa-white/45 bg-wa-black/60 text-wa-white hover:bg-wa-black/80"
      : "border-wa-black/25 bg-wa-white/85 text-wa-black hover:bg-wa-white"
  }`;

  const panelClass = `grid gap-3 rounded-2xl border p-3 shadow-xl backdrop-blur-sm transition-all duration-150 ${
    isOpen
      ? "pointer-events-auto translate-y-0 opacity-100"
      : "pointer-events-none -translate-y-1 opacity-0"
  } ${
    darkMode
      ? "border-wa-white/30 bg-wa-black/70 text-wa-white"
      : "border-wa-black/20 bg-wa-white/95 text-wa-black"
  }`;

  const itemClass = `grid gap-1 rounded-xl border px-3 py-2 text-left transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98] ${
    darkMode
      ? "border-wa-white/20 bg-wa-white/5 hover:bg-wa-white/10"
      : "border-wa-black/15 bg-wa-white hover:bg-wa-red/10"
  }`;

  const descriptionClass = `text-xs ${darkMode ? "text-wa-white/75" : "text-wa-black/70"}`;

  const selectedCatalogEntry =
    VOICE_ZOO_ENTRIES.find((entry) => entry.objectType === selectedCatalogObjectType) ??
    VOICE_ZOO_ENTRIES[0];
  const selectedEntryPlaybackReward = selectedCatalogEntry
    ? calculatePlaybackRewardCoins(selectedCatalogEntry.price)
    : 0;
  const isSelectedCatalogObjectOwned = selectedCatalogEntry
    ? ownedCatalogObjectTypes.includes(selectedCatalogEntry.objectType)
    : false;
  const recordingEntryAudioUrl = recordingEntry
    ? (recordingPreviewAudioUrls[recordingEntry.objectType] ?? null)
    : null;
  const canPlaceFromRecordingModal = Boolean(recordingEntryAudioUrl) && !isRecording;
  const catalogSlots = Array.from({ length: 3 }, (_, index) =>
    VOICE_ZOO_ENTRIES[index] ?? null,
  );

  const clearRecordingTimers = useCallback(() => {
    if (recordingStopTimerRef.current !== null) {
      window.clearTimeout(recordingStopTimerRef.current);
      recordingStopTimerRef.current = null;
    }

    if (recordingCountdownTimerRef.current !== null) {
      window.clearInterval(recordingCountdownTimerRef.current);
      recordingCountdownTimerRef.current = null;
    }
  }, []);

  const stopRecordingStream = useCallback(() => {
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    }
  }, []);

  const updatePreviewAudioUrl = useCallback((objectType: ObjectType, nextBlob: Blob) => {
    setRecordingPreviewAudioUrls((current) => {
      const nextState = { ...current };
      const currentUrl = current[objectType];

      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }

      nextState[objectType] = URL.createObjectURL(nextBlob);
      return nextState;
    });
  }, []);

  const resolveCurrentRecordingOwnerId = useCallback(async () => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      return audioOwnerId || "local_guest";
    }

    const { data } = await supabase.auth.getSession();
    const resolvedOwnerId = data.session?.user?.id || "local_guest";

    if (resolvedOwnerId !== audioOwnerId) {
      setAudioOwnerId(resolvedOwnerId);
    }

    return resolvedOwnerId;
  }, [audioOwnerId]);

  const closeRecordingModal = useCallback(() => {
    if (
      recordingMediaRecorderRef.current &&
      recordingMediaRecorderRef.current.state !== "inactive"
    ) {
      recordingMediaRecorderRef.current.stop();
    }

    clearRecordingTimers();
    stopRecordingStream();
    setIsRecording(false);
    setRecordingCountdown(RECORDING_DURATION_SECONDS);
    setRecordingNotice(null);
    setRecordingEntry(null);
  }, [clearRecordingTimers, stopRecordingStream]);

  const openRecordingModalForEntry = useCallback(
    (entry: VoiceZooEntry, noticeMessage: string) => {
      setCatalogActionNotice(null);
      setRecordingEntry(entry);
      setIsRecording(false);
      setRecordingCountdown(RECORDING_DURATION_SECONDS);
      setRecordingNotice(noticeMessage);
    },
    [],
  );

  const startThreeSecondRecording = useCallback(async () => {
    if (!recordingEntry || isRecording) {
      return;
    }

    setRecordingNotice(null);
    setRecordingCountdown(RECORDING_DURATION_SECONDS);

    try {
      const recordingOwnerId = await resolveCurrentRecordingOwnerId();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];

      let recorder: MediaRecorder;

      try {
        recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      } catch {
        recorder = new MediaRecorder(stream);
      }

      recordingMediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const recordingObjectType = recordingEntry.objectType;
        const recordingObjectName = recordingEntry.name;

        clearRecordingTimers();
        setIsRecording(false);
        stopRecordingStream();

        const nextBlob = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        if (nextBlob.size === 0) {
          setRecordingNotice("録音データを取得できませんでした。もう一度お試しください。");
          return;
        }

        const nextRecordingId = createVoiceZooRecordingId(recordingObjectType);
        await set(
          getVoiceZooRecordingBlobStorageKey(recordingOwnerId, nextRecordingId),
          nextBlob,
        );

        const catalogStorageKey = getVoiceZooRecordingCatalogStorageKey(recordingOwnerId);
        const currentCatalog = parseVoiceZooRecordingCatalog(
          window.localStorage.getItem(catalogStorageKey),
        );
        const nextCatalogEntry: VoiceZooRecordingMeta = {
          id: nextRecordingId,
          objectType: recordingObjectType,
          createdAt: new Date().toISOString(),
        };
        const nextCatalog = [...currentCatalog, nextCatalogEntry];

        window.localStorage.setItem(catalogStorageKey, JSON.stringify(nextCatalog));
        window.dispatchEvent(
          new CustomEvent(VOICE_ZOO_RECORDING_UPDATED_EVENT, {
            detail: {
              ownerId: recordingOwnerId,
              objectType: recordingObjectType,
              recordingId: nextRecordingId,
            },
          }),
        );
        updatePreviewAudioUrl(recordingObjectType, nextBlob);
        setRecordingNotice(`${recordingObjectName}の録音を保存しました。`);
      };

      recorder.start();
      setIsRecording(true);
      setRecordingNotice("録音中です... 3秒後に自動停止します。");

      recordingCountdownTimerRef.current = window.setInterval(() => {
        setRecordingCountdown((current) => Math.max(0, current - 1));
      }, 1000);

      recordingStopTimerRef.current = window.setTimeout(() => {
        if (
          recordingMediaRecorderRef.current &&
          recordingMediaRecorderRef.current.state !== "inactive"
        ) {
          recordingMediaRecorderRef.current.stop();
        }
      }, RECORDING_DURATION_SECONDS * 1000);
    } catch {
      clearRecordingTimers();
      stopRecordingStream();
      setIsRecording(false);
      setRecordingNotice("マイクの利用を許可してください。");
    }
  }, [
    clearRecordingTimers,
    isRecording,
    recordingEntry,
    resolveCurrentRecordingOwnerId,
    stopRecordingStream,
    updatePreviewAudioUrl,
  ]);

  const handleRecordingPreviewPlay = useCallback(() => {
    if (!recordingEntry || !recordingPreviewAudioRef.current) {
      return;
    }

    applyVoiceZooPlaybackEffect(
      recordingPreviewAudioRef.current,
      recordingEntry.objectType,
    );
  }, [recordingEntry]);

  const handlePlacementFromRecordingModal = useCallback(() => {
    if (!recordingEntry || typeof window === "undefined") {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set("place", recordingEntry.objectType);
    const nextSearch = searchParams.toString();

    closeRecordingModal();
    window.location.assign(
      nextSearch.length > 0
        ? `${window.location.pathname}?${nextSearch}`
        : window.location.pathname,
    );
  }, [closeRecordingModal, recordingEntry]);

  useEffect(() => {
    recordingPreviewAudioUrlsRef.current = recordingPreviewAudioUrls;
  }, [recordingPreviewAudioUrls]);

  useEffect(() => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setAudioOwnerId(session?.user?.id || "local_guest");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAudioOwnerId(session?.user?.id || "local_guest");
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    return () => {
      clearRecordingTimers();
      stopRecordingStream();

      for (const url of Object.values(recordingPreviewAudioUrlsRef.current)) {
        if (url) {
          URL.revokeObjectURL(url);
        }
      }
    };
  }, [clearRecordingTimers, stopRecordingStream]);

  const updateAudioSetting = (
    key: keyof KazenagareAudioSettings,
    nextVolumePercent: string,
  ) => {
    const nextVolume = Math.min(1, Math.max(0, Number(nextVolumePercent) / 100));
    const nextSettings: KazenagareAudioSettings = {
      ...audioSettings,
      [key]: nextVolume,
    };

    setAudioSettings(nextSettings);
    saveKazenagareAudioSettings(nextSettings);
  };

  const closeAllPanels = () => {
    setIsOpen(false);
    setIsCatalogOpen(false);
  };

  const handlePurchaseAndPlaceFromCatalog = () => {
    if (!selectedCatalogEntry || typeof window === "undefined") {
      return;
    }

    const targetObjectType = selectedCatalogEntry.objectType;
    const currentWallet = parseVoiceZooWallet(
      window.localStorage.getItem(VOICE_ZOO_WALLET_STORAGE_KEY),
    );

    if (currentWallet.ownedObjectTypes.includes(targetObjectType)) {
      setOwnedCatalogObjectTypes(currentWallet.ownedObjectTypes);
      openRecordingModalForEntry(
        selectedCatalogEntry,
        `${selectedCatalogEntry.name}は購入済みです。3秒録音を開始してください。`,
      );
      return;
    }

    if (currentWallet.coins < selectedCatalogEntry.price) {
      setCatalogActionNotice(
        `コイン不足です（必要 ${selectedCatalogEntry.price} / 所持 ${currentWallet.coins}）`,
      );
      return;
    }

    const nextWallet = {
      coins: currentWallet.coins - selectedCatalogEntry.price,
      ownedObjectTypes: [...currentWallet.ownedObjectTypes, targetObjectType],
    };

    saveVoiceZooWallet(nextWallet);
    setOwnedCatalogObjectTypes(nextWallet.ownedObjectTypes);
    openRecordingModalForEntry(
      selectedCatalogEntry,
      `${selectedCatalogEntry.name}を購入しました。3秒録音を開始してください。`,
    );
  };

  const handleRerecordFromCatalog = () => {
    if (!selectedCatalogEntry) {
      return;
    }

    openRecordingModalForEntry(
      selectedCatalogEntry,
      `${selectedCatalogEntry.name}の録音を更新できます。3秒録音を開始してください。`,
    );
  };

  const handleResetWalletForTesting = () => {
    saveVoiceZooWallet(createInitialVoiceZooWallet());
    window.localStorage.removeItem("kazenagare_objects_me");
    setOwnedCatalogObjectTypes([]);
    setCatalogActionNotice(null);
    setTestingNotice(
      `テスト用に購入状態を初期化しました（所持コイン: ${INITIAL_VOICE_ZOO_COINS}）。`,
    );
  };

  const handleAddTestCoins = (coinsToAdd: number) => {
    const currentWallet = parseVoiceZooWallet(
      window.localStorage.getItem(VOICE_ZOO_WALLET_STORAGE_KEY),
    );
    const nextWallet = {
      ...currentWallet,
      coins: currentWallet.coins + coinsToAdd,
    };

    saveVoiceZooWallet(nextWallet);
    setOwnedCatalogObjectTypes(nextWallet.ownedObjectTypes);
    setTestingNotice(`テスト用に ${coinsToAdd} コインを追加しました。`);
  };

  const handleClearSavedRecordingForTesting = async () => {
    try {
      const supabase = getSupabaseClient();
      let ownerId = "local_guest";

      if (supabase) {
        const { data } = await supabase.auth.getSession();
        ownerId = data.session?.user?.id || "local_guest";
      }

      const catalogStorageKey = getVoiceZooRecordingCatalogStorageKey(ownerId);
      const catalog = parseVoiceZooRecordingCatalog(
        window.localStorage.getItem(catalogStorageKey),
      );

      await Promise.all([
        ...catalog.map((recording) =>
          del(getVoiceZooRecordingBlobStorageKey(ownerId, recording.id)),
        ),
        ...VOICE_ZOO_SUPPORTED_OBJECT_TYPES.map((objectType) =>
          del(getVoiceZooLegacyRecordingStorageKey(ownerId, objectType)),
        ),
      ]);

      window.localStorage.removeItem(catalogStorageKey);
      for (const url of Object.values(recordingPreviewAudioUrlsRef.current)) {
        if (url) {
          URL.revokeObjectURL(url);
        }
      }
      setRecordingPreviewAudioUrls({});
      window.dispatchEvent(
        new CustomEvent(VOICE_ZOO_RECORDING_UPDATED_EVENT, {
          detail: { ownerId },
        }),
      );
      setTestingNotice("テスト用に録音データを削除しました。");
    } catch {
      setTestingNotice("録音データの削除に失敗しました。もう一度お試しください。");
    }
  };

  return (
    <>
      {isOpen || isCatalogOpen ? (
        <button
          type="button"
          aria-label="モーダルを閉じる"
          onClick={closeAllPanels}
          className="fixed inset-0 z-[60] bg-wa-black/35 backdrop-blur-[1px]"
        />
      ) : null}

      <div className="pointer-events-none absolute right-4 top-4 z-[70]">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            aria-controls={catalogPanelId}
            aria-label={catalogLabel}
            title={catalogLabel}
            className={`pointer-events-auto ${iconButtonClass}`}
            onClick={() => {
              if (typeof window !== "undefined") {
                const storedWallet = parseVoiceZooWallet(
                  window.localStorage.getItem(VOICE_ZOO_WALLET_STORAGE_KEY),
                );
                setOwnedCatalogObjectTypes(storedWallet.ownedObjectTypes);
              }

              setCatalogActionNotice(null);
              setTestingNotice(null);
              setIsCatalogOpen((value) => !value);
              setIsOpen(false);
            }}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3.75 6.75A2.75 2.75 0 0 1 6.5 4h4.25a2.75 2.75 0 0 1 2.75 2.75V20a2.25 2.25 0 0 0-2.25-2.25H6.5A2.75 2.75 0 0 0 3.75 20Z" />
              <path d="M20.25 6.75A2.75 2.75 0 0 0 17.5 4h-4.25a2.75 2.75 0 0 0-2.75 2.75V20a2.25 2.25 0 0 1 2.25-2.25h4.75A2.75 2.75 0 0 1 20.25 20Z" />
            </svg>
            <span className="sr-only">{catalogLabel}</span>
          </button>

          <button
            type="button"
            aria-controls={panelId}
            aria-label={buttonLabel}
            title={buttonLabel}
            onClick={() => {
              if (!isOpen) {
                setAudioSettings(loadKazenagareAudioSettings());
              }

              setIsOpen((value) => !value);
              setIsCatalogOpen(false);
            }}
            className={`pointer-events-auto ${iconButtonClass}`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-1.98 1.69l-.13.91a2 2 0 0 1-2.19 1.67l-.92-.08a2 2 0 0 0-2.12 1.2l-.2.4a2 2 0 0 0 .46 2.31l.68.68a2 2 0 0 1 0 2.83l-.68.68a2 2 0 0 0-.45 2.31l.2.4a2 2 0 0 0 2.11 1.2l.92-.08a2 2 0 0 1 2.2 1.68l.12.9a2 2 0 0 0 1.98 1.7h.44a2 2 0 0 0 1.98-1.69l.13-.91a2 2 0 0 1 2.19-1.67l.92.08a2 2 0 0 0 2.12-1.2l.2-.4a2 2 0 0 0-.46-2.31l-.68-.68a2 2 0 0 1 0-2.83l.68-.68a2 2 0 0 0 .45-2.31l-.2-.4a2 2 0 0 0-2.11-1.2l-.92.08a2 2 0 0 1-2.2-1.68l-.12-.9A2 2 0 0 0 12.22 2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="sr-only">{buttonLabel}</span>
          </button>
        </div>

        <div id={panelId} className={`mt-2 w-[min(88vw,22rem)] ${panelClass}`}>
          <p className="text-sm font-semibold">{title}</p>

          <div
            className={`grid gap-2 rounded-xl border p-3 ${
              darkMode
                ? "border-wa-white/20 bg-wa-white/8"
                : "border-wa-black/15 bg-wa-white/90"
            }`}
          >
            <p className="text-xs font-semibold">サウンド設定</p>

            <label className="grid gap-1">
              <div className="flex items-center justify-between text-xs">
                <span>BGM音量</span>
                <span>{Math.round(audioSettings.bgmVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(audioSettings.bgmVolume * 100)}
                onChange={(event) => updateAudioSetting("bgmVolume", event.target.value)}
              />
            </label>

            <label className="grid gap-1">
              <div className="flex items-center justify-between text-xs">
                <span>キャラ音声音量</span>
                <span>{Math.round(audioSettings.characterVoiceVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(audioSettings.characterVoiceVolume * 100)}
                onChange={(event) =>
                  updateAudioSetting("characterVoiceVolume", event.target.value)
                }
              />
            </label>
          </div>

          <details
            className={`rounded-xl border p-3 text-xs ${
              darkMode
                ? "border-wa-white/20 bg-wa-white/8 text-wa-white/85"
                : "border-wa-black/15 bg-wa-white/90 text-wa-black/80"
            }`}
          >
            <summary className="cursor-pointer select-none font-semibold">ヘルプ</summary>
            <div className="mt-2 grid gap-1.5 leading-relaxed">
              <p>移動: PC は WASD/矢印キー、スマホは右下スティックで操作できます。</p>
              <p>配置: 図鑑で選択後に庭をタップすると配置、配置済みオブジェクトはタップで移動できます。</p>
              <p>リセット: 左上の「開始地点に戻る」で位置を初期化できます。</p>
            </div>
          </details>

          <div className="grid gap-2">
            {actions.map((action) => (
              <Link
                key={`${action.href}-${action.label}`}
                href={action.href}
                onClick={() => setIsOpen(false)}
                className={itemClass}
              >
                <span className="text-sm font-semibold">{action.label}</span>
                {action.description ? (
                  <span className={descriptionClass}>{action.description}</span>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      </div>

            {isCatalogOpen ? (
        <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto p-2 sm:p-6">
          <section
            id={catalogPanelId}
            role="dialog"
            aria-modal="true"
            aria-label="図鑑"
            className={`pointer-events-auto relative mx-auto min-w-[46rem] w-[max(46rem,calc(100vw-1.5rem))] max-w-5xl overflow-hidden rounded-3xl border shadow-[0_34px_90px_rgba(0,0,0,0.45)] [transform-style:preserve-3d] animate-[kazenagare-catalog-burst_220ms_cubic-bezier(0.2,1,0.36,1)] sm:min-w-0 sm:w-full ${
              darkMode
                ? "border-wa-white/35 bg-[linear-gradient(160deg,rgba(23,23,23,0.98)_0%,rgba(35,35,35,0.95)_52%,rgba(15,15,15,0.98)_100%)] text-wa-white"
                : "border-wa-black/25 bg-[linear-gradient(160deg,rgba(255,250,242,0.99)_0%,rgba(248,236,220,0.96)_54%,rgba(255,249,240,0.99)_100%)] text-wa-black"
            }`}
          >
            <div className="grid gap-4 p-3 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-wa-black/10 pb-3 dark:border-wa-white/15">
                <div>
                  <p className={`text-xs ${darkMode ? "text-wa-white/75" : "text-wa-black/65"}`}>
                    KAZENAGARE Collection
                  </p>
                  <h2 className="text-xl font-semibold leading-none sm:text-2xl">和の音オブジェクト図鑑</h2>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCatalogOpen(false)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98] sm:px-4 sm:py-2 sm:text-sm ${
                    darkMode
                      ? "border-wa-white/35 bg-wa-black/40 hover:bg-wa-black/60"
                      : "border-wa-black/30 bg-wa-white/80 hover:bg-wa-white"
                  }`}
                >
                  閉じる
                </button>
              </div>

              {selectedCatalogEntry ? (
                <div
                  className={`relative grid overflow-hidden rounded-2xl border grid-cols-2 ${
                    darkMode
                      ? "border-wa-white/20 bg-wa-black/15"
                      : "border-wa-black/15 bg-white/55"
                  }`}
                >
                  <div
                    className={`grid gap-3 border-r p-3 [transform-origin:right_center] [transform-style:preserve-3d] animate-[kazenagare-catalog-left-open_360ms_cubic-bezier(0.18,1,0.32,1)] sm:gap-4 sm:p-4 ${
                      darkMode
                        ? "border-wa-white/20 bg-[linear-gradient(120deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_100%)]"
                        : "border-wa-black/15 bg-[linear-gradient(120deg,rgba(255,255,255,0.88)_0%,rgba(255,255,255,0.62)_100%)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-xs ${darkMode ? "text-wa-white/75" : "text-wa-black/65"}`}>
                          1回の再生報酬
                        </p>
                        <p className="mt-1 flex items-end gap-2 leading-none">
                          <span className="text-3xl font-bold sm:text-4xl">{selectedEntryPlaybackReward}</span>
                          <span className={`pb-1 text-xs sm:text-sm ${darkMode ? "text-wa-white/70" : "text-wa-black/65"}`}>
                            coins
                          </span>
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:px-3 sm:py-1 sm:text-xs ${catalogStatusClass(selectedCatalogEntry.status, darkMode)}`}
                      >
                        {catalogStatusLabel(selectedCatalogEntry.status)}
                      </span>
                    </div>

                    <div
                      className={`grid min-h-[156px] place-items-center rounded-2xl border sm:min-h-[220px] ${
                        darkMode
                          ? "border-wa-white/20 bg-wa-black/35"
                          : "border-wa-black/15 bg-white/80"
                      }`}
                    >
                      <div className="grid place-items-center gap-2 text-center">
                        <div
                          className={`grid h-20 w-20 place-items-center rounded-full border text-5xl sm:h-28 sm:w-28 sm:text-6xl ${
                            darkMode
                              ? "border-wa-white/35 bg-wa-black/55"
                              : "border-wa-black/20 bg-white"
                          }`}
                        >
                          <span aria-hidden>{selectedCatalogEntry.icon}</span>
                        </div>
                        <p className="text-base font-semibold leading-none sm:text-lg">{selectedCatalogEntry.name}</p>
                        <p className={`text-xs ${darkMode ? "text-wa-white/75" : "text-wa-black/65"}`}>
                          {selectedCatalogEntry.ruby}
                        </p>
                      </div>
                    </div>

                    {isSelectedCatalogObjectOwned ? (
                      <button
                        type="button"
                        onClick={handleRerecordFromCatalog}
                        className={`mt-auto inline-flex items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98] sm:px-4 sm:py-3 sm:text-sm ${
                          darkMode
                            ? "border-wa-white/40 bg-wa-white/10 hover:bg-wa-white/20"
                            : "border-wa-black/25 bg-wa-red/10 hover:bg-wa-red/20"
                        }`}
                      >
                        再録音（1コインかかる）
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handlePurchaseAndPlaceFromCatalog}
                        className={`mt-auto inline-flex items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98] sm:px-4 sm:py-3 sm:text-sm ${
                          darkMode
                            ? "border-wa-gold/55 bg-wa-gold/20 text-wa-white hover:bg-wa-gold/30"
                            : "border-wa-gold/50 bg-wa-gold/20 text-wa-black hover:bg-wa-gold/30"
                        }`}
                      >
                        {`購入する（${selectedCatalogEntry.price}コイン）`}
                      </button>
                    )}

                    {catalogActionNotice ? (
                      <p
                        className={`rounded-lg border px-3 py-2 text-xs ${
                          darkMode
                            ? "border-wa-white/25 bg-wa-black/35 text-wa-white/85"
                            : "border-wa-black/20 bg-white/80 text-wa-black/80"
                        }`}
                      >
                        {catalogActionNotice}
                      </p>
                    ) : null}
                  </div>

                  <div
                    className={`grid content-start gap-3 p-3 [transform-origin:left_center] [transform-style:preserve-3d] animate-[kazenagare-catalog-right-open_360ms_cubic-bezier(0.18,1,0.32,1)] sm:gap-4 sm:p-4 ${
                      darkMode
                        ? "bg-[linear-gradient(240deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.01)_100%)]"
                        : "bg-[linear-gradient(240deg,rgba(255,255,255,0.84)_0%,rgba(255,255,255,0.58)_100%)]"
                    }`}
                  >
                    <div>
                      <p className={`text-xs ${darkMode ? "text-wa-white/75" : "text-wa-black/65"}`}>
                        オブジェクト
                      </p>
                      <p className="text-xs font-semibold sm:text-sm">サムネイルを押して左ページを切り替え</p>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2">
                      {catalogSlots.map((entry, index) => {
                        if (!entry) {
                          return (
                            <div
                              key={`catalog-slot-empty-${index}`}
                              className={`grid min-h-20 place-items-center rounded-xl border text-center text-[10px] sm:min-h-24 sm:text-xs ${
                                darkMode
                                  ? "border-wa-white/20 bg-wa-white/5 text-wa-white/60"
                                  : "border-wa-black/15 bg-white/70 text-wa-black/60"
                              }`}
                            >
                              準備中
                            </div>
                          );
                        }

                        const isSelected = entry.objectType === selectedCatalogEntry.objectType;

                        return (
                          <button
                            key={entry.objectType}
                            type="button"
                            onClick={() => {
                              setSelectedCatalogObjectType(entry.objectType);
                              setCatalogActionNotice(null);
                            }}
                            className={`grid min-h-20 place-items-center gap-0.5 rounded-xl border px-2 py-2 text-center transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98] sm:min-h-24 sm:gap-1 ${
                              isSelected
                                ? darkMode
                                  ? "border-wa-gold/65 bg-wa-gold/20"
                                  : "border-wa-red/45 bg-wa-red/12"
                                : darkMode
                                  ? "border-wa-white/20 bg-wa-white/5 hover:bg-wa-white/10"
                                  : "border-wa-black/15 bg-white/70 hover:bg-wa-red/8"
                            }`}
                          >
                            <span className="text-xl sm:text-2xl" aria-hidden>
                              {entry.icon}
                            </span>
                            <span className="text-[10px] font-semibold leading-tight sm:text-[11px]">{entry.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div
                      className={`rounded-xl border p-2.5 text-xs leading-relaxed sm:p-3 sm:text-sm ${
                        darkMode
                          ? "border-wa-white/20 bg-wa-black/35 text-wa-white/85"
                          : "border-wa-black/15 bg-white/80 text-wa-black/80"
                      }`}
                    >
                      {selectedCatalogEntry.soundDesign}
                    </div>

                    <details
                      className={`rounded-xl border p-2.5 text-[11px] sm:p-3 sm:text-xs ${
                        darkMode
                          ? "border-wa-white/20 bg-wa-black/35 text-wa-white/85"
                          : "border-wa-black/15 bg-white/80 text-wa-black/80"
                      }`}
                    >
                      <summary className="cursor-pointer select-none font-semibold">
                        テスト用ツール
                      </summary>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleResetWalletForTesting}
                          className={`rounded-md border px-3 py-2 transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98] ${
                            darkMode
                              ? "border-wa-white/35 bg-wa-black/30 hover:bg-wa-black/45"
                              : "border-wa-black/25 bg-white/90 hover:bg-wa-black/5"
                          }`}
                        >
                          購入状態をリセット
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAddTestCoins(500)}
                          className={`rounded-md border px-3 py-2 transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98] ${
                            darkMode
                              ? "border-wa-white/35 bg-wa-black/30 hover:bg-wa-black/45"
                              : "border-wa-black/25 bg-white/90 hover:bg-wa-black/5"
                          }`}
                        >
                          +500 コイン
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            void handleClearSavedRecordingForTesting();
                          }}
                          className={`rounded-md border px-3 py-2 transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98] ${
                            darkMode
                              ? "border-wa-white/35 bg-wa-black/30 hover:bg-wa-black/45"
                              : "border-wa-black/25 bg-white/90 hover:bg-wa-black/5"
                          }`}
                        >
                          録音データを削除
                        </button>
                      </div>

                      {testingNotice ? (
                        <p
                          className={`mt-2 rounded-md border px-3 py-2 ${
                            darkMode
                              ? "border-wa-white/25 bg-wa-black/30"
                              : "border-wa-black/20 bg-wa-white"
                          }`}
                        >
                          {testingNotice}
                        </p>
                      ) : null}
                    </details>
                  </div>

                  <div
                    className={`pointer-events-none absolute inset-y-0 left-1/2 w-px ${
                      darkMode ? "bg-wa-white/18" : "bg-wa-black/15"
                    }`}
                  />
                </div>
              ) : null}

              <p className={`text-[11px] sm:hidden ${darkMode ? "text-wa-white/70" : "text-wa-black/65"}`}>
                横にスワイプすると見開き全体を確認できます。
              </p>
            </div>
          </section>
        </div>
      ) : null}

      {recordingEntry ? (
        <div className="fixed inset-0 z-[90] isolate grid place-items-center p-4 sm:p-6">
          <button
            type="button"
            aria-label="録音モーダルを閉じる"
            className="absolute inset-0 bg-wa-black/85 backdrop-blur-md"
            onClick={isRecording ? undefined : closeRecordingModal}
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalog-recording-title"
            className={`relative z-10 grid w-full max-w-xl gap-4 rounded-2xl border p-5 shadow-[0_40px_110px_rgba(0,0,0,0.55)] ${
              darkMode
                ? "border-wa-white/35 bg-[#111111] text-wa-white"
                : "border-wa-black/35 bg-[#fffdf9] text-wa-black"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`grid h-12 w-12 place-items-center rounded-full border text-2xl ${
                  darkMode
                    ? "border-wa-white/25 bg-[#1a1a1a]"
                    : "border-wa-black/20 bg-[#ffffff]"
                }`}
              >
                <span aria-hidden>{recordingEntry.icon}</span>
              </div>
              <div>
                <h2 id="catalog-recording-title" className="text-xl font-semibold">
                  {recordingEntry.name}の録音を作成
                </h2>
                <p className={`mt-1 text-sm ${darkMode ? "text-wa-white/75" : "text-wa-black/70"}`}>
                  録音時間は約3秒です。録音後、配置に進めます。
                </p>
              </div>
            </div>

            <div
              className={`grid gap-2 rounded-xl border p-4 ${
                darkMode
                  ? "border-wa-white/25 bg-[#1a1a1a]"
                  : "border-wa-black/15 bg-[#f8f4ed]"
              }`}
            >
              <p className={`text-xs ${darkMode ? "text-wa-white/70" : "text-wa-black/65"}`}>
                録音カウントダウン
              </p>
              <p className="text-4xl font-bold leading-none">
                {isRecording ? `${recordingCountdown}s` : `${RECORDING_DURATION_SECONDS}s`}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void startThreeSecondRecording();
                }}
                disabled={isRecording}
                className={`rounded-md border px-4 py-2 text-sm font-semibold transition-all duration-150 ease-out ${
                  isRecording
                    ? darkMode
                      ? "cursor-not-allowed border-wa-white/20 bg-wa-white/10 text-wa-white/45"
                      : "cursor-not-allowed border-wa-black/20 bg-wa-black/10 text-wa-black/50"
                    : darkMode
                      ? "border-wa-red/35 bg-wa-red/20 hover:-translate-y-0.5 hover:bg-wa-red/30 active:translate-y-[1px] active:scale-[0.98]"
                      : "border-wa-red/35 bg-wa-red/10 hover:-translate-y-0.5 hover:bg-wa-red/20 active:translate-y-[1px] active:scale-[0.98]"
                }`}
              >
                {isRecording ? "録音中..." : "3秒録音を開始"}
              </button>

              {canPlaceFromRecordingModal ? (
                <button
                  type="button"
                  onClick={handlePlacementFromRecordingModal}
                  className={`rounded-md border px-4 py-2 text-sm font-semibold transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98] ${
                    darkMode
                      ? "border-wa-white/45 bg-wa-white/10 hover:bg-wa-white/20"
                      : "border-wa-black/45 bg-wa-red/10 hover:bg-wa-red/20"
                  }`}
                >
                  録音し終わって配置する
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className={`cursor-not-allowed rounded-md border px-4 py-2 text-sm font-semibold ${
                    darkMode
                      ? "border-wa-white/20 bg-wa-white/10 text-wa-white/45"
                      : "border-wa-black/20 bg-wa-black/10 text-wa-black/50"
                  }`}
                >
                  録音し終わって配置する
                </button>
              )}

              <button
                type="button"
                onClick={closeRecordingModal}
                disabled={isRecording}
                className={`rounded-md border px-4 py-2 text-sm transition-all duration-150 ease-out ${
                  isRecording
                    ? darkMode
                      ? "cursor-not-allowed border-wa-white/20 bg-wa-white/10 text-wa-white/45"
                      : "cursor-not-allowed border-wa-black/20 bg-wa-black/10 text-wa-black/50"
                    : darkMode
                      ? "border-wa-white/40 hover:-translate-y-0.5 hover:bg-wa-white/10 active:translate-y-[1px] active:scale-[0.98]"
                      : "border-wa-black/40 hover:-translate-y-0.5 hover:bg-wa-black/5 active:translate-y-[1px] active:scale-[0.98]"
                }`}
              >
                閉じる
              </button>
            </div>

            {recordingEntryAudioUrl ? (
              <audio
                ref={recordingPreviewAudioRef}
                controls
                src={recordingEntryAudioUrl}
                onPlay={handleRecordingPreviewPlay}
                className="w-full"
              />
            ) : null}

            {recordingNotice ? (
              <p
                className={`rounded-lg border px-3 py-2 text-xs ${
                  darkMode
                    ? "border-wa-white/20 bg-[#171717] text-wa-white/90"
                    : "border-wa-black/20 bg-wa-white text-wa-black"
                }`}
              >
                {recordingNotice}
              </p>
            ) : null}

            {!recordingEntryAudioUrl ? (
              <p
                className={`rounded-lg border px-3 py-2 text-xs ${
                  darkMode
                    ? "border-wa-gold/40 bg-[#2b2412] text-wa-white"
                    : "border-wa-gold/35 bg-wa-gold/10 text-wa-black"
                }`}
              >
                配置するには先に3秒録音を完了してください。
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
