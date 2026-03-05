"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GARDEN_BACKGROUNDS,
  GARDEN_SEASONS,
  GARDEN_TIME_SLOTS,
  type GardenOption,
  type GardenSetupSelection,
} from "@/lib/garden/setup/options";

type GardenSetupFormProps = {
  nextPath?: string;
  submitLabel?: string;
  onSubmit?: (selection: GardenSetupSelection) => Promise<void> | void;
};

type OptionGroupProps = {
  label: string;
  icon: string;
  options: GardenOption[];
  selectedId: string;
  onSelect: (optionId: string) => void;
};

function OptionGroup({
  label,
  icon,
  options,
  selectedId,
  onSelect,
}: OptionGroupProps) {
  return (
    <section className="grid gap-3 rounded-xl border border-wa-black/20 bg-wa-white/80 p-4">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <span aria-hidden>{icon}</span>
        <span>{label}</span>
      </h2>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = option.id === selectedId;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-all duration-150 ease-out active:translate-y-[1px] active:scale-[0.98] ${
                isSelected
                  ? "border-wa-red bg-wa-red text-wa-white shadow-sm"
                  : "border-wa-black/20 bg-wa-white text-wa-black hover:-translate-y-0.5 hover:border-wa-red/50 hover:bg-wa-red/10"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isSelected ? "bg-wa-white" : "bg-wa-gold"
                }`}
              />
              {option.name}
              {isSelected ? (
                <span className="ml-2 rounded border border-wa-white/50 px-1.5 py-0.5 text-[10px] leading-none">
                  選択中
                </span>
              ) : null}
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
  const [selectedBackgroundId, setSelectedBackgroundId] = useState(
    GARDEN_BACKGROUNDS[0]?.id ?? "",
  );
  const [selectedSeasonId, setSelectedSeasonId] = useState(
    GARDEN_SEASONS[0]?.id ?? "",
  );
  const [selectedTimeSlotId, setSelectedTimeSlotId] = useState(
    GARDEN_TIME_SLOTS[0]?.id ?? "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedBackgroundName =
    GARDEN_BACKGROUNDS.find((option) => option.id === selectedBackgroundId)?.name ?? "";
  const selectedSeasonName =
    GARDEN_SEASONS.find((option) => option.id === selectedSeasonId)?.name ?? "";
  const selectedTimeSlotName =
    GARDEN_TIME_SLOTS.find((option) => option.id === selectedTimeSlotId)?.name ?? "";

  const nextHref = useMemo(() => {
    const params = new URLSearchParams({
      background: selectedBackgroundId,
      season: selectedSeasonId,
      time: selectedTimeSlotId,
    });

    return `${nextPath}?${params.toString()}`;
  }, [nextPath, selectedBackgroundId, selectedSeasonId, selectedTimeSlotId]);

  const selectedSetting = useMemo<GardenSetupSelection>(
    () => ({
      backgroundId: selectedBackgroundId,
      seasonId: selectedSeasonId,
      timeSlotId: selectedTimeSlotId,
    }),
    [selectedBackgroundId, selectedSeasonId, selectedTimeSlotId],
  );

  const handleProceed = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onSubmit?.(selectedSetting);
      router.push(nextHref);
    } catch {
      setSubmitError("設定の保存に失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 rounded-2xl border border-wa-black/20 bg-white/80 p-6">
      <div className="rounded-xl border border-wa-gold/40 bg-wa-gold/10 px-4 py-3 text-sm">
        お庭の空気感を、かわいく選んでいこう。
      </div>

      <OptionGroup
        label="庭の種類"
        icon="🎋"
        options={GARDEN_BACKGROUNDS}
        selectedId={selectedBackgroundId}
        onSelect={setSelectedBackgroundId}
      />

      <OptionGroup
        label="季節"
        icon="🍁"
        options={GARDEN_SEASONS}
        selectedId={selectedSeasonId}
        onSelect={setSelectedSeasonId}
      />

      <OptionGroup
        label="時間帯"
        icon="🕰️"
        options={GARDEN_TIME_SLOTS}
        selectedId={selectedTimeSlotId}
        onSelect={setSelectedTimeSlotId}
      />

      <div className="grid gap-3 rounded-xl border border-wa-black/20 bg-wa-white/90 p-4 text-sm">
        <p className="font-semibold">いまの選択</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-wa-black/20 px-3 py-1">
            背景: {selectedBackgroundName}
          </span>
          <span className="rounded-full border border-wa-black/20 px-3 py-1">
            季節: {selectedSeasonName}
          </span>
          <span className="rounded-full border border-wa-black/20 px-3 py-1">
            時間帯: {selectedTimeSlotName}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleProceed}
          disabled={isSubmitting}
          className="inline-flex items-center rounded-full border-2 border-wa-black bg-wa-black px-5 py-2 text-sm font-semibold text-wa-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-wa-red active:translate-y-[1px] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "処理中..." : submitLabel}
        </button>
        <p className="self-center text-xs text-wa-black/70">
          後続画面へ background / season / time をクエリで渡します。
        </p>
        {submitError ? (
          <p className="w-full text-xs text-wa-red">{submitError}</p>
        ) : null}
      </div>
    </div>
  );
}
