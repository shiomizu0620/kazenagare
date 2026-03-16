"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GARDEN_SEASONS,
  type GardenOption,
  type GardenSetupSelection,
} from "@/lib/garden/setup/options";

const FIXED_BACKGROUND_ID = "garden-all";
const FIXED_TIME_SLOT_ID = "daytime";

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
  const [selectedSeasonId, setSelectedSeasonId] = useState(
    GARDEN_SEASONS[0]?.id ?? "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedSeasonName =
    GARDEN_SEASONS.find((option) => option.id === selectedSeasonId)?.name ?? "";

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
        季節を選んで庭に入ろう。
      </div>

      <OptionGroup
        label="季節"
        icon="🍁"
        options={GARDEN_SEASONS}
        selectedId={selectedSeasonId}
        onSelect={setSelectedSeasonId}
      />

      <div className="grid gap-3 rounded-xl border border-wa-black/20 bg-wa-white/90 p-4 text-sm">
        <p className="font-semibold">いまの選択</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-wa-black/20 px-3 py-1">
            季節: {selectedSeasonName}
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
