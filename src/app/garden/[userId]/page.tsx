import Link from "next/link";
import { GardenEmptyStage } from "@/components/garden/empty/garden-empty-stage";
import { GardenSummary } from "@/components/garden/garden-summary";
import { PageShell } from "@/components/ui/page-shell";
import {
  GARDEN_BACKGROUNDS,
  GARDEN_SEASONS,
  GARDEN_TIME_SLOTS,
} from "@/lib/garden/setup/options";

type GardenUserPageProps = {
  params: Promise<{
    userId: string;
  }>;
};

export default async function GardenUserPage({ params }: GardenUserPageProps) {
  const { userId } = await params;
  const isMe = userId === "me";
  const backHref = isMe ? "/garden/empty" : "/garden";
  const backLabel = userId === "me" ? "自分の庭に戻る" : "庭一覧に戻る";
  const qrHref = `/garden/${encodeURIComponent(userId)}/qr`;

  const background = GARDEN_BACKGROUNDS[0];
  const season = GARDEN_SEASONS[0];
  const timeSlot = GARDEN_TIME_SLOTS[0];

  return (
    <PageShell title={`${userId} の庭`} subtitle="静かな和の情景を巡る">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          href={backHref}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
        >
          × {backLabel}
        </Link>
        <Link
          href={qrHref}
          className="rounded-md border border-wa-black px-3 py-2 text-sm"
        >
          この庭のQRを表示する
        </Link>
      </div>
      <div className="grid gap-4">
        <GardenSummary
          profile={{
            userId,
            username: userId,
            selectedBackgroundId: background.id,
          }}
          backgroundName={background.name}
        />

        <GardenEmptyStage
          backgroundId={background.id}
          backgroundName={background.name}
          seasonId={season.id}
          seasonName={season.name}
          timeSlotId={timeSlot.id}
          timeSlotName={timeSlot.name}
        />
      </div>
    </PageShell>
  );
}
