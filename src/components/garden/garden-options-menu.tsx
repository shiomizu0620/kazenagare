"use client";

import { del, set } from "idb-keyval";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  DEFAULT_KAZENAGARE_AUDIO_SETTINGS,
  type KazenagareAudioSettings,
  loadKazenagareAudioSettings,
  saveKazenagareAudioSettings,
} from "@/lib/audio/settings";
import {
  KAZENAGARE_AUDIO_SUPPRESSION_EVENT,
  type KazenagareAudioSuppressionDetail,
} from "@/lib/audio/suppression";
import {
  GARDEN_OBJECTS_STORAGE_KEY_ME,
  resetGardenPlacedObjects,
} from "@/lib/garden/placed-objects-storage";
import { getSupabaseClient, getSupabaseSessionOrNull } from "@/lib/supabase/client";
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
  getVoiceZooWalletStorageKey,
  INITIAL_VOICE_ZOO_COINS,
  loadVoiceZooWallet,
  parseVoiceZooWallet,
  saveVoiceZooWallet,
} from "@/lib/voice-zoo/wallet";
import type { ObjectType } from "@/types/garden";

const RECORDING_DURATION_SECONDS = 3;
type RecordingModalMode = "purchase" | "rerecord";
type RecordingModalCloseReason = "user" | "placement" | "force";

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
  showCatalogButton?: boolean;
  currentGardenName?: string;
  useViewerGardenTitle?: boolean;
  disableModals?: boolean;
};

