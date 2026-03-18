export default function GardenEmptyLoading() {
  return (
    <main className="min-h-[100dvh] bg-[#0a1018] text-white">
      <section className="mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col items-center justify-center gap-6 px-6">
        <div className="text-center">
          <p className="text-xs tracking-[0.2em] text-white/60">KAZENAGARE</p>
          <h1 className="mt-2 text-xl font-semibold tracking-[0.08em]">
            あなたの庭を開いています...
          </h1>
        </div>

        <div className="h-2 w-full max-w-xl overflow-hidden rounded-full border border-white/20 bg-white/10">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-emerald-300/70 via-cyan-200/90 to-emerald-300/70" />
        </div>

        <p className="text-sm text-white/80">庭の情景を準備しています…</p>
      </section>
    </main>
  );
}
