"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { isAnonymousSupabaseUser } from "@/lib/auth/user";
import { getSupabaseClient, getSupabaseSessionOrNull } from "@/lib/supabase/client";

type GardenShareQrProps = {
  origin: string;
  userId: string;
};

export function GardenShareQr({ origin, userId }: GardenShareQrProps) {
  const requiresOwnerResolution = userId === "me";
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(() =>
    requiresOwnerResolution ? null : userId,
  );
  const [isResolvingOwner, setIsResolvingOwner] = useState(requiresOwnerResolution);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  return (
    <section className="rounded-lg border border-wa-black/20 bg-white/70 p-4">
      <p className="text-sm">この QR を読み込むと、この庭に入れます。</p>

      {isResolvingOwner ? (
        <p className="mt-3 text-sm text-wa-black/70">共有リンクを準備しています...</p>
      ) : null}

      {!isResolvingOwner && qrDataUrl ? (
        <div className="mt-3 flex justify-center">
          <Image
            src={qrDataUrl}
            alt="この庭に入るためのQRコード"
            width={192}
            height={192}
            unoptimized
            className="h-48 w-48 rounded-md border border-wa-black/20 bg-white"
          />
        </div>
      ) : null}

      {!isResolvingOwner && errorMessage ? (
        <p className="mt-3 text-sm text-wa-red">{errorMessage}</p>
      ) : null}

      {!isResolvingOwner && shareUrl ? (
        <a
          href={shareUrl}
          className="mt-3 block break-all text-xs text-wa-black/80 underline"
        >
          {shareUrl}
        </a>
      ) : null}
    </section>
  );
}
