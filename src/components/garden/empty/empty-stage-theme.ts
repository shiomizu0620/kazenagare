type EmptyStageTheme = {
  stageClass: string;
  chipClass: string;
  panelClass: string;
  noteClass: string;
};

const DEFAULT_THEME: EmptyStageTheme = {
  stageClass: "border-wa-black/20 bg-wa-white text-wa-black",
  chipClass: "border-black/25 bg-white text-neutral-900 shadow-sm",
  panelClass: "border-wa-black/25 bg-wa-white/40",
  noteClass: "text-wa-black/70",
};

const BACKGROUND_THEME: Record<string, EmptyStageTheme> = {
  "bamboo-forest": {
    stageClass: "border-wa-gold/35 bg-wa-white text-wa-black",
    chipClass: "border-black/25 bg-white text-neutral-900 shadow-sm",
    panelClass: "border-wa-gold/40 bg-wa-white/55",
    noteClass: "text-wa-black/80",
  },
  "night-pond": {
    stageClass: "border-wa-white/25 bg-wa-black text-wa-white",
    chipClass: "border-white/40 bg-neutral-900 text-white shadow-sm",
    panelClass: "border-wa-white/30 bg-wa-white/5",
    noteClass: "text-wa-white/80",
  },
  "misty-temple": {
    stageClass: "border-wa-black/20 bg-wa-white text-wa-black",
    chipClass: "border-black/25 bg-white text-neutral-900 shadow-sm",
    panelClass: "border-wa-black/25 bg-wa-white/40",
    noteClass: "text-wa-black/70",
  },
  "garden-all": {
    stageClass: "border-wa-black/20 bg-wa-white text-wa-black bg-cover bg-center",
    chipClass: "border-black/25 bg-white text-neutral-900 shadow-sm",
    panelClass: "border-wa-black/25 bg-wa-white/40",
    noteClass: "text-wa-black/70",
  },
};

const SEASON_OVERLAY_CLASS: Record<string, string> = {
  spring: "bg-gradient-to-b from-wa-red/10 via-transparent to-transparent",
  summer: "bg-gradient-to-b from-wa-gold/10 via-transparent to-transparent",
  autumn: "bg-gradient-to-t from-wa-red/10 via-transparent to-transparent",
  winter: "bg-gradient-to-b from-wa-white/30 via-transparent to-transparent",
};

const TIME_OVERLAY_CLASS: Record<string, string> = {
  morning: "bg-gradient-to-br from-wa-white/40 via-transparent to-transparent",
  daytime: "bg-gradient-to-b from-wa-white/10 via-transparent to-transparent",
  evening: "bg-gradient-to-br from-wa-gold/20 via-wa-red/10 to-transparent",
  night: "bg-gradient-to-b from-wa-black/40 via-wa-black/20 to-wa-black/50",
};

export function getBackgroundTheme(backgroundId: string): EmptyStageTheme {
  return BACKGROUND_THEME[backgroundId] ?? DEFAULT_THEME;
}

export function getSeasonOverlayClass(seasonId: string): string {
  return SEASON_OVERLAY_CLASS[seasonId] ?? "";
}

export function getTimeOverlayClass(timeSlotId: string): string {
  return TIME_OVERLAY_CLASS[timeSlotId] ?? "";
}
