"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isAnonymousSupabaseUser } from "@/lib/auth/user";
import { getSupabaseClient, getSupabaseSessionOrNull } from "@/lib/supabase/client";

type GardenShareQrProps = {
  origin: string;
  userId: string;
};

type CopyFeedbackTone = "red" | "ink";

function pickCopyFeedbackTone(): CopyFeedbackTone {
  return Math.random() < 0.5 ? "red" : "ink";
}

async function copyTextToClipboard(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fallback path is handled below for browsers with restricted clipboard access.
    }
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  textArea.style.pointerEvents = "none";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const copied = document.execCommand("copy");
    return copied;
  } catch {
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
}

export function GardenShareQr({ origin, userId }: GardenShareQrProps) {
  const requiresOwnerResolution = userId === "me";
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(() =>
    requiresOwnerResolution ? null : userId,
  );
  const [isResolvingOwner, setIsResolvingOwner] = useState(requiresOwnerResolution);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [copyErrorMessage, setCopyErrorMessage] = useState<string | null>(null);
  const [copyFeedbackTone, setCopyFeedbackTone] = useState<CopyFeedbackTone | null>(null);
  const copyLabelTimerRef = useRef<number | null>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyLabelTimerRef.current !== null) {
        window.clearTimeout(copyLabelTimerRef.current);
      }

      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!requiresOwnerResolution) {
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      const fallbackTimer = window.setTimeout(() => {
        setIsResolvingOwner(false);
        setErrorMessage("通常ログイン中の自分の庭のみQR共有できます。");
      }, 0);

      return () => {
        window.clearTimeout(fallbackTimer);
      };
    }

    let isCancelled = false;

    void getSupabaseSessionOrNull(supabase).then((session) => {
      if (isCancelled) {
        return;
      }

      const currentUser = session?.user ?? null;

      if (!currentUser || isAnonymousSupabaseUser(currentUser)) {
        setResolvedUserId(null);
        setErrorMessage("通常ログイン中の自分の庭のみQR共有できます。");
      } else {
        setResolvedUserId(currentUser.id);
        setErrorMessage(null);
      }

      setIsResolvingOwner(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [requiresOwnerResolution]);

  const shareUrl = useMemo(() => {
    if (!resolvedUserId) {
      return null;
    }

    return `${origin}/garden/${encodeURIComponent(resolvedUserId)}`;
  }, [origin, resolvedUserId]);

  useEffect(() => {
    if (!shareUrl) {
      return;
    }

    let isCancelled = false;

    void QRCode.toDataURL(shareUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 256,
      color: {
        dark: "#2B2B2B",
        light: "#F2F2F2",
      },
    })
      .then((nextQrDataUrl) => {
        if (isCancelled) {
          return;
        }

        setQrDataUrl(nextQrDataUrl);
        setErrorMessage(null);
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }

        setQrDataUrl(null);
        setErrorMessage("QRコードの生成に失敗しました。");
      });

    return () => {
      isCancelled = true;
    };
  }, [shareUrl]);

  const handleCopyShareUrl = useCallback(async () => {
    if (!shareUrl) {
      return;
    }

    const copied = await copyTextToClipboard(shareUrl);
    if (!copied) {
      setCopyErrorMessage("道標の写し取りに失敗しました。端末設定をご確認ください。");
      return;
    }

    setCopyErrorMessage(null);
    setIsCopied(true);
    setCopyFeedbackTone(pickCopyFeedbackTone());

    if (copyLabelTimerRef.current !== null) {
      window.clearTimeout(copyLabelTimerRef.current);
    }
    copyLabelTimerRef.current = window.setTimeout(() => {
      setIsCopied(false);
    }, 1800);

    if (copyFeedbackTimerRef.current !== null) {
      window.clearTimeout(copyFeedbackTimerRef.current);
    }
    copyFeedbackTimerRef.current = window.setTimeout(() => {
      setCopyFeedbackTone(null);
    }, 500);
  }, [shareUrl]);

  return (
    <section className="kazenagare-garden-info-panel kazenagare-garden-info-panel-night relative isolate overflow-hidden rounded-2xl border border-[#f0dcb9]/30 p-8 font-serif text-[#fff8eb] shadow-[0_26px_58px_rgba(0,0,0,0.42)] animate-[kazenagare-options-panel-reveal_360ms_cubic-bezier(0.18,1,0.32,1)] sm:p-10 lg:p-7">
      <p className="text-[10px] tracking-[0.26em] text-[#f6e7ce]/78">招待の印</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-widest text-[#fff8eb] sm:text-[1.7rem] lg:text-[1.55rem]">
        庭への文
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-[#f2e4cc]/90 sm:text-[15px] lg:mt-2.5 lg:text-[14px]">
        このQRを読み解くか、道を記して 客人（まろうど）を招き入れましょう。
      </p>

      {isResolvingOwner ? (
        <p className="mt-4 text-sm text-[#f3e6cf]/90 animate-pulse">
          文を認（したた）めております...
        </p>
      ) : null}

      {!isResolvingOwner && qrDataUrl ? (
        <div className="mt-6 flex justify-center lg:mt-4">
          <div className="rounded-2xl border border-wa-gold/45 bg-[#f8ead2]/18 p-3 shadow-[0_20px_38px_rgba(0,0,0,0.36)]">
            <div className="rounded-xl border border-wa-gold/35 bg-[#fff9ed]/92 p-2">
              <Image
                src={qrDataUrl}
                alt="この庭に入るためのQRコード"
                width={192}
                height={192}
                unoptimized
                className="h-48 w-48 rounded-md border border-wa-black/20 bg-wa-white lg:h-44 lg:w-44"
              />
            </div>
          </div>
        </div>
      ) : null}

      {!isResolvingOwner && errorMessage ? (
        <p className="mt-4 text-sm text-wa-red">{errorMessage}</p>
      ) : null}

      {!isResolvingOwner && shareUrl ? (
        <>
          <div className="mt-6 flex justify-center lg:mt-4">
            <button
              type="button"
              onClick={() => {
                void handleCopyShareUrl();
              }}
              className={`relative overflow-hidden rounded-xl border border-[#3a2f22]/38 bg-[#fff9ef]/78 px-4 py-2.5 text-sm tracking-[0.12em] text-[#2b2b2b] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-[#fff9ef] active:translate-y-[1px] active:scale-[0.98] ${
                isCopied ? "border-wa-red/35 bg-wa-red/15" : ""
              }`}
            >
              {copyFeedbackTone ? (
                <span
                  className={`pointer-events-none absolute inset-0 rounded-xl animate-[ping_500ms_cubic-bezier(0,0,0.2,1)_1] ${
                    copyFeedbackTone === "red" ? "bg-wa-red/10" : "bg-wa-black/10"
                  }`}
                />
              ) : null}
              <span className="relative z-10 font-semibold">
                {isCopied ? "写し取りました" : "道標を写し取る"}
              </span>
            </button>
          </div>

          {copyErrorMessage ? (
            <p className="mt-3 text-center text-xs text-[#ffc0c0]">{copyErrorMessage}</p>
          ) : null}

          <p className="mt-4 break-all text-center text-sm leading-relaxed text-[#f2e4cc]/90 lg:mt-3 lg:text-[13px]">
            道しるべ:
            <a
              href={shareUrl}
              className="ml-1 underline decoration-[#f2d4a4]/70 underline-offset-2 hover:text-[#fff8eb]"
            >
              {shareUrl}
            </a>
          </p>
        </>
      ) : null}
    </section>
  );
}
