"use client";

import Link from "next/link";
import { del, get, set } from "idb-keyval";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageShell } from "@/components/ui/page-shell";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { ObjectType } from "@/types/garden";
import {
  type VoiceZooEntry,
  VOICE_ZOO_ENTRIES,
} from "@/lib/voice-zoo/catalog";
import {
  createVoiceZooRecordingId,
  getLatestRecordingIdByObjectType,
  getVoiceZooLegacyRecordingStorageKey,
  getVoiceZooRecordingBlobStorageKey,
  getVoiceZooRecordingCatalogStorageKey,
  parseVoiceZooRecordingCatalog,
  type VoiceZooRecordingMeta,
  VOICE_ZOO_SUPPORTED_OBJECT_TYPES,
} from "@/lib/voice-zoo/recordings";
import {
  calculatePlaybackRewardCoins,
  createInitialVoiceZooWallet,
  INITIAL_VOICE_ZOO_COINS,
  loadVoiceZooWallet,
  type VoiceZooWallet,
  saveVoiceZooWallet,
} from "@/lib/voice-zoo/wallet";
import {
  applyVoiceZooPlaybackEffect,
} from "@/lib/voice-zoo/playback-effects";

function statusLabel(status: "prototype" | "planned") {
  if (status === "prototype") {
    return "試作中";
  }

  return "企画中";
}

function statusClass(status: "prototype" | "planned") {
  if (status === "prototype") {
    return "border-wa-red/35 bg-wa-red/10 text-wa-black";
  }

  return "border-wa-gold/35 bg-wa-gold/15 text-wa-black";
}

const coinFormatter = new Intl.NumberFormat("ja-JP");
const RECORDING_DURATION_SECONDS = 3;
const PROGRESS_WIDTH_CLASSES = [
  "w-0",
  "w-[10%]",
  "w-[20%]",
  "w-[30%]",
  "w-[40%]",
  "w-[50%]",
  "w-[60%]",
  "w-[70%]",
  "w-[80%]",
  "w-[90%]",
  "w-full",
];

