import { EmptyStageDecoration } from "@/components/garden/empty/empty-stage-decoration";
import {
  EmptyStageCharacter,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "@/components/garden/empty/empty-stage-character";
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
  fullscreen?: boolean;
};

export function GardenEmptyStage({
  backgroundId,
  backgroundName,
  seasonId,
  seasonName,
  timeSlotId,
  timeSlotName,
  fullscreen = false,
}: GardenEmptyStageProps) {
  const theme = getBackgroundTheme(backgroundId);
  const seasonOverlayClass = getSeasonOverlayClass(seasonId);
  const timeOverlayClass = getTimeOverlayClass(timeSlotId);
  const isNightPond = backgroundId === "night-pond";
  const stageContainerClass = fullscreen
    ? `relative h-[100dvh] w-full overflow-hidden ${theme.stageClass}`
    : `relative h-[78dvh] min-h-[520px] w-full overflow-hidden rounded-3xl border ${theme.stageClass}`;

  return (
    <section className={stageContainerClass}>
      <EmptyStageCharacter darkMode={isNightPond}>
        <EmptyStageDecoration backgroundId={backgroundId} />
        <div className={`absolute inset-0 ${seasonOverlayClass}`} />
        <div className={`absolute inset-0 ${timeOverlayClass}`} />

        <div
          className={`absolute left-1/2 top-1/2 flex h-[360px] w-[620px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-dashed ${theme.panelClass}`}
        >
          <div className="grid gap-2 px-4 text-center">
            <p className="text-2xl font-semibold">仮キャラクターを配置しました</p>
            <p className="text-sm">まずは移動だけできる状態です。ここから庭の配置機能を足します。</p>
            <p className="text-xs">庭サイズ（仮想）: {WORLD_WIDTH} × {WORLD_HEIGHT}</p>
          </div>
        </div>
      </EmptyStageCharacter>

      <div className="absolute left-4 top-4 z-40 flex flex-wrap gap-2 text-xs">
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

      <p className={`absolute bottom-4 right-4 z-40 text-xs ${theme.noteClass}`}>
        和の静けさをベースに、ここから配置を始めます。
      </p>
    </section>
  );
}
