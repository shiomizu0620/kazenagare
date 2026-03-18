"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GARDEN_SEASONS,
  type GardenOption,
  type GardenSetupSelection,
} from "@/lib/garden/setup/options";
import { getSupabaseClient, getSupabaseSessionOrNull } from "@/lib/supabase/client";

const FIXED_BACKGROUND_ID = "garden-all";
const FIXED_TIME_SLOT_ID = "daytime";
const DISPLAY_NAME_MAX_LENGTH = 12;

type GardenSetupFormProps = {
  nextPath?: string;
  submitLabel?: string;
  onSubmit?: (selection: GardenSetupSelection) => Promise<void> | void;
};

type SeasonUiMeta = {
  icon: string;
  copy: string;
  accentClass: string;
  selectedBorderClass: string;
  selectedBackgroundClass: string;
  badgeClass: string;
};

const DEFAULT_SEASON_UI: SeasonUiMeta = {
  icon: "🍃",
  copy: "静かな風の流れを感じる情景です。",
  accentClass: "bg-gradient-to-r from-slate-300 to-slate-200",
  selectedBorderClass: "border-slate-300",
  selectedBackgroundClass: "bg-slate-50",
  badgeClass: "border-slate-300 bg-white text-slate-900",
};

const SEASON_UI_BY_ID: Record<string, SeasonUiMeta> = {
  spring: {
    icon: "🌸",
    copy: "やわらかな光と花の気配で、軽やかな庭になります。",
    accentClass: "bg-gradient-to-r from-rose-300 to-amber-200",
    selectedBorderClass: "border-rose-300",
    selectedBackgroundClass: "bg-rose-50",
    badgeClass: "border-rose-300 bg-white text-rose-900",
  },
  summer: {
    icon: "🌿",
    copy: "青々とした空気感で、瑞々しく澄んだ印象になります。",
    accentClass: "bg-gradient-to-r from-emerald-300 to-lime-200",
    selectedBorderClass: "border-emerald-300",
    selectedBackgroundClass: "bg-emerald-50",
    badgeClass: "border-emerald-300 bg-white text-emerald-900",
  },
  autumn: {
    icon: "🍁",
    copy: "落ち着いた色合いで、しっとりと深みのある庭になります。",
    accentClass: "bg-gradient-to-r from-amber-300 to-orange-300",
    selectedBorderClass: "border-amber-300",
    selectedBackgroundClass: "bg-amber-50",
    badgeClass: "border-amber-300 bg-white text-amber-900",
  },
  winter: {
    icon: "❄️",
    copy: "静寂と透明感を強めた、凛とした庭になります。",
    accentClass: "bg-gradient-to-r from-sky-300 to-blue-300",
    selectedBorderClass: "border-sky-300",
    selectedBackgroundClass: "bg-sky-50",
    badgeClass: "border-sky-300 bg-white text-sky-900",
  },
};

function getSeasonUi(optionId: string): SeasonUiMeta {
  return SEASON_UI_BY_ID[optionId] ?? DEFAULT_SEASON_UI;
}

type OptionGroupProps = {
  label: string;
  options: GardenOption[];
  selectedId: string;
  onSelect: (optionId: string) => void;
};