export default function VoiceZooPage() {
  const [selectedEntry, setSelectedEntry] = useState<VoiceZooEntry | null>(null);
  const [wallet, setWallet] = useState<VoiceZooWallet>(createInitialVoiceZooWallet);
  const [isWalletLoaded, setIsWalletLoaded] = useState(false);
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null);
  const [audioOwnerId, setAudioOwnerId] = useState<string>("local_guest");
  const [recordingCatalog, setRecordingCatalog] = useState<VoiceZooRecordingMeta[]>([]);
  const [recordingAudioUrls, setRecordingAudioUrls] = useState<
    Partial<Record<ObjectType, string>>
  >({});
  const [recordingEntry, setRecordingEntry] = useState<VoiceZooEntry | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingCountdown, setRecordingCountdown] = useState(RECORDING_DURATION_SECONDS);
  const [recordingNotice, setRecordingNotice] = useState<string | null>(null);
  const [testingNotice, setTestingNotice] = useState<string | null>(null);
  const [isRewardPlaybackActive, setIsRewardPlaybackActive] = useState(false);
  const [pendingPlaybackRewardCoins, setPendingPlaybackRewardCoins] = useState<number | null>(
    null,
  );
  const rewardAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordingPreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordingMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStopTimerRef = useRef<number | null>(null);
  const recordingCountdownTimerRef = useRef<number | null>(null);
  const recordingCatalogRef = useRef<VoiceZooRecordingMeta[]>([]);
  const recordingAudioUrlsRef = useRef<Partial<Record<ObjectType, string>>>({});

  const totalCount = VOICE_ZOO_ENTRIES.length;
  const prototypeCount = VOICE_ZOO_ENTRIES.filter(
    (entry) => entry.status === "prototype",
  ).length;
  const ownedCount = wallet.ownedObjectTypes.length;
  const unownedEntries = VOICE_ZOO_ENTRIES.filter(
    (entry) => !wallet.ownedObjectTypes.includes(entry.objectType),
  );
  const buyableCount = unownedEntries.filter(
    (entry) => wallet.coins >= entry.price,
  ).length;
  const cheapestUnownedPrice = unownedEntries.length
    ? Math.min(...unownedEntries.map((entry) => entry.price))
    : null;
  const coinsToNextPurchase = cheapestUnownedPrice
    ? Math.max(0, cheapestUnownedPrice - wallet.coins)
    : 0;
  const collectionProgressPercent = totalCount
    ? Math.round((ownedCount / totalCount) * 100)
    : 0;
  const collectionProgressClass =
    PROGRESS_WIDTH_CLASSES[
      Math.min(10, Math.max(0, Math.round(collectionProgressPercent / 10)))
    ];

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      setWallet(loadVoiceZooWallet(audioOwnerId));
      setIsWalletLoaded(true);
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
    };
  }, [audioOwnerId]);

  useEffect(() => {
    if (!isWalletLoaded) {
      return;
    }

    saveVoiceZooWallet(wallet, audioOwnerId);
  }, [audioOwnerId, isWalletLoaded, wallet]);

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

  const updateRecordingAudioUrlForObject = useCallback(
    (objectType: ObjectType, nextBlob: Blob | null) => {
      setRecordingAudioUrls((current) => {
        const nextState = { ...current };
        const currentUrl = current[objectType];

        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }

        if (nextBlob) {
          nextState[objectType] = URL.createObjectURL(nextBlob);
        } else {
          delete nextState[objectType];
        }

        return nextState;
      });
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const loadRecordingCatalog = async () => {
      const catalogStorageKey = getVoiceZooRecordingCatalogStorageKey(audioOwnerId);
      let catalog = parseVoiceZooRecordingCatalog(
        window.localStorage.getItem(catalogStorageKey),
      );

      let didCatalogChange = false;

      // Migrate legacy single-slot recordings into the multi-recording catalog.
      for (const objectType of VOICE_ZOO_SUPPORTED_OBJECT_TYPES) {
        const hasTypeRecording = catalog.some(
          (recording) => recording.objectType === objectType,
        );

        if (hasTypeRecording) {
          continue;
        }

        const legacyBlob = await get(
          getVoiceZooLegacyRecordingStorageKey(audioOwnerId, objectType),
        );

        if (!(legacyBlob instanceof Blob)) {
          continue;
        }

        const migratedRecordingId = createVoiceZooRecordingId(objectType);
        await set(
          getVoiceZooRecordingBlobStorageKey(audioOwnerId, migratedRecordingId),
          legacyBlob,
        );

        catalog = [
          ...catalog,
          {
            id: migratedRecordingId,
            objectType,
            createdAt: new Date().toISOString(),
          },
        ];
        didCatalogChange = true;
      }

      if (didCatalogChange) {
        window.localStorage.setItem(catalogStorageKey, JSON.stringify(catalog));
      }

      if (cancelled) {
        return;
      }

      setRecordingCatalog(catalog);

      const latestRecordingIdByObjectType = getLatestRecordingIdByObjectType(catalog);

      for (const objectType of VOICE_ZOO_SUPPORTED_OBJECT_TYPES) {
        const latestRecordingId = latestRecordingIdByObjectType[objectType];

        if (!latestRecordingId) {
          updateRecordingAudioUrlForObject(objectType, null);
          continue;
        }

        const latestBlob = await get(
          getVoiceZooRecordingBlobStorageKey(audioOwnerId, latestRecordingId),
        );

        if (cancelled) {
          return;
        }

        if (!(latestBlob instanceof Blob)) {
          updateRecordingAudioUrlForObject(objectType, null);
          continue;
        }

        updateRecordingAudioUrlForObject(objectType, latestBlob);
      }
    };

    void loadRecordingCatalog();

    return () => {
      cancelled = true;
    };
  }, [audioOwnerId, updateRecordingAudioUrlForObject]);

  useEffect(() => {
    recordingCatalogRef.current = recordingCatalog;
  }, [recordingCatalog]);

  useEffect(() => {
    recordingAudioUrlsRef.current = recordingAudioUrls;
  }, [recordingAudioUrls]);

  useEffect(() => {
    return () => {
      for (const objectType of VOICE_ZOO_SUPPORTED_OBJECT_TYPES) {
        const url = recordingAudioUrlsRef.current[objectType];

        if (url) {
          URL.revokeObjectURL(url);
        }
      }
    };
  }, []);

  const selectedEntryRecordingAudioUrl = selectedEntry
    ? (recordingAudioUrls[selectedEntry.objectType] ?? null)
    : null;
  const recordingEntryAudioUrl = recordingEntry
    ? (recordingAudioUrls[recordingEntry.objectType] ?? null)
    : null;
  const canPlaceFromRecordingModal = Boolean(recordingEntryAudioUrl) && !isRecording;

  const clearAllRecordingAudioUrls = useCallback(() => {
    for (const objectType of VOICE_ZOO_SUPPORTED_OBJECT_TYPES) {
      const currentUrl = recordingAudioUrlsRef.current[objectType];

      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    }

    setRecordingAudioUrls({});
  }, []);

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

  const startThreeSecondRecording = useCallback(async () => {
    if (!audioOwnerId || !recordingEntry || isRecording) {
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

        const playableBlob = nextBlob;

        const nextRecordingId = createVoiceZooRecordingId(recordingObjectType);
        await set(
          getVoiceZooRecordingBlobStorageKey(recordingOwnerId, nextRecordingId),
          playableBlob,
        );

        const nextCatalogEntry: VoiceZooRecordingMeta = {
          id: nextRecordingId,
          objectType: recordingObjectType,
          createdAt: new Date().toISOString(),
        };
        const nextRecordingCatalog = [...recordingCatalogRef.current, nextCatalogEntry];

        window.localStorage.setItem(
          getVoiceZooRecordingCatalogStorageKey(recordingOwnerId),
          JSON.stringify(nextRecordingCatalog),
        );
        setRecordingCatalog(nextRecordingCatalog);

        updateRecordingAudioUrlForObject(recordingObjectType, playableBlob);
        setRecordingNotice(`${recordingObjectName}の録音を保存しました。`);
        setRecordingCountdown(RECORDING_DURATION_SECONDS);
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
    audioOwnerId,
    clearRecordingTimers,
    isRecording,
    recordingEntry,
    resolveCurrentRecordingOwnerId,
    stopRecordingStream,
    updateRecordingAudioUrlForObject,
  ]);

  useEffect(() => {
    if (!selectedEntry) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPurchaseNotice(null);
        setSelectedEntry(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedEntry]);

  useEffect(() => {
    if (!recordingEntry) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isRecording) {
        closeRecordingModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeRecordingModal, isRecording, recordingEntry]);

  useEffect(() => {
    return () => {
      clearRecordingTimers();
      stopRecordingStream();
    };
  }, [clearRecordingTimers, stopRecordingStream]);

  const handleSelectEntry = (entry: VoiceZooEntry) => {
    setPurchaseNotice(null);
    setSelectedEntry(entry);
  };

  const openRecordingModalForEntry = useCallback(
    (entry: VoiceZooEntry, noticeMessage: string) => {
      if (rewardAudioRef.current) {
        rewardAudioRef.current.pause();
        rewardAudioRef.current.currentTime = 0;
      }

      setIsRewardPlaybackActive(false);
      setPendingPlaybackRewardCoins(null);
      setPurchaseNotice(null);
      setSelectedEntry(null);
      setRecordingEntry(entry);
      setRecordingNotice(noticeMessage);
      setRecordingCountdown(RECORDING_DURATION_SECONDS);
    },
    [],
  );

  const handlePurchaseSelectedEntry = () => {
    if (!selectedEntry || !isWalletLoaded) {
      return;
    }

    const purchasedEntry = selectedEntry;

    const isOwned = wallet.ownedObjectTypes.includes(purchasedEntry.objectType);

    if (isOwned) {
      setPurchaseNotice(`${purchasedEntry.name}は購入済みです。`);
      return;
    }

    if (wallet.coins < purchasedEntry.price) {
      setPurchaseNotice("コインが足りません。図鑑で別オブジェクトを選んでください。");
      return;
    }

    setWallet((current) => {
      const nextOwnedObjectTypes = current.ownedObjectTypes.includes(purchasedEntry.objectType)
        ? current.ownedObjectTypes
        : [...current.ownedObjectTypes, purchasedEntry.objectType];

      return {
        coins: Math.max(0, current.coins - purchasedEntry.price),
        ownedObjectTypes: nextOwnedObjectTypes,
      };
    });

    openRecordingModalForEntry(
      purchasedEntry,
      `${purchasedEntry.name}を購入しました。3秒録音を開始してください。`,
    );
  };

  const handleRerecordSelectedEntry = () => {
    if (!selectedEntry || !wallet.ownedObjectTypes.includes(selectedEntry.objectType)) {
      return;
    }

    openRecordingModalForEntry(
      selectedEntry,
      `${selectedEntry.name}の録音を更新できます。3秒録音を開始してください。`,
    );
  };

  const handleRewardPlaybackEnded = () => {
    setIsRewardPlaybackActive(false);

    if (!selectedEntry || !pendingPlaybackRewardCoins) {
      setPendingPlaybackRewardCoins(null);
      return;
    }

    setWallet((current) => ({
      ...current,
      coins: current.coins + pendingPlaybackRewardCoins,
    }));
    setPurchaseNotice(
      `${selectedEntry.name}の録音再生で +${pendingPlaybackRewardCoins} コイン獲得しました。`,
    );
    setPendingPlaybackRewardCoins(null);
  };

  const handleRewardPlaybackPause = () => {
    setIsRewardPlaybackActive(false);
  };

  const handlePlayRecordingForReward = async () => {
    if (!selectedEntry) {
      return;
    }

    if (!selectedEntryOwned) {
      setPurchaseNotice("購入後に録音再生報酬を受け取れます。");
      return;
    }

    if (!selectedEntryRecordingAudioUrl || !rewardAudioRef.current) {
      setPurchaseNotice("録音データが見つかりません。先に録音を作成してください。");
      return;
    }

    const rewardCoins = calculatePlaybackRewardCoins(selectedEntry.price);
    setPendingPlaybackRewardCoins(rewardCoins);
    setPurchaseNotice(null);

    try {
      rewardAudioRef.current.currentTime = 0;
      applyVoiceZooPlaybackEffect(rewardAudioRef.current, selectedEntry.objectType);
      await rewardAudioRef.current.play();
      setIsRewardPlaybackActive(true);
    } catch {
      setPendingPlaybackRewardCoins(null);
      setIsRewardPlaybackActive(false);
      setPurchaseNotice("録音の再生を開始できませんでした。もう一度お試しください。");
    }
  };

  const closeModal = () => {
    if (rewardAudioRef.current) {
      rewardAudioRef.current.pause();
      rewardAudioRef.current.currentTime = 0;
    }

    setIsRewardPlaybackActive(false);
    setPendingPlaybackRewardCoins(null);
    setPurchaseNotice(null);
    setSelectedEntry(null);
  };

  const handleResetWalletForTesting = () => {
    closeModal();
    closeRecordingModal();
    setWallet(createInitialVoiceZooWallet());
    window.localStorage.removeItem("kazenagare_objects_me");
    setTestingNotice(
      `テスト用に購入状態を初期化しました（所持コイン: ${INITIAL_VOICE_ZOO_COINS}）。`,
    );
  };

  const handleAddTestCoins = useCallback((coinsToAdd: number) => {
    setWallet((current) => ({
      ...current,
      coins: current.coins + coinsToAdd,
    }));
    setTestingNotice(`テスト用に ${coinsToAdd} コインを追加しました。`);
  }, []);

  const handleClearSavedRecordingForTesting = useCallback(async () => {
    if (rewardAudioRef.current) {
      rewardAudioRef.current.pause();
      rewardAudioRef.current.currentTime = 0;
    }

    setIsRewardPlaybackActive(false);
    setPendingPlaybackRewardCoins(null);

    const catalogStorageKey = getVoiceZooRecordingCatalogStorageKey(audioOwnerId);
    const catalog = parseVoiceZooRecordingCatalog(
      window.localStorage.getItem(catalogStorageKey),
    );

    await Promise.all(
      [
        ...catalog.map((recording) =>
          del(getVoiceZooRecordingBlobStorageKey(audioOwnerId, recording.id)),
        ),
        ...VOICE_ZOO_SUPPORTED_OBJECT_TYPES.map((objectType) =>
          del(getVoiceZooLegacyRecordingStorageKey(audioOwnerId, objectType)),
        ),
      ],
    );

    window.localStorage.removeItem(catalogStorageKey);
    setRecordingCatalog([]);
    clearAllRecordingAudioUrls();
    setTestingNotice("テスト用に録音データを削除しました。");
  }, [audioOwnerId, clearAllRecordingAudioUrls]);

  const handleRecordingPreviewPlay = useCallback(() => {
    if (!recordingEntry || !recordingPreviewAudioRef.current) {
      return;
    }

    applyVoiceZooPlaybackEffect(
      recordingPreviewAudioRef.current,
      recordingEntry.objectType,
    );
  }, [recordingEntry]);

  const selectedEntryOwned = selectedEntry
    ? wallet.ownedObjectTypes.includes(selectedEntry.objectType)
    : false;
  const selectedEntryAffordable = selectedEntry
    ? wallet.coins >= selectedEntry.price
    : false;
  const selectedEntryPlaybackRewardCoins = selectedEntry
    ? calculatePlaybackRewardCoins(selectedEntry.price)
    : 0;

  return (
    <PageShell
      title="My Voice Zoo"
      subtitle="声で育てる、和の音オブジェクト図鑑"
    >
      <div className="flex flex-wrap gap-3">
        <Link
          href="/garden/me"
          className="rounded-md border border-wa-black px-4 py-2 text-sm transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-wa-red/10 active:translate-y-[1px] active:scale-[0.98]"
        >
          自分の庭へ
        </Link>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-wa-black/20 bg-[radial-gradient(circle_at_top_right,rgba(165,33,117,0.14),transparent_58%),linear-gradient(145deg,#ffffff_0%,#f8f1f6_48%,#f2f2f2_100%)] p-5 shadow-[0_14px_42px_rgba(43,43,43,0.14)]">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-wa-red/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-8 left-12 h-24 w-24 rounded-full bg-wa-gold/10 blur-xl" />

        <div className="relative grid gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-wa-black/55">
                KAZENAGARE Wallet
              </p>
              <p className="mt-2 text-sm text-wa-black/70">所持コイン</p>
              <p className="mt-1 flex items-end gap-2 leading-none">
                <span className="text-4xl font-bold">
                  {isWalletLoaded ? coinFormatter.format(wallet.coins) : "..."}
                </span>
                <span className="pb-1 text-sm font-semibold text-wa-black/70">coins</span>
              </p>
            </div>
            <div className="rounded-full border border-wa-black/20 bg-white/85 px-4 py-2 text-center">
              <p className="text-[11px] text-wa-black/60">コレクション進捗</p>
              <p className="text-lg font-semibold">{collectionProgressPercent}%</p>
            </div>
          </div>

          <div className="grid gap-2 rounded-2xl border border-wa-black/15 bg-white/80 p-3">
            <div className="flex items-center justify-between text-xs text-wa-black/70">
              <span>購入済み {ownedCount} / {totalCount}</span>
              <span>今すぐ購入可能 {buyableCount} 件</span>
            </div>
            <div className="h-2 rounded-full bg-wa-black/10">
              <div
                className={`h-full rounded-full bg-gradient-to-r from-wa-red/90 to-wa-gold/70 transition-all duration-300 ${collectionProgressClass}`}
                aria-hidden
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-wa-black/20 bg-white/85 px-3 py-1 text-wa-black/80">
              追加購入まで: {cheapestUnownedPrice === null ? "コンプリート済み" : `${coinsToNextPurchase} コイン`}
            </span>
            <span className="rounded-full border border-wa-black/20 bg-white/85 px-3 py-1 text-wa-black/80">
              オブジェクト購入時にコインを消費
            </span>
          </div>

          <details className="rounded-2xl border border-wa-black/15 bg-white/75 p-3 text-xs">
            <summary className="cursor-pointer select-none font-semibold text-wa-black/80">
              テスト用ツール
            </summary>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleResetWalletForTesting}
                className="rounded-md border border-wa-black/25 px-3 py-2 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-wa-black/5 active:translate-y-[1px] active:scale-[0.98]"
              >
                購入状態をリセット
              </button>
              <button
                type="button"
                onClick={() => handleAddTestCoins(500)}
                className="rounded-md border border-wa-black/25 px-3 py-2 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-wa-black/5 active:translate-y-[1px] active:scale-[0.98]"
              >
                +500 コイン
              </button>
              <button
                type="button"
                onClick={handleClearSavedRecordingForTesting}
                className="rounded-md border border-wa-black/25 px-3 py-2 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-wa-black/5 active:translate-y-[1px] active:scale-[0.98]"
              >
                録音データを削除
              </button>
            </div>

            {testingNotice ? (
              <p className="mt-2 rounded-md border border-wa-black/20 bg-wa-white px-3 py-2 text-wa-black/80">
                {testingNotice}
              </p>
            ) : null}
          </details>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-wa-black/20 bg-white/80 p-4 sm:grid-cols-2">
        <div className="rounded-xl border border-wa-black/15 bg-wa-white/70 px-4 py-3">
          <p className="text-xs text-wa-black/70">登録オブジェクト</p>
          <p className="text-2xl font-bold">{totalCount}</p>
        </div>
        <div className="rounded-xl border border-wa-black/15 bg-wa-white/70 px-4 py-3">
          <p className="text-xs text-wa-black/70">試作済み</p>
          <p className="text-2xl font-bold">{prototypeCount}</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {VOICE_ZOO_ENTRIES.map((entry) => {
          const isOwned = wallet.ownedObjectTypes.includes(entry.objectType);
          const playbackRewardCoins = calculatePlaybackRewardCoins(entry.price);

          return (
            <button
              key={entry.objectType}
              type="button"
              onClick={() => handleSelectEntry(entry)}
              aria-haspopup="dialog"
              className="grid gap-3 rounded-2xl border border-wa-black/20 bg-white/80 p-4 text-left transition-all duration-150 ease-out hover:-translate-y-1 hover:border-wa-red/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-full border border-wa-black/20 bg-wa-white text-xl">
                    <span aria-hidden>{entry.icon}</span>
                  </div>
                  <div>
                    <p className="text-lg font-semibold leading-none">{entry.name}</p>
                    <p className="mt-1 text-xs text-wa-black/65">{entry.ruby}</p>
                  </div>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(entry.status)}`}
                >
                  {statusLabel(entry.status)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-wa-black/15 bg-wa-white/70 px-3 py-2 text-sm text-wa-black/80">
                <span className="font-semibold">価格: {entry.price} コイン</span>
                <span className="rounded-full border border-wa-gold/35 bg-wa-gold/10 px-2 py-0.5 text-xs">
                  再生報酬 +{playbackRewardCoins}
                </span>
                {isOwned ? (
                  <span className="rounded-full border border-emerald-600/35 bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900">
                    購入済み
                  </span>
                ) : null}
                <span>タップして解説と購入アクションを表示</span>
              </div>
            </button>
          );
        })}
      </section>

      {selectedEntry ? (
        <div className="fixed inset-0 z-[120] isolate grid place-items-center p-4 sm:p-6">
          <button
            type="button"
            aria-label="モーダルを閉じる"
            className="absolute inset-0 bg-wa-black/70 backdrop-blur-sm"
            onClick={closeModal}
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="voice-zoo-modal-title"
            className="relative z-10 grid max-h-[calc(100dvh-2rem)] w-full max-w-2xl gap-4 overflow-y-auto rounded-2xl border border-wa-black/35 bg-white p-5 text-wa-black shadow-[0_32px_80px_rgba(0,0,0,0.35)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-full border border-wa-black/20 bg-white text-2xl">
                  <span aria-hidden>{selectedEntry.icon}</span>
                </div>
                <div>
                  <h2 id="voice-zoo-modal-title" className="text-xl font-semibold leading-none">
                    {selectedEntry.name}
                  </h2>
                  <p className="mt-1 text-sm text-wa-black/65">{selectedEntry.ruby}</p>
                </div>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(selectedEntry.status)}`}
              >
                {statusLabel(selectedEntry.status)}
              </span>
            </div>

            <dl className="grid gap-3 rounded-xl border border-wa-black/20 bg-white p-4 text-sm">
              <div>
                <dt className="text-xs text-wa-black/65">解説: 音のデザイン</dt>
                <dd className="mt-1 leading-relaxed">{selectedEntry.soundDesign}</dd>
              </div>
              <div>
                <dt className="text-xs text-wa-black/65">解説: 見た目の反応</dt>
                <dd className="mt-1 leading-relaxed">{selectedEntry.visualReaction}</dd>
              </div>
              <div>
                <dt className="text-xs text-wa-black/65">補足メモ</dt>
                <dd className="mt-1 leading-relaxed">{selectedEntry.memo}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-wa-black/20 bg-wa-white px-3 py-1 text-xs font-semibold">
                価格: {selectedEntry.price} コイン
              </span>
              <span className="rounded-full border border-wa-gold/35 bg-wa-gold/10 px-3 py-1 text-xs font-semibold">
                録音再生報酬: +{selectedEntryPlaybackRewardCoins} コイン
              </span>
              {selectedEntryOwned ? (
                <span className="rounded-full border border-emerald-600/35 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
                  購入済み
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handlePlayRecordingForReward}
                disabled={!selectedEntryOwned || !selectedEntryRecordingAudioUrl || isRewardPlaybackActive}
                className={`rounded-md border px-4 py-2 text-sm font-semibold transition-all duration-150 ease-out ${
                  !selectedEntryOwned || !selectedEntryRecordingAudioUrl || isRewardPlaybackActive
                    ? "cursor-not-allowed border-wa-black/20 bg-wa-black/10 text-wa-black/50"
                    : "border-wa-gold/40 bg-wa-gold/15 hover:-translate-y-0.5 hover:bg-wa-gold/25 active:translate-y-[1px] active:scale-[0.98]"
                }`}
              >
                {isRewardPlaybackActive
                  ? "再生中..."
                  : `録音を再生して +${selectedEntryPlaybackRewardCoins} コイン`}
              </button>

              {selectedEntryOwned ? (
                <>
                  <button
                    type="button"
                    onClick={handleRerecordSelectedEntry}
                    className="rounded-md border border-wa-black/45 px-4 py-2 text-sm font-semibold transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-wa-black/5 active:translate-y-[1px] active:scale-[0.98]"
                  >
                    録音しなおす（3秒）
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handlePurchaseSelectedEntry}
                  disabled={!isWalletLoaded || !selectedEntryAffordable}
                  className={`rounded-md border px-4 py-2 text-sm font-semibold transition-all duration-150 ease-out ${
                    !isWalletLoaded || !selectedEntryAffordable
                      ? "cursor-not-allowed border-wa-black/20 bg-wa-black/10 text-wa-black/50"
                      : "border-wa-black bg-wa-red/10 hover:-translate-y-0.5 hover:bg-wa-red/20 active:translate-y-[1px] active:scale-[0.98]"
                  }`}
                >
                  {isWalletLoaded
                    ? `${selectedEntry.price} コインで購入する`
                    : "ウォレットを読み込み中..."}
                </button>
              )}
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-wa-black/40 px-4 py-2 text-sm transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-wa-black/5 active:translate-y-[1px] active:scale-[0.98]"
              >
                閉じる
              </button>
            </div>

            {!selectedEntryOwned && isWalletLoaded && !selectedEntryAffordable ? (
              <p className="rounded-lg border border-wa-red/30 bg-wa-red/10 px-3 py-2 text-xs text-wa-black">
                コイン不足です。必要: {selectedEntry.price} コイン / 所持: {wallet.coins} コイン
              </p>
            ) : null}

            {selectedEntryOwned && !selectedEntryRecordingAudioUrl ? (
              <p className="rounded-lg border border-wa-gold/35 bg-wa-gold/10 px-3 py-2 text-xs text-wa-black">
                再生報酬を受け取るには録音が必要です。「録音しなおす（3秒）」で作成できます。
              </p>
            ) : null}

            {purchaseNotice ? (
              <p className="rounded-lg border border-wa-black/20 bg-wa-white px-3 py-2 text-xs text-wa-black">
                {purchaseNotice}
              </p>
            ) : null}
          </section>
        </div>
      ) : null}

      {recordingEntry ? (
        <div className="fixed inset-0 z-[130] isolate grid place-items-center p-4 sm:p-6">
          <button
            type="button"
            aria-label="録音モーダルを閉じる"
            className="absolute inset-0 bg-wa-black/70 backdrop-blur-sm"
            onClick={isRecording ? undefined : closeRecordingModal}
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="voice-zoo-recording-title"
            className="relative z-10 grid w-full max-w-xl gap-4 rounded-2xl border border-wa-black/35 bg-white p-5 text-wa-black shadow-[0_32px_80px_rgba(0,0,0,0.35)]"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-full border border-wa-black/20 bg-white text-2xl">
                <span aria-hidden>{recordingEntry.icon}</span>
              </div>
              <div>
                <h2 id="voice-zoo-recording-title" className="text-xl font-semibold">
                  {recordingEntry.name}の録音を作成
                </h2>
                <p className="mt-1 text-sm text-wa-black/70">
                  録音時間は約3秒です。録音後、再生報酬を受け取れます。
                </p>
              </div>
            </div>

            <div className="grid gap-2 rounded-xl border border-wa-black/15 bg-wa-white/70 p-4">
              <p className="text-xs text-wa-black/65">録音カウントダウン</p>
              <p className="text-4xl font-bold leading-none">
                {isRecording ? `${recordingCountdown}s` : `${RECORDING_DURATION_SECONDS}s`}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={startThreeSecondRecording}
                disabled={isRecording || !audioOwnerId}
                className={`rounded-md border px-4 py-2 text-sm font-semibold transition-all duration-150 ease-out ${
                  isRecording || !audioOwnerId
                    ? "cursor-not-allowed border-wa-black/20 bg-wa-black/10 text-wa-black/50"
                    : "border-wa-red/35 bg-wa-red/10 hover:-translate-y-0.5 hover:bg-wa-red/20 active:translate-y-[1px] active:scale-[0.98]"
                }`}
              >
                {isRecording ? "録音中..." : "3秒録音を開始"}
              </button>

              {canPlaceFromRecordingModal ? (
                <Link
                  href={`/garden/me?place=${recordingEntry.objectType}`}
                  onClick={closeRecordingModal}
                  className="rounded-md border border-wa-black px-4 py-2 text-sm font-semibold transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-wa-red/10 active:translate-y-[1px] active:scale-[0.98]"
                >
                  録音し終わって配置する
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-md border border-wa-black/20 bg-wa-black/10 px-4 py-2 text-sm font-semibold text-wa-black/50"
                >
                  録音し終わって配置する
                </button>
              )}

              <button
                type="button"
                onClick={closeRecordingModal}
                disabled={isRecording}
                className={`rounded-md border border-wa-black/40 px-4 py-2 text-sm transition-all duration-150 ease-out ${
                  isRecording
                    ? "cursor-not-allowed bg-wa-black/10 text-wa-black/50"
                    : "hover:-translate-y-0.5 hover:bg-wa-black/5 active:translate-y-[1px] active:scale-[0.98]"
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
              <p className="rounded-lg border border-wa-black/20 bg-wa-white px-3 py-2 text-xs text-wa-black">
                {recordingNotice}
              </p>
            ) : null}

            {!recordingEntryAudioUrl ? (
              <p className="rounded-lg border border-wa-gold/35 bg-wa-gold/10 px-3 py-2 text-xs text-wa-black">
                配置するには先に3秒録音を完了してください。
              </p>
            ) : null}
          </section>
        </div>
      ) : null}

      <audio
        ref={rewardAudioRef}
        src={selectedEntryRecordingAudioUrl ?? undefined}
        onEnded={handleRewardPlaybackEnded}
        onPause={handleRewardPlaybackPause}
        preload="metadata"
      />
    </PageShell>
  );
}
