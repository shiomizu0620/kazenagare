import { EmptyStageDecoration } from "@/components/garden/empty/empty-stage-decoration";
import { EmptyStageCharacter } from "@/components/garden/empty/empty-stage-character";
import {
  getBackgroundTheme,
  getSeasonOverlayClass,
  getTimeOverlayClass,
} from "@/components/garden/empty/empty-stage-theme";

type GardenEmptyStageProps = {
  backgroundId: string;
  backgroundName: string;
  seasonId: string;
  seasonName: string;
  timeSlotId: string;
  timeSlotName: string;
};

export function GardenEmptyStage({
  backgroundId,
  backgroundName,
  seasonId,
  seasonName,
  timeSlotId,
  timeSlotName,
}: GardenEmptyStageProps) {
  const theme = getBackgroundTheme(backgroundId);
  const seasonOverlayClass = getSeasonOverlayClass(seasonId);
  const timeOverlayClass = getTimeOverlayClass(timeSlotId);
  const isNightPond = backgroundId === "night-pond";

  return (
    <section
      className={`relative h-[78dvh] min-h-[520px] w-full overflow-hidden rounded-3xl border ${theme.stageClass}`}
    >
      <EmptyStageDecoration backgroundId={backgroundId} />
      <div className={`pointer-events-none absolute inset-0 ${seasonOverlayClass}`} />
      <div className={`pointer-events-none absolute inset-0 ${timeOverlayClass}`} />
      <EmptyStageCharacter darkMode={isNightPond} />

      <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2 text-xs">
        <span className={`rounded-full border px-3 py-1 ${theme.chipClass}`}>
          背景: {backgroundName}
        </span>
        <span className={`rounded-full border px-3 py-1 ${theme.chipClass}`}>
          季節: {seasonName}
        </span>
        <span className={`rounded-full border px-3 py-1 ${theme.chipClass}`}>
          時間帯: {timeSlotName}
        </span>
      </div>

      <div
        className={`absolute inset-6 z-10 flex items-center justify-center rounded-2xl border border-dashed ${theme.panelClass}`}
      >
        <div className="grid gap-2 px-4 text-center">
          <p className="text-2xl font-semibold">仮キャラクターを配置しました</p>
          <p className="text-sm">まずは移動だけできる状態です。ここから庭の配置機能を足します。</p>
          <p className="text-xs">庭サイズ（仮想）: 1600 × 900</p>
        </div>
      </div>

      <p className={`absolute bottom-4 right-4 z-10 text-xs ${theme.noteClass}`}>
        和の静けさをベースに、ここから配置を始めます。
      </p>
    </section>
  );
}
