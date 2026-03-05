type EmptyStageDecorationProps = {
  backgroundId: string;
};

function BambooForestDecoration() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute bottom-0 left-[12%] top-0 w-2 rounded-full bg-wa-gold/25" />
      <div className="absolute bottom-0 left-[24%] top-0 w-2 rounded-full bg-wa-gold/25" />
      <div className="absolute bottom-0 left-[36%] top-0 w-2 rounded-full bg-wa-gold/25" />
      <div className="absolute bottom-0 left-[48%] top-0 w-2 rounded-full bg-wa-gold/25" />
      <div className="absolute bottom-0 left-[60%] top-0 w-2 rounded-full bg-wa-gold/25" />
      <div className="absolute bottom-0 left-[72%] top-0 w-2 rounded-full bg-wa-gold/25" />
      <div className="absolute bottom-0 left-[84%] top-0 w-2 rounded-full bg-wa-gold/25" />
    </div>
  );
}

function NightPondDecoration() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute right-14 top-10 h-20 w-20 rounded-full border border-wa-white/40 bg-wa-white/20" />
      <div className="absolute bottom-20 left-1/2 h-36 w-72 -translate-x-1/2 rounded-full border border-wa-white/20" />
      <div className="absolute bottom-16 left-1/2 h-44 w-96 -translate-x-1/2 rounded-full border border-wa-white/15" />
    </div>
  );
}

function MistyTempleDecoration() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute left-8 top-12 h-16 w-64 rounded-full bg-wa-white/70 blur-xl" />
      <div className="absolute right-16 top-24 h-20 w-72 rounded-full bg-wa-white/60 blur-xl" />
      <div className="absolute bottom-16 left-20 h-24 w-80 rounded-full bg-wa-white/60 blur-xl" />
      <div className="absolute bottom-20 left-1/2 h-20 w-64 -translate-x-1/2 rounded-t-3xl border border-wa-black/15 bg-wa-black/5" />
    </div>
  );
}

export function EmptyStageDecoration({ backgroundId }: EmptyStageDecorationProps) {
  if (backgroundId === "bamboo-forest") {
    return <BambooForestDecoration />;
  }

  if (backgroundId === "night-pond") {
    return <NightPondDecoration />;
  }

  return <MistyTempleDecoration />;
}
