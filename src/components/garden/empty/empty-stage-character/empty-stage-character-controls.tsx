import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

type EmptyStageCharacterControlsProps = {
  allowObjectPlacement: boolean;
  walletCoins: number;
  walletGainPopup: {
    id: string;
    coins: number;
  } | null;
  resetPanelClass: string;
  resetButtonClass: string;
  onResetToStart: () => void;
  mobileStickPanelClass: string;
  darkMode: boolean;
  stickPadRef: RefObject<HTMLDivElement | null>;
  stickKnobRef: RefObject<HTMLDivElement | null>;
  onStickPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onStickPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onStickPointerEnd: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export function EmptyStageCharacterControls({
  allowObjectPlacement,
  walletCoins,
  walletGainPopup,
  resetPanelClass,
  resetButtonClass,
  onResetToStart,
  mobileStickPanelClass,
  darkMode,
  stickPadRef,
  stickKnobRef,
  onStickPointerDown,
  onStickPointerMove,
  onStickPointerEnd,
}: EmptyStageCharacterControlsProps) {
  return (
    <>
      <div className={resetPanelClass}>
        <button
          type="button"
          onClick={onResetToStart}
          className={resetButtonClass}
        >
          開始地点に戻る
        </button>
      </div>

      {allowObjectPlacement ? (
        <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+3.6rem)] left-3 z-50 w-[min(42vw,10rem)] sm:bottom-3 sm:left-1/2 sm:w-[min(86vw,19rem)] sm:-translate-x-1/2">
          <div
            className={`relative overflow-hidden rounded-xl border px-2.5 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.24)] sm:px-3 ${
              darkMode
                ? "border-wa-gold/45 bg-[linear-gradient(155deg,rgba(12,12,12,0.88),rgba(36,26,12,0.86))]"
                : "border-wa-black/30 bg-[linear-gradient(155deg,rgba(255,255,255,0.94),rgba(255,245,225,0.92))]"
            }`}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-wa-gold/25 to-transparent" />
            <div className="pointer-events-none absolute -bottom-7 right-5 h-16 w-16 rounded-full bg-wa-gold/20 blur-xl" />

            <div className="relative grid gap-1">
              <div className="flex items-center justify-between gap-1.5">
                <p
                  className={`text-[8px] font-semibold uppercase tracking-[0.14em] sm:text-[9px] sm:tracking-[0.18em] ${
                    darkMode ? "text-wa-white/80" : "text-wa-black/65"
                  }`}
                >
                  Coin Wallet
                </p>
                <span className="text-xs sm:text-sm">🪙</span>
              </div>

              <div className="relative grid place-items-center">
                {walletGainPopup ? (
                  <p
                    key={walletGainPopup.id}
                    className={`pointer-events-none absolute -top-4 inset-x-0 mx-auto w-max rounded-full border px-1.5 py-0.5 text-[9px] font-semibold animate-[kazenagare-wallet-coin-pop_1.05s_ease-out_forwards] sm:px-2 sm:text-[10px] ${
                      darkMode
                        ? "border-wa-gold/45 bg-wa-gold/25 text-wa-gold"
                        : "border-wa-gold/50 bg-wa-gold/20 text-amber-900"
                    }`}
                  >
                    +{walletGainPopup.coins} coin
                  </p>
                ) : null}

                <p
                  className={`text-center text-xl font-bold leading-none tabular-nums sm:text-2xl ${
                    darkMode ? "text-wa-gold" : "text-wa-black"
                  }`}
                >
                  {walletCoins.toLocaleString("ja-JP")}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className={mobileStickPanelClass}>
        <div
          ref={stickPadRef}
          className={`pointer-events-auto relative grid h-[108px] w-[108px] place-items-center rounded-full border touch-none select-none ${
            darkMode
              ? "border-wa-white/40 bg-wa-white/10"
              : "border-wa-black/20 bg-wa-white/80"
          }`}
          onPointerDown={onStickPointerDown}
          onPointerMove={onStickPointerMove}
          onPointerUp={onStickPointerEnd}
          onPointerCancel={onStickPointerEnd}
        >
          <div
            className={`pointer-events-none absolute inset-2 rounded-full border ${
              darkMode ? "border-wa-white/25" : "border-wa-black/10"
            }`}
          />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div
              ref={stickKnobRef}
              className={`h-9 w-9 rounded-full border will-change-transform ${
                darkMode
                  ? "border-wa-white/70 bg-wa-white/70"
                  : "border-wa-black/25 bg-wa-black/30"
              }`}
            />
          </div>
        </div>
      </div>
    </>
  );
}
