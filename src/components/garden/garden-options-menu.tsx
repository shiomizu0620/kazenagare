"use client";

import Link from "next/link";
import { useId, useState } from "react";

export type GardenOptionAction = {
  href: string;
  label: string;
  description?: string;
};

type GardenOptionsMenuProps = {
  actions: GardenOptionAction[];
  buttonLabel?: string;
  title?: string;
  darkMode?: boolean;
};

export function GardenOptionsMenu({
  actions,
  buttonLabel = "オプション",
  title = "庭のメニュー",
  darkMode = false,
}: GardenOptionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();

  const triggerClass = `inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98] ${
    darkMode
      ? "border-wa-white/45 bg-wa-black/60 text-wa-white hover:bg-wa-black/80"
      : "border-wa-black/25 bg-wa-white/85 text-wa-black hover:bg-wa-white"
  }`;

  const panelClass = `grid gap-3 rounded-2xl border p-3 shadow-xl backdrop-blur-sm transition-all duration-150 ${
    isOpen
      ? "pointer-events-auto translate-y-0 opacity-100"
      : "pointer-events-none -translate-y-1 opacity-0"
  } ${
    darkMode
      ? "border-wa-white/30 bg-wa-black/70 text-wa-white"
      : "border-wa-black/20 bg-wa-white/95 text-wa-black"
  }`;

  const itemClass = `grid gap-1 rounded-xl border px-3 py-2 text-left transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98] ${
    darkMode
      ? "border-wa-white/20 bg-wa-white/5 hover:bg-wa-white/10"
      : "border-wa-black/15 bg-wa-white hover:bg-wa-red/10"
  }`;

  const descriptionClass = `text-xs ${darkMode ? "text-wa-white/75" : "text-wa-black/70"}`;

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          aria-label="オプションメニューを閉じる"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-[60] bg-wa-black/20"
        />
      ) : null}

      <div className="pointer-events-none absolute right-4 top-4 z-[70] flex flex-col items-end gap-2">
        <button
          type="button"
          aria-controls={panelId}
          onClick={() => setIsOpen((value) => !value)}
          className={`pointer-events-auto ${triggerClass}`}
        >
          {isOpen ? "閉じる" : buttonLabel}
        </button>

        <div id={panelId} className={`w-[min(88vw,22rem)] ${panelClass}`}>
          <p className="text-sm font-semibold">{title}</p>
          <div className="grid gap-2">
            {actions.map((action) => (
              <Link
                key={`${action.href}-${action.label}`}
                href={action.href}
                onClick={() => setIsOpen(false)}
                className={itemClass}
              >
                <span className="text-sm font-semibold">{action.label}</span>
                {action.description ? (
                  <span className={descriptionClass}>{action.description}</span>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