function resolveViewerDisplayName(sessionUser: {
  id?: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
} | null | undefined) {
  if (!sessionUser) {
    return "あなた";
  }

  const metadata = sessionUser.user_metadata;
  const displayName = metadata?.display_name;
  if (typeof displayName === "string" && displayName.trim()) {
    return displayName.trim();
  }

  const name = metadata?.name;
  if (typeof name === "string" && name.trim()) {
    return name.trim();
  }

  if (typeof sessionUser.email === "string" && sessionUser.email.includes("@")) {
    const localPart = sessionUser.email.split("@")[0]?.trim();
    if (localPart) {
      return localPart;
    }
  }

  return "あなた";
}

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
  showCatalogButton = true,
  currentGardenName,
  useViewerGardenTitle = false,
  disableModals = false,
}: GardenOptionsMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [catalogActionNotice, setCatalogActionNotice] = useState<string | null>(null);
  const [testingNotice, setTestingNotice] = useState<string | null>(null);
  const [ownedCatalogObjectTypes, setOwnedCatalogObjectTypes] = useState<ObjectType[]>([]);
  const [audioOwnerId, setAudioOwnerId] = useState<string>("local_guest");
  const [viewerDisplayName, setViewerDisplayName] = useState<string>("あなた");
  const [recordingEntry, setRecordingEntry] = useState<VoiceZooEntry | null>(null);
  const [recordingModalMode, setRecordingModalMode] = useState<RecordingModalMode | null>(null);
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

  const iconButtonClass = `grid h-11 w-11 place-items-center rounded-full border shadow-[0_12px_28px_rgba(0,0,0,0.24)] backdrop-blur-[2px] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(0,0,0,0.3)] active:translate-y-[1px] active:scale-[0.98] ${
    darkMode
      ? "border-[#e6d2b3]/40 bg-[radial-gradient(circle_at_32%_25%,rgba(255,255,255,0.2)_0%,rgba(255,255,255,0.1)_44%,rgba(30,24,18,0.88)_100%)] text-white hover:border-[#f3dcbb]/55"
      : "border-[#b78c58]/55 bg-[radial-gradient(circle_at_32%_25%,rgba(255,255,255,0.98)_0%,rgba(248,236,216,0.94)_58%,rgba(227,203,170,0.92)_100%)] text-[#33261b] hover:border-[#936438]/70"
  }`;

  const panelClass = `kazenagare-options-panel relative isolate grid max-h-[min(78vh,34rem)] gap-3 overflow-y-auto rounded-2xl border p-3.5 shadow-[0_36px_70px_rgba(0,0,0,0.35)] transition-all duration-200 ${
    isOpen
      ? "pointer-events-auto translate-y-0 opacity-100 animate-[kazenagare-options-panel-reveal_280ms_cubic-bezier(0.18,1,0.32,1)]"
      : "pointer-events-none -translate-y-1 opacity-0"
  } ${
    darkMode
      ? "kazenagare-options-panel-dark border-[#e2cfb2]/35 text-wa-white"
      : "border-[#c79e6b]/45 text-[#2f2319]"
  }`;

  const itemClass = `kazenagare-options-item grid gap-1 rounded-xl border px-3 py-2 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98] ${
    darkMode
      ? "border-[#e8d4b7]/25 bg-[#f5ebd9]/[0.07] text-wa-white hover:border-[#f2dcb9]/45 hover:bg-[#f2dcb9]/12"
      : "border-[#bc935f]/35 bg-[#fff9ee]/95 text-[#312419] hover:border-[#95663a]/60 hover:bg-[#f6e2c3]"
  }`;

  const descriptionClass = `text-xs ${darkMode ? "text-wa-white/75" : "text-[#5b4533]/80"}`;

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
  const canCloseRecordingModal = !isRecording && recordingModalMode !== "purchase";
  const catalogSlots = VOICE_ZOO_ENTRIES;

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

    const currentSession = await getSupabaseSessionOrNull(supabase);
    const resolvedOwnerId = currentSession?.user?.id || "local_guest";

    if (resolvedOwnerId !== audioOwnerId) {
      setAudioOwnerId(resolvedOwnerId);
    }

    return resolvedOwnerId;
  }, [audioOwnerId]);

  const closeRecordingModal = useCallback((reason: RecordingModalCloseReason = "user") => {
    if (reason === "user" && recordingModalMode === "purchase") {
      return;
    }

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
    setRecordingModalMode(null);
  }, [clearRecordingTimers, recordingModalMode, stopRecordingStream]);

  const openRecordingModalForEntry = useCallback(
    (entry: VoiceZooEntry, noticeMessage: string, mode: RecordingModalMode) => {
      setCatalogActionNotice(null);
      setRecordingEntry(entry);
      setRecordingModalMode(mode);
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
    if (!recordingEntry) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set("place", recordingEntry.objectType);
    const nextSearch = nextSearchParams.toString();
    const nextHref = nextSearch.length > 0 ? `${pathname}?${nextSearch}` : pathname;

    closeRecordingModal("placement");
    setIsCatalogOpen(false);
    setIsOpen(false);
    router.replace(nextHref, { scroll: false });
  }, [closeRecordingModal, pathname, recordingEntry, router, searchParams]);

  useEffect(() => {
    recordingPreviewAudioUrlsRef.current = recordingPreviewAudioUrls;
  }, [recordingPreviewAudioUrls]);

  useEffect(() => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      return;
    }

    void getSupabaseSessionOrNull(supabase).then((session) => {
      setAudioOwnerId(session?.user?.id || "local_guest");
      setViewerDisplayName(resolveViewerDisplayName(session?.user));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAudioOwnerId(session?.user?.id || "local_guest");
      setViewerDisplayName(resolveViewerDisplayName(session?.user));
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

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent<KazenagareAudioSuppressionDetail>(
        KAZENAGARE_AUDIO_SUPPRESSION_EVENT,
        {
          detail: {
            isSuppressed: isCatalogOpen,
            reason: "catalog",
          },
        },
      ),
    );
  }, [isCatalogOpen]);

  useEffect(() => {
    return () => {
      window.dispatchEvent(
        new CustomEvent<KazenagareAudioSuppressionDetail>(
          KAZENAGARE_AUDIO_SUPPRESSION_EVENT,
          {
            detail: {
              isSuppressed: false,
              reason: "catalog",
            },
          },
        ),
      );
    };
  }, []);

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

  const resolvedPanelTitle =
    useViewerGardenTitle && currentGardenName
      ? `${viewerDisplayName} -> ${currentGardenName}`
      : title;

  const handlePurchaseAndPlaceFromCatalog = () => {
    if (!selectedCatalogEntry || typeof window === "undefined") {
      return;
    }

    const targetObjectType = selectedCatalogEntry.objectType;
    const currentWallet = loadVoiceZooWallet(audioOwnerId);

    if (currentWallet.ownedObjectTypes.includes(targetObjectType)) {
      setOwnedCatalogObjectTypes(currentWallet.ownedObjectTypes);
      openRecordingModalForEntry(
        selectedCatalogEntry,
        `${selectedCatalogEntry.name}は購入済みです。3秒録音を開始してください。`,
        "rerecord",
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

    saveVoiceZooWallet(nextWallet, audioOwnerId);
    setOwnedCatalogObjectTypes(nextWallet.ownedObjectTypes);
    openRecordingModalForEntry(
      selectedCatalogEntry,
      `${selectedCatalogEntry.name}を購入しました。3秒録音を開始してください。`,
      "purchase",
    );
  };

  const handleRerecordFromCatalog = () => {
    if (!selectedCatalogEntry) {
      return;
    }

    openRecordingModalForEntry(
      selectedCatalogEntry,
      `${selectedCatalogEntry.name}の録音を更新できます。3秒録音を開始してください。`,
      "rerecord",
    );
  };

  const clearPlacementQueryIfNeeded = useCallback(() => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());

    if (!nextSearchParams.has("place")) {
      return;
    }

    nextSearchParams.delete("place");
    const nextSearch = nextSearchParams.toString();
    const nextHref = nextSearch.length > 0 ? `${pathname}?${nextSearch}` : pathname;
    router.replace(nextHref, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleResetWalletForTesting = () => {
    const resolvedObjectStorageKey = `${GARDEN_OBJECTS_STORAGE_KEY_ME}_${audioOwnerId}`;

    saveVoiceZooWallet(createInitialVoiceZooWallet(), audioOwnerId);
    saveVoiceZooWallet(createInitialVoiceZooWallet());
    resetGardenPlacedObjects(resolvedObjectStorageKey);
    resetGardenPlacedObjects(GARDEN_OBJECTS_STORAGE_KEY_ME);
    clearPlacementQueryIfNeeded();
    setOwnedCatalogObjectTypes([]);
    setCatalogActionNotice(null);
    setTestingNotice(
      `テスト用に購入状態を初期化しました（所持コイン: ${INITIAL_VOICE_ZOO_COINS}）。`,
    );
  };

  const handleAddTestCoins = (coinsToAdd: number) => {
    const currentWallet = loadVoiceZooWallet(audioOwnerId);
    const nextWallet = {
      ...currentWallet,
      coins: currentWallet.coins + coinsToAdd,
    };

    saveVoiceZooWallet(nextWallet, audioOwnerId);
    setOwnedCatalogObjectTypes(nextWallet.ownedObjectTypes);
    setTestingNotice(`テスト用に ${coinsToAdd} コインを追加しました。`);
  };

  const handleClearSavedRecordingForTesting = async () => {
    try {
      const supabase = getSupabaseClient();
      let ownerId = "local_guest";

      if (supabase) {
        const currentSession = await getSupabaseSessionOrNull(supabase);
        ownerId = currentSession?.user?.id || "local_guest";
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
          className={`fixed inset-0 z-[60] backdrop-blur-[2px] ${
            darkMode
              ? "bg-[radial-gradient(circle_at_85%_10%,rgba(154,130,93,0.18)_0%,rgba(0,0,0,0.74)_62%)]"
              : "bg-[radial-gradient(circle_at_85%_10%,rgba(180,133,76,0.2)_0%,rgba(31,24,19,0.45)_68%)]"
          }`}
        />
      ) : null}

      <div className="pointer-events-none absolute right-4 top-4 z-[140]">
        <div className="flex items-center justify-end gap-2">
          {showCatalogButton ? (
            <button
              type="button"
              aria-controls={catalogPanelId}
              aria-label={catalogLabel}
              title={catalogLabel}
              disabled={disableModals}
              className={`pointer-events-auto ${iconButtonClass}`}
              onClick={(e) => {
                e.stopPropagation();
                if (typeof window !== "undefined") {
                  const storedWallet = parseVoiceZooWallet(
                    window.localStorage.getItem(getVoiceZooWalletStorageKey(audioOwnerId)),
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
          ) : null}

          <button
            type="button"
            aria-controls={panelId}
            aria-label={buttonLabel}
            title={buttonLabel}
            disabled={disableModals}
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

        <div id={panelId} className={`mt-2 w-[min(90vw,23.5rem)] ${panelClass}`}>
          <div className="grid gap-1">
            <p className={`text-[10px] uppercase tracking-[0.24em] ${darkMode ? "text-wa-white/55" : "text-[#78583b]/70"}`}>
              庭のしつらえ
            </p>
            <p className="font-serif text-base font-semibold tracking-[0.08em]">
              {resolvedPanelTitle}
            </p>
          </div>

          <div
            className={`grid gap-2 rounded-xl border p-3 ${
              darkMode
                ? "border-[#e2cfb2]/30 bg-[linear-gradient(148deg,rgba(24,23,20,0.9)_0%,rgba(58,49,35,0.72)_100%)]"
                : "border-[#caa16e]/45 bg-[linear-gradient(148deg,rgba(255,252,246,0.98)_0%,rgba(248,234,207,0.94)_100%)]"
            }`}
          >
            <p className="text-xs font-semibold tracking-[0.08em]">サウンド設定</p>

            <label className="grid gap-1">
              <div className="flex items-center justify-between text-xs">
                <span>背景音量</span>
                <span>{Math.round(audioSettings.bgmVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(audioSettings.bgmVolume * 100)}
                onChange={(event) => updateAudioSetting("bgmVolume", event.target.value)}
                className={darkMode ? "accent-[#ddb985]" : "accent-[#b77a37]"}
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
                className={darkMode ? "accent-[#ddb985]" : "accent-[#b77a37]"}
              />
            </label>
          </div>

          <div className="grid gap-2">
            {actions.map((action) => {
              if (action.label === "トップへ戻る") {
                return (
                  <button
                    key={`${action.href}-${action.label}`}
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      if (typeof window !== "undefined") {
                        window.location.replace(action.href);
                      }
                    }}
                    className={itemClass}
                  >
                    <span className="text-sm font-semibold">{action.label}</span>
                    {action.description ? (
                      <span className={descriptionClass}>{action.description}</span>
                    ) : null}
                  </button>
                );
              }
              return (
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
              );
            })}
          </div>
        </div>
      </div>

      {isCatalogOpen ? (
        <div className="fixed inset-0 z-[130] overflow-y-auto p-3 md:grid md:place-items-center md:p-6">
          <section
            id={catalogPanelId}
            role="dialog"
            aria-modal="true"
            aria-label="図鑑"
            className={`pointer-events-auto relative mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border shadow-[0_34px_90px_rgba(0,0,0,0.45)] [transform-style:preserve-3d] animate-[kazenagare-catalog-burst_220ms_cubic-bezier(0.2,1,0.36,1)] md:min-w-[46rem] ${
              darkMode
                ? "border-wa-white/35 bg-[linear-gradient(160deg,rgba(23,23,23,0.98)_0%,rgba(35,35,35,0.95)_52%,rgba(15,15,15,0.98)_100%)] text-wa-white"
                : "border-wa-black/25 bg-[linear-gradient(160deg,rgba(255,250,242,0.99)_0%,rgba(248,236,220,0.96)_54%,rgba(255,249,240,0.99)_100%)] text-wa-black"
            }`}
          >
            <div className="grid gap-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-wa-black/10 pb-3 dark:border-wa-white/15">
                <div>
                  <p className={`text-xs ${darkMode ? "text-wa-white/75" : "text-wa-black/65"}`}>
                    風の音コレクション
                  </p>
                  <h2 className="text-2xl font-semibold leading-none">和の音オブジェクト図鑑</h2>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCatalogOpen(false)}
                  className={`rounded-full border px-4 py-2 text-sm transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98] ${
                    darkMode
                      ? "border-white/35 bg-neutral-900 hover:bg-neutral-800"
                      : "border-black/30 bg-white hover:bg-neutral-100"
                  }`}
                >
                  閉じる
                </button>
              </div>

              {selectedCatalogEntry ? (
                <div
                  className={`relative grid overflow-hidden rounded-2xl border md:grid-cols-[1.05fr_0.95fr] ${
                    darkMode
                      ? "border-wa-white/20 bg-wa-black/15"
                      : "border-wa-black/15 bg-white/55"
                  }`}
                >
                  <div
                    className={`grid gap-4 border-b p-4 md:border-b-0 md:border-r md:[transform-origin:right_center] md:[transform-style:preserve-3d] md:animate-[kazenagare-catalog-left-open_360ms_cubic-bezier(0.18,1,0.32,1)] ${
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
                          <span className="text-4xl font-bold">{selectedEntryPlaybackReward}</span>
                          <span className={`pb-1 text-sm ${darkMode ? "text-wa-white/70" : "text-wa-black/65"}`}>
                            コイン
                          </span>
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${catalogStatusClass(selectedCatalogEntry.status, darkMode)}`}
                      >
                        {catalogStatusLabel(selectedCatalogEntry.status)}
                      </span>
                    </div>

                    <div
                      className={`grid min-h-[220px] place-items-center rounded-2xl border ${
                        darkMode
                          ? "border-wa-white/20 bg-wa-black/35"
                          : "border-wa-black/15 bg-white/80"
                      }`}
                    >
                      <div className="grid place-items-center gap-2 text-center">
                        <div
                          className={`grid h-28 w-28 place-items-center rounded-full border text-6xl ${
                            darkMode
                              ? "border-wa-white/35 bg-wa-black/55"
                              : "border-wa-black/20 bg-white"
                          }`}
                        >
                          <Image
                            src={selectedCatalogEntry.catalogImageSrc}
                            alt={`${selectedCatalogEntry.name}の画像`}
                            width={96}
                            height={96}
                            className="h-24 w-24 rounded-full object-cover"
                          />
                        </div>
                        <p className="text-lg font-semibold leading-none">{selectedCatalogEntry.name}</p>
                        <p className={`text-xs ${darkMode ? "text-wa-white/75" : "text-wa-black/65"}`}>
                          {selectedCatalogEntry.ruby}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`rounded-xl border p-3 text-sm leading-relaxed ${
                        darkMode
                          ? "border-wa-white/20 bg-wa-black/35 text-wa-white/85"
                          : "border-wa-black/15 bg-white/80 text-wa-black/80"
                      }`}
                    >
                      {selectedCatalogEntry.soundDesign}
                    </div>

                    {isSelectedCatalogObjectOwned ? (
                      <button
                        type="button"
                        onClick={handleRerecordFromCatalog}
                        className={`mt-auto inline-flex items-center justify-center rounded-xl border px-4 py-3 text-sm font-semibold transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98] ${
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
                        className={`mt-auto inline-flex items-center justify-center rounded-xl border px-4 py-3 text-sm font-semibold transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98] ${
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
                    className={`grid content-start gap-4 p-4 md:[transform-origin:left_center] md:[transform-style:preserve-3d] md:animate-[kazenagare-catalog-right-open_360ms_cubic-bezier(0.18,1,0.32,1)] ${
                      darkMode
                        ? "bg-[linear-gradient(240deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.01)_100%)]"
                        : "bg-[linear-gradient(240deg,rgba(255,255,255,0.84)_0%,rgba(255,255,255,0.58)_100%)]"
                    }`}
                  >
                    <div>
                      <p className={`text-xs ${darkMode ? "text-wa-white/75" : "text-wa-black/65"}`}>
                        オブジェクト
                      </p>
                      <p className="text-sm font-semibold">サムネイルを押して詳細を切り替え</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {catalogSlots.map((entry) => {
                        const isSelected = entry.objectType === selectedCatalogEntry.objectType;

                        return (
                          <button
                            key={entry.objectType}
                            type="button"
                            onClick={() => {
                              setSelectedCatalogObjectType(entry.objectType);
                              setCatalogActionNotice(null);
                            }}
                            className={`grid min-h-24 place-items-center gap-1 rounded-xl border px-2 py-2 text-center transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98] ${
                              isSelected
                                ? darkMode
                                  ? "border-wa-gold/65 bg-wa-gold/20"
                                  : "border-wa-red/45 bg-wa-red/12"
                                : darkMode
                                  ? "border-wa-white/20 bg-wa-white/5 hover:bg-wa-white/10"
                                  : "border-wa-black/15 bg-white/70 hover:bg-wa-red/8"
                            }`}
                          >
                            <Image
                              src={entry.catalogImageSrc}
                              alt={`${entry.name}の画像`}
                              width={36}
                              height={36}
                              className="h-9 w-9 rounded-full object-cover"
                            />
                            <span className="text-[11px] font-semibold leading-tight">{entry.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    <details
                      className={`rounded-xl border p-3 text-xs ${
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
        <div className="fixed inset-0 z-[130] isolate grid place-items-center p-4 sm:p-6">
          <button
            type="button"
            aria-label="録音モーダルを閉じる"
            className="absolute inset-0 bg-wa-black/85 backdrop-blur-md"
            onClick={canCloseRecordingModal ? () => closeRecordingModal("user") : undefined}
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
                <Image
                  src={recordingEntry.catalogImageSrc}
                  alt={`${recordingEntry.name}の画像`}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full object-cover"
                />
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
                onClick={() => closeRecordingModal("user")}
                disabled={!canCloseRecordingModal}
                className={`rounded-md border px-4 py-2 text-sm transition-all duration-150 ease-out ${
                  !canCloseRecordingModal
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

            {recordingModalMode === "purchase" ? (
              <p
                className={`rounded-lg border px-3 py-2 text-xs ${
                  darkMode
                    ? "border-wa-red/45 bg-[#2a1414] text-wa-white"
                    : "border-wa-red/30 bg-wa-red/10 text-wa-black"
                }`}
              >
                初回購入時は「録音し終わって配置する」まで閉じることはできません。
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
