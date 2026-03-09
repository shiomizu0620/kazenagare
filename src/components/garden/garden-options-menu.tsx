"use client";

import Link from "next/link";
import { useId, useState } from "react";
import {
  type VoiceZooEntryStatus,
  VOICE_ZOO_ENTRIES,
} from "@/lib/voice-zoo/catalog";
import {
  calculatePlaybackRewardCoins,
  parseVoiceZooWallet,
  VOICE_ZOO_WALLET_STORAGE_KEY,
} from "@/lib/voice-zoo/wallet";
import type { ObjectType } from "@/types/garden";

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
  const [ownedCatalogObjectTypes, setOwnedCatalogObjectTypes] = useState<ObjectType[]>([]);
  const [selectedCatalogObjectType, setSelectedCatalogObjectType] =
    useState<ObjectType>(VOICE_ZOO_ENTRIES[0]?.objectType ?? "furin");
  const panelId = useId();
  const catalogPanelId = useId();

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
  const catalogSlots = Array.from({ length: 3 }, (_, index) =>
    VOICE_ZOO_ENTRIES[index] ?? null,
  );

  const closeAllPanels = () => {
    setIsOpen(false);
    setIsCatalogOpen(false);
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
        <div className="fixed inset-0 z-[70] grid place-items-center p-4 sm:p-6">
          <section
            id={catalogPanelId}
            role="dialog"
            aria-modal="true"
            aria-label="図鑑"
            className={`pointer-events-auto relative w-full max-w-5xl overflow-hidden rounded-3xl border shadow-[0_34px_90px_rgba(0,0,0,0.45)] [transform-style:preserve-3d] animate-[kazenagare-catalog-burst_220ms_cubic-bezier(0.2,1,0.36,1)] ${
              darkMode
                ? "border-wa-white/35 bg-[linear-gradient(160deg,rgba(23,23,23,0.98)_0%,rgba(35,35,35,0.95)_52%,rgba(15,15,15,0.98)_100%)] text-wa-white"
                : "border-wa-black/25 bg-[linear-gradient(160deg,rgba(255,250,242,0.99)_0%,rgba(248,236,220,0.96)_54%,rgba(255,249,240,0.99)_100%)] text-wa-black"
            }`}
          >
            <div className="grid gap-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-wa-black/10 pb-3 dark:border-wa-white/15">
                <div>
                  <p className={`text-xs ${darkMode ? "text-wa-white/75" : "text-wa-black/65"}`}>
                    KAZENAGARE Collection
                  </p>
                  <h2 className="text-2xl font-semibold leading-none">和の音オブジェクト図鑑</h2>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCatalogOpen(false)}
                  className={`rounded-full border px-4 py-2 text-sm transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98] ${
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
                  className={`relative grid overflow-hidden rounded-2xl border md:grid-cols-[1.05fr_0.95fr] ${
                    darkMode
                      ? "border-wa-white/20 bg-wa-black/15"
                      : "border-wa-black/15 bg-white/55"
                  }`}
                >
                  <div
                    className={`grid gap-4 border-b p-4 [transform-origin:right_center] [transform-style:preserve-3d] animate-[kazenagare-catalog-left-open_360ms_cubic-bezier(0.18,1,0.32,1)] md:border-b-0 md:border-r ${
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
                            coins
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
                          <span aria-hidden>{selectedCatalogEntry.icon}</span>
                        </div>
                        <p className="text-lg font-semibold leading-none">{selectedCatalogEntry.name}</p>
                        <p className={`text-xs ${darkMode ? "text-wa-white/75" : "text-wa-black/65"}`}>
                          {selectedCatalogEntry.ruby}
                        </p>
                      </div>
                    </div>

                    <Link
                      href="/voice-zoo"
                      onClick={closeAllPanels}
                      className={`mt-auto inline-flex items-center justify-center rounded-xl border px-4 py-3 text-sm font-semibold transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98] ${
                        isSelectedCatalogObjectOwned
                          ? darkMode
                            ? "border-wa-white/40 bg-wa-white/10 hover:bg-wa-white/20"
                            : "border-wa-black/25 bg-wa-red/10 hover:bg-wa-red/20"
                          : darkMode
                            ? "border-wa-gold/55 bg-wa-gold/20 text-wa-white hover:bg-wa-gold/30"
                            : "border-wa-gold/50 bg-wa-gold/20 text-wa-black hover:bg-wa-gold/30"
                      }`}
                    >
                      {isSelectedCatalogObjectOwned
                        ? "再録音（1コインかかる）"
                        : `購入する（${selectedCatalogEntry.price}コイン）`}
                    </Link>
                  </div>

                  <div
                    className={`grid content-start gap-4 p-4 [transform-origin:left_center] [transform-style:preserve-3d] animate-[kazenagare-catalog-right-open_360ms_cubic-bezier(0.18,1,0.32,1)] ${
                      darkMode
                        ? "bg-[linear-gradient(240deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.01)_100%)]"
                        : "bg-[linear-gradient(240deg,rgba(255,255,255,0.84)_0%,rgba(255,255,255,0.58)_100%)]"
                    }`}
                  >
                    <div>
                      <p className={`text-xs ${darkMode ? "text-wa-white/75" : "text-wa-black/65"}`}>
                        オブジェクト
                      </p>
                      <p className="text-sm font-semibold">サムネイルを押して左ページを切り替え</p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {catalogSlots.map((entry, index) => {
                        if (!entry) {
                          return (
                            <div
                              key={`catalog-slot-empty-${index}`}
                              className={`grid min-h-24 place-items-center rounded-xl border text-center text-xs ${
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
                            onClick={() => setSelectedCatalogObjectType(entry.objectType)}
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
                            <span className="text-2xl" aria-hidden>
                              {entry.icon}
                            </span>
                            <span className="text-[11px] font-semibold leading-tight">{entry.name}</span>
                          </button>
                        );
                      })}
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
                  </div>

                  <div
                    className={`pointer-events-none absolute inset-y-0 left-1/2 hidden w-px md:block ${
                      darkMode ? "bg-wa-white/18" : "bg-wa-black/15"
                    }`}
                  />
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
