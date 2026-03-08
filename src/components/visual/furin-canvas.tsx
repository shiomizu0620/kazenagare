type FurinCanvasProps = {
  isListening: boolean;
  volume: number;
};

const METER_HEIGHT_CLASSES = [
  "h-[8%]",
  "h-[16%]",
  "h-[24%]",
  "h-[32%]",
  "h-[40%]",
  "h-[48%]",
  "h-[56%]",
  "h-[64%]",
  "h-[72%]",
  "h-[84%]",
  "h-[100%]",
];

export function FurinCanvas({ isListening, volume }: FurinCanvasProps) {
  const meterLevel = Math.min(
    METER_HEIGHT_CLASSES.length - 1,
    Math.max(0, Math.round(volume * (METER_HEIGHT_CLASSES.length - 1))),
  );
  const meterHeightClass = METER_HEIGHT_CLASSES[meterLevel];

  return (
    <section className="rounded-lg border border-wa-black/20 bg-white/70 p-4">
      <p className="mb-3 text-sm">
        {isListening ? "音を拾っています" : "待機中です"}
      </p>
      <div className="flex h-32 items-end rounded bg-wa-black/10 p-2">
        <div
          className={`w-8 rounded bg-wa-red transition-all duration-100 ${meterHeightClass}`}
        />
      </div>
    </section>
  );
}
