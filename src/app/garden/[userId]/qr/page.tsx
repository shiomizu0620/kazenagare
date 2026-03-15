import { GardenSummary } from "@/components/garden/garden-summary";
import { GardenShareQr } from "@/components/garden/garden-share-qr";
import { PageShell } from "@/components/ui/page-shell";
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
  const shareUrl = `${origin}/garden/${encodeURIComponent(userId)}`;
  const backHref =
    userId === "me"
      ? "/garden/empty"
      : `/garden/${encodeURIComponent(userId)}`;
  const backLabel = userId === "me" ? "自分の庭に戻る" : "この庭に戻る";

  return (
    <PageShell title={`${userId} の庭 QR`} subtitle="この庭を共有できます">
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <Link
          href="/"
          className="rounded-md border border-wa-black px-3 py-2 text-sm transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-wa-red/10 active:translate-y-[1px] active:scale-[0.98]"
        >
          トップへ戻る
        </Link>
        <Link
          href={backHref}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-slate-100 active:translate-y-[1px] active:scale-[0.98]"
        >
          × {backLabel}
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <GardenSummary
          profile={{
            userId,
            username: userId,
            selectedBackgroundId: "bamboo-forest",
          }}
          backgroundName="竹林"
        />
        <GardenShareQr shareUrl={shareUrl} />
      </div>
    </PageShell>
  );
}
