import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";

const SAMPLE_USER_IDS = ["akari", "ren", "sora", "yui"];

export default function GardenIndexPage() {
  return (
    <PageShell
      title="庭一覧"
      subtitle="訪問したい庭を選択してください"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/garden/me/qr"
          className="rounded-md border border-wa-black px-4 py-3 text-sm"
        >
          自分の庭（QR表示）へ
        </Link>

        {SAMPLE_USER_IDS.map((userId) => (
          <Link
            key={userId}
            href={`/garden/${userId}`}
            className="rounded-md border border-wa-black px-4 py-3 text-sm"
          >
            {userId} の庭へ
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