function OptionGroup({
  label,
  options,
  selectedId,
  onSelect,
}: OptionGroupProps) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{label}</h2>
        <p className="text-[11px] text-wa-black/65">1つ選択</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const isSelected = option.id === selectedId;
          const seasonUi = getSeasonUi(option.id);

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              className={`group relative grid gap-3 overflow-hidden rounded-2xl border-2 p-4 text-left transition-all duration-200 ease-out active:translate-y-[1px] active:scale-[0.98] ${
                isSelected
                  ? `${seasonUi.selectedBorderClass} ${seasonUi.selectedBackgroundClass} text-wa-black shadow-[0_12px_32px_rgba(43,43,43,0.12)]`
                  : "border-wa-black/15 bg-wa-white/95 text-wa-black hover:-translate-y-0.5 hover:border-wa-red/40 hover:bg-wa-red/5"
              }`}
            >
              <div className={`absolute inset-x-0 top-0 h-1 ${seasonUi.accentClass}`} />

              <div className="flex items-start justify-between gap-3">
                <span className="text-2xl leading-none" aria-hidden>
                  {seasonUi.icon}
                </span>

                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none ${
                    isSelected
                      ? "border-wa-black/35 bg-wa-black text-wa-white"
                      : "border-wa-black/20 bg-white text-wa-black"
                  }`}
                >
                  {isSelected ? "選択中" : "選択する"}
                </span>
              </div>

              <div className="grid gap-1">
                <span
                  className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${seasonUi.badgeClass}`}
                >
                  {option.name}
                </span>
                <p className="text-xs leading-relaxed text-wa-black/75">{seasonUi.copy}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function GardenSetupForm({
  nextPath = "/garden/empty",
  submitLabel = "この設定で次へ進む",
  onSubmit,
}: GardenSetupFormProps) {
  const router = useRouter();
  const [selectedSeasonId, setSelectedSeasonId] = useState(
    GARDEN_SEASONS[0]?.id ?? "",
  );
  const [displayName, setDisplayName] = useState("");
  const [isNameLoading, setIsNameLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedSeasonName =
    GARDEN_SEASONS.find((option) => option.id === selectedSeasonId)?.name ?? "";
  const selectedSeasonUi = getSeasonUi(selectedSeasonId);

  const nextHref = useMemo(() => {
    const params = new URLSearchParams({
      background: FIXED_BACKGROUND_ID,
      season: selectedSeasonId,
      time: FIXED_TIME_SLOT_ID,
    });

    return `${nextPath}?${params.toString()}`;
  }, [nextPath, selectedSeasonId]);

  const selectedSetting = useMemo<GardenSetupSelection>(
    () => ({
      backgroundId: FIXED_BACKGROUND_ID,
      seasonId: selectedSeasonId,
      timeSlotId: FIXED_TIME_SLOT_ID,
    }),
    [selectedSeasonId],
  );

  useEffect(() => {
    let isCancelled = false;

    const loadDisplayName = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        if (!isCancelled) {
          setIsNameLoading(false);
        }
        return;
      }

      const session = await getSupabaseSessionOrNull(supabase);
      if (isCancelled) {
        return;
      }

      const userMetadata = session?.user.user_metadata as Record<string, unknown> | undefined;
      const currentDisplayName = userMetadata?.display_name;
      if (typeof currentDisplayName === "string") {
        setDisplayName(currentDisplayName);
      }

      setIsNameLoading(false);
    };

    void loadDisplayName();

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleProceed = async () => {
    if (isSubmitting) {
      return;
    }

    const trimmedDisplayName = displayName.trim();
    if (!trimmedDisplayName) {
      setSubmitError("お名前を入力してください。");
      return;
    }

    if (trimmedDisplayName.length > DISPLAY_NAME_MAX_LENGTH) {
      setSubmitError(`お名前は${DISPLAY_NAME_MAX_LENGTH}文字以内で入力してください。`);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const session = await getSupabaseSessionOrNull(supabase);
        if (session?.user) {
          const userMetadata = session.user.user_metadata as Record<string, unknown> | undefined;
          const currentDisplayName =
            typeof userMetadata?.display_name === "string" ? userMetadata.display_name : "";

          if (currentDisplayName.trim() !== trimmedDisplayName) {
            const { error } = await supabase.auth.updateUser({
              data: {
                display_name: trimmedDisplayName,
              },
            });

            if (error) {
              throw new Error(`名前の保存に失敗しました: ${error.message}`);
            }
          }
        }
      }

      await onSubmit?.(selectedSetting);
      router.push(nextHref);
    } catch (error) {
      const message = error instanceof Error ? error.message : "設定の保存に失敗しました。もう一度お試しください。";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-wa-black/20 bg-white/95 p-6 shadow-[0_20px_55px_rgba(43,43,43,0.08)] sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-12 h-44 w-44 rounded-full bg-wa-gold/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-wa-red/12 blur-3xl" />

      <div className="relative grid gap-6">
        <section className="relative overflow-hidden rounded-2xl border border-wa-gold/40 bg-[linear-gradient(145deg,rgba(255,255,255,0.96)_0%,rgba(247,236,217,0.92)_55%,rgba(255,255,255,0.98)_100%)] p-5">
          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border border-wa-gold/35" />

          <div className="grid gap-2">
            <span className="inline-flex w-fit items-center rounded-full border border-wa-black/20 bg-white/90 px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-wa-black/75">
              SEASON SETUP
            </span>
            <h2 className="text-2xl font-bold leading-tight sm:text-3xl">
              今日の庭の空気を、
              <br className="hidden sm:block" />
              季節で選ぼう
            </h2>
            <p className="text-sm leading-relaxed text-wa-black/75">
              背景は「庭」、時間帯は「昼」で固定されています。いまは季節だけを選べばすぐに始められます。
            </p>
          </div>
        </section>

        <OptionGroup
          label="季節を選択"
          options={GARDEN_SEASONS}
          selectedId={selectedSeasonId}
          onSelect={setSelectedSeasonId}
        />

        <section className="grid gap-3 rounded-2xl border border-wa-black/20 bg-white/95 p-4 text-sm">
          <p className="font-semibold">現在の設定</p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-semibold ${selectedSeasonUi.badgeClass}`}
            >
              <span aria-hidden>{selectedSeasonUi.icon}</span>
              <span>{selectedSeasonName}</span>
            </span>
          </div>
          <p className="text-xs leading-relaxed text-wa-black/70">{selectedSeasonUi.copy}</p>
        </section>

        <section className="grid gap-3 rounded-2xl border border-wa-black/20 bg-white/95 p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">お名前</p>
            <span className="text-[11px] text-wa-black/60">庭の表示名</span>
          </div>
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="例: 壱萬ノ利休"
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            disabled={isSubmitting || isNameLoading}
            className="rounded-lg border border-wa-black/20 bg-white px-4 py-2 text-wa-black placeholder:text-wa-black/50 disabled:opacity-60"
          />
          <p className="text-xs text-wa-black/60">{displayName.length}/{DISPLAY_NAME_MAX_LENGTH}</p>
        </section>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleProceed}
            disabled={isSubmitting || isNameLoading}
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-wa-black bg-wa-black px-6 py-2.5 text-sm font-semibold text-wa-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-wa-red active:translate-y-[1px] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{isSubmitting ? "処理中..." : submitLabel}</span>
            <span aria-hidden>→</span>
          </button>
          <p className="text-xs text-wa-black/70">選んだ季節で庭を開きます。</p>
        </div>

        {submitError ? (
          <p className="text-xs text-wa-red">{submitError}</p>
        ) : null}
      </div>
    </div>
  );
}
