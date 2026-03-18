import { GardenQrOwnerName } from "@/components/garden/garden-qr-owner-name";
import { GardenShareQr } from "@/components/garden/garden-share-qr";
import { fetchPublishedGardenPostByUserId } from "@/lib/garden/posts";
import { headers } from "next/headers";
import Link from "next/link";
import { networkInterfaces } from "node:os";

type GardenUserQrPageProps = {
  params: Promise<{
    userId: string;
  }>;
};

function isLoopbackHost(host: string) {
  const normalizedHost = host.toLowerCase();
  return (
    normalizedHost.startsWith("localhost") ||
    normalizedHost.startsWith("127.0.0.1") ||
    normalizedHost.startsWith("[::1]")
  );
}

function pickFirstHeaderValue(value: string | null) {
  if (!value) {
    return null;
  }
  return value.split(",")[0]?.trim() ?? null;
}

function getPrivateIpPriority(address: string) {
  if (address.startsWith("192.168.")) {
    return 3;
  }
  if (address.startsWith("10.")) {
    return 2;
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) {
    return 1;
  }
  return 0;
}

function getLocalLanIp() {
  const nets = networkInterfaces();
  let bestAddress: string | null = null;
  let bestPriority = -1;

  for (const netGroup of Object.values(nets)) {
    if (!netGroup) {
      continue;
    }

    for (const net of netGroup) {
      const isIpv4 = net.family === "IPv4";
      if (!isIpv4 || net.internal) {
        continue;
      }

      if (net.address.startsWith("169.254.")) {
        continue;
      }

      const priority = getPrivateIpPriority(net.address);
      if (priority > bestPriority) {
        bestPriority = priority;
        bestAddress = net.address;
      }
    }
  }

  return bestAddress;
}

async function getRequestOrigin() {
  const headerStore = await headers();
  const envOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (envOrigin) {
    return envOrigin;
  }

  const host =
    pickFirstHeaderValue(headerStore.get("x-forwarded-host")) ??
    pickFirstHeaderValue(headerStore.get("host")) ??
    "localhost:3000";
  const forwardedProto = pickFirstHeaderValue(
    headerStore.get("x-forwarded-proto"),
  );
  const protocol =
    forwardedProto ??
    (isLoopbackHost(host)
      ? "http"
      : "https");

  if (isLoopbackHost(host)) {
    const localLanIp = getLocalLanIp();
    if (localLanIp) {
      const portMatch = host.match(/:\d+$/);
      const port = portMatch ? portMatch[0] : "";
      return `http://${localLanIp}${port}`;
    }
  }
  return `${protocol}://${host}`;
}

export default async function GardenUserQrPage({ params }: GardenUserQrPageProps) {
  const { userId } = await params;
  const origin = await getRequestOrigin();
  const publishedPost = userId === "me" ? null : await fetchPublishedGardenPostByUserId(userId);
  const backHref =
    userId === "me"
      ? "/garden/empty"
      : `/garden/${encodeURIComponent(userId)}`;
  const backLabel = userId === "me" ? "自分の庭に戻る" : "この庭に戻る";
  const pageTitle = userId === "me" ? "招待の印" : `${userId} の庭への文`;
  const hostLabel =
    userId === "me"
      ? "あなた"
      : typeof publishedPost?.ownerDisplayName === "string" && publishedPost.ownerDisplayName.trim()
        ? publishedPost.ownerDisplayName.trim()
        : userId;

  return (
    <main className="kazenagare-washitsu-scene relative min-h-[100svh] overflow-x-hidden overflow-y-auto overscroll-y-contain font-serif text-[#f4ecde] lg:h-[100dvh] lg:overflow-y-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(252,226,176,0.09),rgba(19,14,13,0.78))]" />
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(239,220,186,0.05)_0_2px,transparent_2px_140px)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 border-b border-[#d8be94]/28 bg-[linear-gradient(180deg,rgba(42,26,17,0.95),rgba(28,18,13,0.88))]" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-[calc(env(safe-area-inset-top)+1.2rem)] sm:px-8 sm:pb-[calc(env(safe-area-inset-bottom)+6.5rem)] sm:pt-8 lg:h-full lg:gap-4 lg:pb-12 lg:pt-6">
        <header className="flex flex-wrap items-start justify-between gap-4 lg:gap-3">
          <div className="space-y-2 lg:space-y-1.5">
            <p className="text-[11px] tracking-[0.4em] text-[#ecd7b7]/58">TOKONOMA GALLERY</p>
            <h1 className="text-2xl font-semibold tracking-[0.08em] text-[#f4e8d2] sm:text-3xl lg:text-[1.7rem]">
              {pageTitle}
            </h1>
            <p className="text-xs leading-relaxed text-[#dcc7aa]/76 sm:text-sm lg:text-[13px]">
              道しるべをしたため、客人を庭へお迎えしましょう
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
            <Link
              href="/?login=1"
              className="rounded-full border border-[#d6be97]/38 bg-[#221912]/72 px-4 py-2 text-[#f2e0c2] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#3a2a1e]/90"
            >
              トップへ戻る
            </Link>
            <Link
              href={backHref}
              className="rounded-full border border-[#d6be97]/32 bg-[#1a1410]/64 px-4 py-2 text-[#e6d3b3] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#322418]/84"
            >
              {backLabel}
            </Link>
          </div>
        </header>

        <section className="grid gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start">
          <aside className="kazenagare-garden-info-panel kazenagare-garden-info-panel-night rounded-2xl border border-[#f0dcb9]/28 px-6 py-6 text-[#fff8eb] shadow-[0_24px_56px_rgba(0,0,0,0.32)] animate-[kazenagare-options-panel-reveal_320ms_cubic-bezier(0.18,1,0.32,1)] sm:px-7 sm:py-7 lg:px-6 lg:py-5">
            <p className="text-[10px] tracking-[0.24em] text-[#f6e7ce]/68">しつらえ案内</p>
            <h2 className="mt-1 text-xl font-semibold tracking-[0.1em]">客人を迎える手順</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#f2e4cc]/82 lg:mt-2.5">
              QRを客人に渡すだけで、この庭の風景へすぐご案内できます。案内が終われば、いつでも庭へ戻って新しい飾り付けを続けられます。
            </p>

            <div className="mt-5 grid gap-2 text-xs sm:text-sm lg:mt-4">
              <p className="rounded-xl border border-[#f2dfbe]/26 bg-[#f7e9cf]/12 px-3 py-2 text-[#fff5e4]">
                庭主: <GardenQrOwnerName userId={userId} fallbackName={hostLabel} />
              </p>
              <p className="rounded-xl border border-[#f2dfbe]/26 bg-[#f7e9cf]/12 px-3 py-2 text-[#fff5e4]">
                用途: 招待・共有・再訪
              </p>
            </div>

            <ol className="mt-5 grid gap-2 text-sm leading-relaxed text-[#f3e6cf]/86 lg:mt-4 lg:text-[13px]">
              <li>一. 「道標を写し取る」で共有用リンクを控える</li>
              <li>二. QRを読み取ってもらい、庭へ招き入れる</li>
              <li>三. 招待後は「{backLabel}」で景色へ戻る</li>
            </ol>
          </aside>

          <div className="lg:min-h-0">
            <GardenShareQr origin={origin} userId={userId} />
          </div>
        </section>
      </div>

      <div className="kazenagare-tatami-floor pointer-events-none absolute inset-x-0 bottom-0 h-16 sm:h-20 lg:h-14" />
    </main>
  );
}
