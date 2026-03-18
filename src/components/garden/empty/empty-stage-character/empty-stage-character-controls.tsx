import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

type EmptyStageCharacterControlsProps = {
  allowObjectPlacement: boolean;
  walletCoins: number;
  walletGainPopup: {
    id: string;
    coins: number;
  } | null;
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
      {allowObjectPlacement ? (
        <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+3.6rem)] left-3 z-50 w-[min(42vw,10rem)] sm:bottom-3 sm:w-[min(86vw,19rem)]">
          <div
            className={`kazenagare-wallet-panel relative overflow-hidden rounded-2xl border px-2.5 py-2.5 shadow-[0_14px_30px_rgba(0,0,0,0.26)] sm:px-3 sm:py-3 ${
              darkMode
                ? "kazenagare-wallet-panel-night border-[#f2dfbe]/35 text-[#fff7e9]"
                : "border-[#c49a65]/45 text-[#3a2a1d]"
            }`}
          >
            <div className="pointer-events-none absolute -right-4 -top-5 h-16 w-16 rounded-full border border-wa-gold/35 bg-wa-gold/20 blur-[1px]" />
            <div className="pointer-events-none absolute -bottom-7 left-2 h-12 w-14 rounded-full bg-wa-gold/20 blur-xl" />

            <div className="relative grid gap-1.5">
              <div className="flex items-start justify-between gap-1.5">
                <div className="grid gap-0.5">
                  <p
                    className={`text-[8px] font-semibold tracking-[0.14em] sm:text-[9px] sm:tracking-[0.18em] ${
                      darkMode ? "text-wa-white/75" : "text-[#6b4f34]/78"
                    }`}
                  >
                    所持コイン
                  </p>
                  <p
                    className={`text-[9px] leading-none ${
                      darkMode ? "text-wa-gold/90" : "text-[#8f6437]/90"
                    }`}
                  >
                    音の実り
                  </p>
                </div>

                <div
                  className={`kazenagare-wallet-emblem grid h-7 w-7 place-items-center rounded-full border text-[10px] font-semibold sm:h-8 sm:w-8 sm:text-xs ${
                    darkMode
                      ? "border-wa-gold/45 bg-wa-gold/18 text-wa-gold"
                      : "border-[#a87741]/45 bg-[#f8e4c2]/92 text-[#7a4f23]"
                  }`}
                >
                  銭
                </div>
              </div>

              <div className="relative grid place-items-center">
                {walletGainPopup ? (
                  <p
                    key={walletGainPopup.id}
                    className={`pointer-events-none absolute -top-4 inset-x-0 mx-auto w-max rounded-full border px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.05em] animate-[kazenagare-wallet-coin-pop_1.05s_ease-out_forwards] sm:px-2 sm:text-[10px] ${
                      darkMode
                        ? "border-wa-gold/45 bg-[linear-gradient(145deg,rgba(255,212,126,0.34),rgba(86,54,15,0.52))] text-wa-gold"
                        : "border-[#b98547]/50 bg-[linear-gradient(145deg,rgba(255,233,190,0.95),rgba(241,201,133,0.84))] text-[#7a4f22]"
                    }`}
                  >
                    +{walletGainPopup.coins} コイン
                  </p>
                ) : null}

                <p
                  className={`text-center text-xl font-bold leading-none tabular-nums sm:text-2xl ${
                    darkMode
                      ? "bg-[linear-gradient(180deg,#fff2d3_0%,#f2cb83_58%,#d89b3a_100%)] bg-clip-text text-transparent"
                      : "bg-[linear-gradient(180deg,#8a5a2f_0%,#6d421d_62%,#4b2e14_100%)] bg-clip-text text-transparent"
                  }`}
                >
                  {walletCoins.toLocaleString("ja-JP")}
                  <span
                    className={`ml-1 align-[0.22rem] text-[10px] font-semibold sm:text-xs ${
                      darkMode ? "text-wa-white/76" : "text-[#6b4f34]/78"
                    }`}
                  >
                    枚
                  </span>
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
