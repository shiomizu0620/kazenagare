type FurinCanvasProps = {
  isListening: boolean;
  volume: number;
};

export function FurinCanvas({ isListening, volume }: FurinCanvasProps) {
  const meterHeight = `${Math.max(8, Math.round(volume * 100))}%`;

  return (
    <section className="rounded-lg border border-wa-black/20 bg-white/70 p-4">
      <p className="mb-3 text-sm">
        {isListening ? "音を拾っています" : "待機中です"}
      </p>
      <div className="flex h-32 items-end rounded bg-wa-black/10 p-2">
        <div
          className="w-8 rounded bg-wa-red transition-all duration-100"
          style={{ height: meterHeight }}
        />
      </div>
    </section>
  );
}
