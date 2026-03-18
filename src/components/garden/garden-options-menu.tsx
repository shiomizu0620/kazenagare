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
const CATALOG_PURCHASE_SPINNER_MS = 360;
const CATALOG_PURCHASE_POP_MS = 220;
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
  const [isPurchasingFromCatalog, setIsPurchasingFromCatalog] = useState(false);
  const [isPurchaseSuccessPop, setIsPurchaseSuccessPop] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingCountdown, setRecordingCountdown] = useState(RECORDING_DURATION_SECONDS);
  const [recordingNotice, setRecordingNotice] = useState<string | null>(null);
  const [recordingPreviewAudioUrls, setRecordingPreviewAudioUrls] = useState<
    Partial<Record<ObjectType, string>>
  >({});
  const [audioSettings, setAudioSettings] = useState<KazenagareAudioSettings>(
    DEFAULT_KAZENAGARE_AUDIO_SETTINGS,
  );
  const [isCatalogListExpanded, setIsCatalogListExpanded] = useState(false);
  const [selectedCatalogObjectType, setSelectedCatalogObjectType] =
    useState<ObjectType>(VOICE_ZOO_ENTRIES[0]?.objectType ?? "furin");
  const panelId = useId();
  const catalogPanelId = useId();
  const recordingPreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordingMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingWaveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordingWaveformAudioContextRef = useRef<AudioContext | null>(null);
  const recordingWaveformAnimationFrameRef = useRef<number | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStopTimerRef = useRef<number | null>(null);
  const recordingCountdownTimerRef = useRef<number | null>(null);
  const purchaseFeedbackTimerRef = useRef<number | null>(null);
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
  const isDevelopment = process.env.NODE_ENV === "development";
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
  const catalogSlots = [...VOICE_ZOO_ENTRIES].sort((a, b) => a.price - b.price);
  
  // ロック状態判定
  const getIsUnlocked = (objectType: ObjectType): boolean => {
    if (ownedCatalogObjectTypes.includes(objectType)) return true;
    let lastOwnedIndex = -1;
    for (let i = 0; i < catalogSlots.length; i++) {
      if (ownedCatalogObjectTypes.includes(catalogSlots[i].objectType)) {
        lastOwnedIndex = i;
      }
    }
    const currentIndex = catalogSlots.findIndex((e) => e.objectType === objectType);
    return currentIndex === lastOwnedIndex + 1;
  };

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

  const stopWaveformAnimation = useCallback(() => {
    if (recordingWaveformAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(recordingWaveformAnimationFrameRef.current);
      recordingWaveformAnimationFrameRef.current = null;
    }

    if (recordingWaveformAudioContextRef.current) {
      void recordingWaveformAudioContextRef.current.close();
      recordingWaveformAudioContextRef.current = null;
    }

    const canvas = recordingWaveformCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const startWaveformAnimation = useCallback((stream: MediaStream) => {
    stopWaveformAnimation();

    const canvas = recordingWaveformCanvasRef.current;

    if (!canvas) {
      return;
    }

    const AudioContextConstructor =
      window.AudioContext ??
      (window as Window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;

    if (!AudioContextConstructor) {
      return;
    }

    const audioContext = new AudioContextConstructor();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.82;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    recordingWaveformAudioContextRef.current = audioContext;

    const draw = () => {
      const renderCanvas = recordingWaveformCanvasRef.current;

      if (!renderCanvas) {
        return;
      }

      const renderContext = renderCanvas.getContext("2d");

      if (!renderContext) {
        return;
      }

      const devicePixelRatio = window.devicePixelRatio || 1;
      const width = Math.floor(renderCanvas.clientWidth * devicePixelRatio);
      const height = Math.floor(renderCanvas.clientHeight * devicePixelRatio);

      if (renderCanvas.width !== width || renderCanvas.height !== height) {
        renderCanvas.width = width;
        renderCanvas.height = height;
      }

      renderContext.clearRect(0, 0, width, height);
      analyser.getByteFrequencyData(dataArray);

      const bars = 28;
      const gap = 3 * devicePixelRatio;
      const totalGap = gap * (bars - 1);
      const barWidth = Math.max(2 * devicePixelRatio, (width - totalGap) / bars);
      const gradient = renderContext.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "rgba(196, 72, 48, 0.95)");
      gradient.addColorStop(1, "rgba(210, 173, 94, 0.7)");
      renderContext.fillStyle = gradient;

      for (let index = 0; index < bars; index += 1) {
        const dataIndex = Math.floor((index / bars) * dataArray.length);
        const amplitude = dataArray[dataIndex] / 255;
        const barHeight = Math.max(4 * devicePixelRatio, amplitude * height * 0.95);
        const x = index * (barWidth + gap);
        const y = (height - barHeight) / 2;

        renderContext.beginPath();
        renderContext.roundRect(x, y, barWidth, barHeight, 10 * devicePixelRatio);
        renderContext.fill();
      }

      recordingWaveformAnimationFrameRef.current = window.requestAnimationFrame(draw);
    };

    draw();
  }, [stopWaveformAnimation]);

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
    stopWaveformAnimation();
    stopRecordingStream();
    setIsRecording(false);
    setRecordingCountdown(RECORDING_DURATION_SECONDS);
    setRecordingNotice(null);
    setRecordingEntry(null);
    setRecordingModalMode(null);
  }, [clearRecordingTimers, recordingModalMode, stopRecordingStream, stopWaveformAnimation]);

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
      startWaveformAnimation(stream);

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
        stopWaveformAnimation();
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
      stopWaveformAnimation();
      stopRecordingStream();
      setIsRecording(false);
      setRecordingNotice("マイクの利用を許可してください。");
    }
  }, [
    clearRecordingTimers,
    isRecording,
    recordingEntry,
    resolveCurrentRecordingOwnerId,
    startWaveformAnimation,
    stopRecordingStream,
    stopWaveformAnimation,
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
      stopWaveformAnimation();
      stopRecordingStream();

      for (const url of Object.values(recordingPreviewAudioUrlsRef.current)) {
        if (url) {
          URL.revokeObjectURL(url);
        }
      }
    };
  }, [clearRecordingTimers, stopRecordingStream, stopWaveformAnimation]);

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
      if (purchaseFeedbackTimerRef.current !== null) {
        window.clearTimeout(purchaseFeedbackTimerRef.current);
        purchaseFeedbackTimerRef.current = null;
      }

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

    if (isPurchasingFromCatalog || isPurchaseSuccessPop) {
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

    setCatalogActionNotice(null);
    setIsPurchasingFromCatalog(true);

    if (purchaseFeedbackTimerRef.current !== null) {
      window.clearTimeout(purchaseFeedbackTimerRef.current);
      purchaseFeedbackTimerRef.current = null;
    }

    purchaseFeedbackTimerRef.current = window.setTimeout(() => {
      setIsPurchasingFromCatalog(false);
      setIsPurchaseSuccessPop(true);

      purchaseFeedbackTimerRef.current = window.setTimeout(() => {
        setIsPurchaseSuccessPop(false);
        purchaseFeedbackTimerRef.current = null;

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
      }, CATALOG_PURCHASE_POP_MS);
    }, CATALOG_PURCHASE_SPINNER_MS);
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
                setIsCatalogListExpanded(false);
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
          <div className="relative mx-auto w-full max-w-5xl md:min-w-[46rem] md:h-[min(88dvh,780px)]">
            <section
              id={catalogPanelId}
              role="dialog"
              aria-modal="true"
              aria-label="図鑑"
              className={`pointer-events-auto relative mx-auto h-[88svh] w-full max-w-5xl overflow-hidden rounded-3xl shadow-[0_34px_90px_rgba(0,0,0,0.45),inset_0_0_40px_rgba(0,0,0,0.08)] [transform-style:preserve-3d] animate-[kazenagare-catalog-burst_220ms_cubic-bezier(0.2,1,0.36,1)] md:h-[min(88dvh,780px)] ${
                darkMode
                  ? "border-4 border-[#8b6f47]/35 bg-[linear-gradient(160deg,rgba(48,42,32,0.98)_0%,rgba(62,54,42,0.95)_52%,rgba(42,36,28,0.98)_100%)] text-wa-white"
                  : "border-4 border-[#c9a868]/40 bg-[linear-gradient(160deg,rgba(252,248,242,0.99)_0%,rgba(246,238,224,0.97)_54%,rgba(254,250,244,0.99)_100%)] text-wa-black"
              }`}
            >
            <div className="grid h-full min-h-0 gap-4 p-5 sm:p-6">
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
                <div className="min-h-0">
                  <div
                    className={`relative grid min-h-0 overflow-visible rounded-2xl border md:h-full md:overflow-hidden md:grid-cols-[1.05fr_0.95fr] ${
                      darkMode
                        ? "border-wa-white/20 bg-wa-black/15"
                        : "border-wa-black/15 bg-white/55"
                    }`}
                  >
                  <div
                    className={`relative grid min-h-0 gap-2 border-b p-3 pb-24 md:border-b-0 md:border-r md:p-4 md:pb-4 md:gap-4 md:[transform-origin:right_center] md:[transform-style:preserve-3d] md:animate-[kazenagare-catalog-left-open_360ms_cubic-bezier(0.18,1,0.32,1)] ${
                      darkMode
                        ? "border-[#6b5a41]/40 bg-[linear-gradient(120deg,rgba(60,50,38,0.5)_0%,rgba(50,42,30,0.3)_100%)]"
                        : "border-[#d1a877]/30 bg-[linear-gradient(120deg,rgba(255,252,246,0.95)_0%,rgba(250,242,228,0.88)_100%)]"
                    }`}
                  >
                    <div className="flex items-start gap-2 md:gap-3">
                      <div>
                        <p className={`text-[10px] md:text-xs ${darkMode ? "text-wa-white/75" : "text-wa-black/65"}`}>
                          1回の再生報酬
                        </p>
                        <p className="mt-0.5 md:mt-1 flex items-end gap-1 md:gap-2 leading-none">
                          <span className="text-3xl md:text-4xl font-bold">{selectedEntryPlaybackReward}</span>
                          <span className={`pb-0.5 md:pb-1 text-xs md:text-sm ${darkMode ? "text-wa-white/70" : "text-wa-black/65"}`}>
                            コイン
                          </span>
                        </p>
                      </div>
                    </div>

                    <div
                      className={`grid min-h-[140px] md:min-h-[220px] place-items-center rounded-2xl border-4 shadow-[inset_0_2px_8px_rgba(0,0,0,0.12)] ${
                        darkMode
                          ? "border-[#8b6f47]/35 bg-[linear-gradient(135deg,rgba(60,50,38,0.4)_0%,rgba(48,42,32,0.6)_100%)]"
                          : "border-[#c9a868]/45 bg-[linear-gradient(135deg,rgba(255,252,246,0.8)_0%,rgba(248,240,226,0.9)_100%)]"
                      }`}
                    >
                      <div className="grid place-items-center gap-1 md:gap-2 text-center">
                        <div
                          className={`grid h-20 w-20 md:h-28 md:w-28 place-items-center rounded-full border-4 shadow-[inset_0_1px_4px_rgba(0,0,0,0.15),0_4px_12px_rgba(0,0,0,0.2)] ${
                            darkMode
                              ? "border-[#6b5a41]/45 bg-[radial-gradient(circle,rgba(70,58,44,0.6)_0%,rgba(50,42,30,0.8)_100%)]"
                              : "border-[#b89968]/45 bg-[radial-gradient(circle,rgba(255,250,242,0.95)_0%,rgba(245,236,220,0.85)_100%)]"
                          }`}
                        >
                          <Image
                            src={selectedCatalogEntry.catalogImageSrc}
                            alt={`${selectedCatalogEntry.name}の画像`}
                            width={96}
                            height={96}
                            className={`h-16 w-16 md:h-24 md:w-24 rounded-full object-cover ${!isSelectedCatalogObjectOwned ? "brightness-0 opacity-45" : ""}`}
                          />
                        </div>
                        <p className="text-base md:text-lg font-semibold leading-none">
                          {isSelectedCatalogObjectOwned ? selectedCatalogEntry.name : "？？？"}
                        </p>
                        <p className={`text-[10px] md:text-xs ${darkMode ? "text-wa-white/75" : "text-wa-black/65"}`}>
                          {isSelectedCatalogObjectOwned ? selectedCatalogEntry.ruby : "---"}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`rounded-xl border-2 p-2.5 md:p-3 text-[11px] md:text-sm leading-relaxed shadow-[inset_0_1px_4px_rgba(0,0,0,0.06)] ${
                        darkMode
                          ? "border-[#6b5a41]/35 bg-[linear-gradient(135deg,rgba(60,50,38,0.4)_0%,rgba(52,44,32,0.3)_100%)] text-wa-white/90"
                          : "border-[#c9a868]/30 bg-[linear-gradient(135deg,rgba(255,252,246,0.6)_0%,rgba(248,240,226,0.5)_100%)] text-wa-black/85"
                      }`}
                    >{selectedCatalogEntry.soundDesign}
                    </div>

                    {isSelectedCatalogObjectOwned ? (
                      <button
                        type="button"
                        onClick={handleRerecordFromCatalog}
                        className={`mt-auto inline-flex items-center justify-center rounded-xl border px-3 py-2.5 md:px-4 md:py-3 text-xs md:text-sm font-semibold transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98] ${
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
                        disabled={isPurchasingFromCatalog || isPurchaseSuccessPop}
                        className={`mt-auto inline-flex items-center justify-center rounded-xl border px-3 py-2.5 md:px-4 md:py-3 text-xs md:text-sm font-semibold transition-all duration-150 ease-out ${
                          isPurchasingFromCatalog || isPurchaseSuccessPop
                            ? "cursor-wait"
                            : "hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                        } ${
                          isPurchaseSuccessPop ? "scale-[1.04]" : ""
                        } ${
                          darkMode
                            ? "border-wa-gold/55 bg-wa-gold/20 text-wa-white hover:bg-wa-gold/30"
                            : "border-wa-gold/50 bg-wa-gold/20 text-wa-black hover:bg-wa-gold/30"
                        }`}
                      >
                        {isPurchasingFromCatalog ? (
                          <span className="inline-flex items-center gap-2">
                            <span
                              aria-hidden
                              className="h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin"
                            />
                            購入中...
                          </span>
                        ) : (
                          `購入する（${selectedCatalogEntry.price}コイン）`
                        )}
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
                    className={`absolute inset-x-0 bottom-0 z-20 grid min-h-0 content-start gap-3 border-t p-3 md:static md:z-auto md:gap-4 md:border-t-0 md:p-4 md:[transform-origin:left_center] md:[transform-style:preserve-3d] md:animate-[kazenagare-catalog-right-open_360ms_cubic-bezier(0.18,1,0.32,1)] ${
                      darkMode
                        ? "border-[#6b5a41]/45 bg-[linear-gradient(240deg,rgba(45,38,29,0.98)_0%,rgba(39,33,25,0.96)_100%)]"
                        : "border-[#d1a877]/35 bg-[linear-gradient(240deg,rgba(252,248,242,0.98)_0%,rgba(247,239,226,0.96)_100%)]"
                    }`}
                  >
                    <div className="hidden md:block">
                      <p className={`text-xs ${darkMode ? "text-wa-white/75" : "text-wa-black/65"}`}>
                        オブジェクト
                      </p>
                      <p className="text-sm font-semibold">サムネイルを押して詳細を切り替え</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsCatalogListExpanded((value) => !value)}
                      className={`inline-flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs md:text-sm font-semibold transition-all duration-150 md:hidden ${
                        darkMode
                          ? "border-wa-white/25 bg-wa-black/30 text-wa-white"
                          : "border-wa-black/20 bg-white/80 text-wa-black"
                      }`}
                      aria-expanded={isCatalogListExpanded}
                      aria-controls={`${catalogPanelId}-mobile-list`}
                    >
                      <span>オブジェクト一覧</span>
                      <span className="inline-flex items-center gap-1 text-[10px] md:text-xs">
                        {isCatalogListExpanded ? "閉じる" : "展開"}
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className={`h-4 w-4 transition-transform duration-150 ${isCatalogListExpanded ? "rotate-180" : "rotate-0"}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m6 14 6-6 6 6" />
                        </svg>
                      </span>
                    </button>

                    <div
                      id={`${catalogPanelId}-mobile-list`}
                      className={`min-h-0 pr-1 md:max-h-[44dvh] md:overflow-y-auto md:overscroll-y-contain ${
                        isCatalogListExpanded
                          ? "max-h-[34svh] overflow-y-auto overscroll-y-contain"
                          : "max-h-[7.75rem] overflow-hidden"
                      }`}
                    >
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {catalogSlots.map((entry) => {
                          const isSelected = entry.objectType === selectedCatalogEntry.objectType;
                          const isOwned = ownedCatalogObjectTypes.includes(entry.objectType);
                          const isUnlocked = getIsUnlocked(entry.objectType);
                          const isLocked = !isOwned && !isUnlocked;

                          return (
                            <button
                              key={entry.objectType}
                              type="button"
                              disabled={isLocked}
                              onClick={() => {
                                setSelectedCatalogObjectType(entry.objectType);
                                setCatalogActionNotice(null);
                                setIsCatalogListExpanded(false);
                              }}
                              className={`grid min-h-24 place-items-center gap-1 rounded-lg border-2 px-2 py-2 text-center transition-all duration-150 ease-out shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)] ${
                                isLocked
                                  ? darkMode
                                    ? "cursor-not-allowed border-[#6b5a41]/15 bg-[rgba(50,42,30,0.25)] opacity-35"
                                    : "cursor-not-allowed border-[#c9a868]/15 bg-[rgba(255,252,246,0.35)] opacity-35"
                                  : "hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                              } ${
                                isSelected
                                  ? darkMode
                                    ? "border-[#c9a868]/65 bg-[rgba(201,168,104,0.25)] shadow-[inset_0_0_10px_rgba(201,168,104,0.2)]"
                                    : "border-[#c9a868]/55 bg-[rgba(201,168,104,0.2)] shadow-[inset_0_0_10px_rgba(201,168,104,0.15)]"
                                  : !isLocked && (
                                      darkMode
                                        ? "border-[#6b5a41]/35 bg-[linear-gradient(135deg,rgba(70,58,44,0.3)_0%,rgba(52,44,32,0.15)_100%)] hover:bg-[linear-gradient(135deg,rgba(80,68,54,0.35)_0%,rgba(62,54,42,0.2)_100%)]"
                                        : "border-[#c9a868]/35 bg-[linear-gradient(135deg,rgba(255,252,246,0.75)_0%,rgba(250,242,228,0.55)_100%)] hover:bg-[linear-gradient(135deg,rgba(255,252,246,0.85)_0%,rgba(250,242,228,0.7)_100%)]"
                                    )
                              }`}
                            >
                              <Image
                                src={entry.catalogImageSrc}
                                alt={`${entry.name}の画像`}
                                width={36}
                                height={36}
                                className={`h-9 w-9 rounded-full object-cover ${isLocked ? "brightness-0 opacity-30" : !isOwned ? "brightness-0 opacity-45" : ""}`}
                              />
                              <span className="text-[11px] font-semibold leading-tight">
                                {isOwned ? entry.name : isLocked ? "ロック中" : "？？？"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {!isCatalogListExpanded ? (
                      <p
                        className={`text-center text-[11px] md:hidden ${
                          darkMode ? "text-wa-white/70" : "text-wa-black/65"
                        }`}
                      >
                        一覧の続きを見るには「展開」を押してください。
                      </p>
                    ) : null}

                    {isDevelopment ? (
                      <details
                        className={`hidden rounded-xl border p-3 text-xs md:block ${
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
                    ) : null}
                  </div>

                  <div
                    className={`pointer-events-none absolute inset-y-0 left-1/2 hidden w-px md:block ${
                      darkMode ? "bg-wa-white/18" : "bg-wa-black/15"
                    }`}
                  />
                </div>
                </div>
              ) : null}

              <p className={`text-[11px] sm:hidden ${darkMode ? "text-wa-white/70" : "text-wa-black/65"}`}>
                下の一覧をタップして詳細を切り替えできます。
              </p>
            </div>
            </section>

            {/* 巻物の左右巻き端 */}
            <div className="pointer-events-none absolute inset-y-0 left-0 right-0">
              <div className={`absolute bottom-[7%] top-[7%] -left-3 w-6 rounded-full border shadow-[inset_0_1px_2px_rgba(255,255,255,0.22),inset_0_-2px_3px_rgba(0,0,0,0.3),0_6px_12px_rgba(0,0,0,0.25)] ${
                darkMode
                  ? "border-[#5a4530]/75 bg-[linear-gradient(90deg,rgba(66,52,36,0.98)_0%,rgba(114,90,62,0.92)_45%,rgba(78,60,40,0.98)_100%)]"
                  : "border-[#a87c42]/60 bg-[linear-gradient(90deg,rgba(154,120,72,0.94)_0%,rgba(220,183,124,0.9)_45%,rgba(170,132,80,0.94)_100%)]"
              }`}>
                <span className={`absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                  darkMode ? "border-[#cdb084]/70" : "border-[#6d4f26]/50"
                }`} />
              </div>
              <div className={`absolute bottom-[7%] top-[7%] -right-3 w-6 rounded-full border shadow-[inset_0_1px_2px_rgba(255,255,255,0.22),inset_0_-2px_3px_rgba(0,0,0,0.3),0_6px_12px_rgba(0,0,0,0.25)] ${
                darkMode
                  ? "border-[#5a4530]/75 bg-[linear-gradient(90deg,rgba(66,52,36,0.98)_0%,rgba(114,90,62,0.92)_45%,rgba(78,60,40,0.98)_100%)]"
                  : "border-[#a87c42]/60 bg-[linear-gradient(90deg,rgba(154,120,72,0.94)_0%,rgba(220,183,124,0.9)_45%,rgba(170,132,80,0.94)_100%)]"
              }`}>
                <span className={`absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                  darkMode ? "border-[#cdb084]/70" : "border-[#6d4f26]/50"
                }`} />
              </div>
            </div>
          </div>
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

          <div className="relative w-full max-w-xl">
            <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalog-recording-title"
              className={`relative z-10 grid w-full gap-4 rounded-2xl border-4 p-5 shadow-[0_40px_110px_rgba(0,0,0,0.55),inset_0_0_30px_rgba(0,0,0,0.08)] ${
              darkMode
                ? "border-[#8b6f47]/35 bg-[linear-gradient(160deg,rgba(48,42,32,0.98)_0%,rgba(62,54,42,0.95)_52%,rgba(42,36,28,0.98)_100%)] text-wa-white"
                : "border-[#c9a868]/40 bg-[linear-gradient(160deg,rgba(252,248,242,0.99)_0%,rgba(246,238,224,0.97)_54%,rgba(254,250,244,0.99)_100%)] text-wa-black"
            }`}
            >
            <div className="flex items-start gap-3">
              <div
                className={`grid h-12 w-12 place-items-center rounded-full border-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)] ${
                  darkMode
                    ? "border-[#6b5a41]/45 bg-[radial-gradient(circle,rgba(70,58,44,0.5)_0%,rgba(50,42,30,0.7)_100%)]"
                    : "border-[#b89968]/45 bg-[radial-gradient(circle,rgba(255,250,242,0.95)_0%,rgba(245,236,220,0.85)_100%)]"
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
              className={`grid gap-2 rounded-xl border-2 p-4 shadow-[inset_0_1px_4px_rgba(0,0,0,0.06)] ${
                darkMode
                  ? "border-[#6b5a41]/35 bg-[linear-gradient(135deg,rgba(60,50,38,0.4)_0%,rgba(52,44,32,0.3)_100%)]"
                  : "border-[#c9a868]/30 bg-[linear-gradient(135deg,rgba(255,252,246,0.6)_0%,rgba(248,240,226,0.5)_100%)]"
              }`}
            >
              <p className={`text-xs ${darkMode ? "text-wa-white/70" : "text-wa-black/65"}`}>
                録音カウントダウン
              </p>
              <p className="text-4xl font-bold leading-none">
                {isRecording ? `${recordingCountdown}s` : `${RECORDING_DURATION_SECONDS}s`}
              </p>
            </div>

            <div className={`mb-1 rounded-xl border-2 p-3 shadow-[inset_0_1px_4px_rgba(0,0,0,0.06)] ${
              darkMode
                ? "border-[#6b5a41]/35 bg-[linear-gradient(135deg,rgba(60,50,38,0.35)_0%,rgba(52,44,32,0.25)_100%)]"
                : "border-[#c9a868]/30 bg-[linear-gradient(135deg,rgba(255,252,246,0.55)_0%,rgba(248,240,226,0.45)_100%)]"
            }`}>
              <canvas
                ref={recordingWaveformCanvasRef}
                className={`h-16 w-full rounded-lg transition-opacity ${isRecording ? "opacity-100" : "opacity-45"}`}
                aria-hidden
              />
              <p className={`mt-2 text-center text-[11px] font-medium tracking-wide ${darkMode ? "text-wa-white/60" : "text-wa-black/55"}`}>
                {isRecording ? "音声を検出中..." : "録音を開始すると波形が動きます"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void startThreeSecondRecording();
                }}
                disabled={isRecording}
                className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-all duration-150 ease-out shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] ${
                  isRecording
                    ? darkMode
                      ? "cursor-not-allowed border-[#6b5a41]/15 bg-[rgba(50,42,30,0.25)] text-wa-white/45"
                      : "cursor-not-allowed border-[#c9a868]/15 bg-[rgba(255,252,246,0.35)] text-wa-black/45"
                    : darkMode
                      ? "border-[#d97757]/45 bg-[linear-gradient(135deg,rgba(217,119,87,0.3)_0%,rgba(195,95,63,0.2)_100%)] hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,rgba(217,119,87,0.4)_0%,rgba(195,95,63,0.3)_100%)] active:translate-y-[1px] active:scale-[0.98]"
                      : "border-[#d97757]/40 bg-[linear-gradient(135deg,rgba(217,119,87,0.2)_0%,rgba(195,95,63,0.12)_100%)] hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,rgba(217,119,87,0.28)_0%,rgba(195,95,63,0.2)_100%)] active:translate-y-[1px] active:scale-[0.98]"
                }`}
              >
                {isRecording ? "録音中..." : "3秒録音を開始"}
              </button>

              {canPlaceFromRecordingModal ? (
                <button
                  type="button"
                  onClick={handlePlacementFromRecordingModal}
                  className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-all duration-150 ease-out shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98] ${
                    darkMode
                      ? "border-[#7fa357]/50 bg-[linear-gradient(135deg,rgba(127,163,87,0.3)_0%,rgba(99,135,62,0.2)_100%)] hover:bg-[linear-gradient(135deg,rgba(127,163,87,0.4)_0%,rgba(99,135,62,0.3)_100%)]"
                      : "border-[#8bb04a]/45 bg-[linear-gradient(135deg,rgba(139,176,74,0.2)_0%,rgba(110,145,55,0.12)_100%)] hover:bg-[linear-gradient(135deg,rgba(139,176,74,0.28)_0%,rgba(110,145,55,0.2)_100%)]"
                  }`}
                >
                  録音し終わって配置する
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className={`cursor-not-allowed rounded-lg border-2 px-4 py-2 text-sm font-semibold shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] ${
                    darkMode
                      ? "border-[#6b5a41]/15 bg-[rgba(50,42,30,0.25)] text-wa-white/45"
                      : "border-[#c9a868]/15 bg-[rgba(255,252,246,0.35)] text-wa-black/45"
                  }`}
                >
                  録音し終わって配置する
                </button>
              )}

              <button
                type="button"
                onClick={() => closeRecordingModal("user")}
                disabled={!canCloseRecordingModal}
                className={`rounded-lg border-2 px-4 py-2 text-sm transition-all duration-150 ease-out shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] ${
                  !canCloseRecordingModal
                    ? darkMode
                      ? "cursor-not-allowed border-[#6b5a41]/15 bg-[rgba(50,42,30,0.25)] text-wa-white/45"
                      : "cursor-not-allowed border-[#c9a868]/15 bg-[rgba(255,252,246,0.35)] text-wa-black/45"
                    : darkMode
                      ? "border-[#6b5a41]/40 bg-[linear-gradient(135deg,rgba(70,58,44,0.25)_0%,rgba(52,44,32,0.15)_100%)] hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,rgba(80,68,54,0.32)_0%,rgba(62,54,42,0.22)_100%)] active:translate-y-[1px] active:scale-[0.98]"
                      : "border-[#c9a868]/40 bg-[linear-gradient(135deg,rgba(255,252,246,0.5)_0%,rgba(250,242,228,0.35)_100%)] hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,rgba(255,252,246,0.65)_0%,rgba(250,242,228,0.5)_100%)] active:translate-y-[1px] active:scale-[0.98]"
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
                className={`rounded-lg border-2 px-3 py-2 text-xs ${
                  darkMode
                    ? "border-[#6b5a41]/35 bg-[linear-gradient(135deg,rgba(60,50,38,0.4)_0%,rgba(52,44,32,0.3)_100%)] text-wa-white/90"
                    : "border-[#c9a868]/30 bg-[linear-gradient(135deg,rgba(255,252,246,0.6)_0%,rgba(248,240,226,0.5)_100%)] text-wa-black"
                }`}
              >
                {recordingNotice}
              </p>
            ) : null}

            {!recordingEntryAudioUrl ? (
              <p
                className={`rounded-lg border-2 px-3 py-2 text-xs ${
                  darkMode
                    ? "border-[#8b6f47]/40 bg-[linear-gradient(135deg,rgba(85,67,45,0.4)_0%,rgba(75,58,40,0.3)_100%)] text-wa-white"
                    : "border-[#c9a868]/40 bg-[linear-gradient(135deg,rgba(201,168,104,0.15)_0%,rgba(180,145,85,0.08)_100%)] text-wa-black"
                }`}
              >
                配置するには先に3秒録音を完了してください。
              </p>
            ) : null}

            {recordingModalMode === "purchase" ? (
              <p
                className={`rounded-lg border-2 px-3 py-2 text-xs ${
                  darkMode
                    ? "border-[#8b4a4a]/40 bg-[linear-gradient(135deg,rgba(110,60,60,0.4)_0%,rgba(90,50,50,0.3)_100%)] text-wa-white"
                    : "border-[#d97757]/35 bg-[linear-gradient(135deg,rgba(217,119,87,0.15)_0%,rgba(195,95,63,0.08)_100%)] text-wa-black"
                }`}
              >
                初回購入時は「録音し終わって配置する」まで閉じることはできません。
              </p>
            ) : null}
            </section>

            {/* 巻物の左右巻き端 */}
            <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-20">
              <div className={`absolute bottom-[8%] top-[8%] -left-3 w-6 rounded-full border shadow-[inset_0_1px_2px_rgba(255,255,255,0.22),inset_0_-2px_3px_rgba(0,0,0,0.3),0_6px_12px_rgba(0,0,0,0.25)] ${
                darkMode
                  ? "border-[#5a4530]/75 bg-[linear-gradient(90deg,rgba(66,52,36,0.98)_0%,rgba(114,90,62,0.92)_45%,rgba(78,60,40,0.98)_100%)]"
                  : "border-[#a87c42]/60 bg-[linear-gradient(90deg,rgba(154,120,72,0.94)_0%,rgba(220,183,124,0.9)_45%,rgba(170,132,80,0.94)_100%)]"
              }`}>
                <span className={`absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                  darkMode ? "border-[#cdb084]/70" : "border-[#6d4f26]/50"
                }`} />
              </div>
              <div className={`absolute bottom-[8%] top-[8%] -right-3 w-6 rounded-full border shadow-[inset_0_1px_2px_rgba(255,255,255,0.22),inset_0_-2px_3px_rgba(0,0,0,0.3),0_6px_12px_rgba(0,0,0,0.25)] ${
                darkMode
                  ? "border-[#5a4530]/75 bg-[linear-gradient(90deg,rgba(66,52,36,0.98)_0%,rgba(114,90,62,0.92)_45%,rgba(78,60,40,0.98)_100%)]"
                  : "border-[#a87c42]/60 bg-[linear-gradient(90deg,rgba(154,120,72,0.94)_0%,rgba(220,183,124,0.9)_45%,rgba(170,132,80,0.94)_100%)]"
              }`}>
                <span className={`absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                  darkMode ? "border-[#cdb084]/70" : "border-[#6d4f26]/50"
                }`} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
