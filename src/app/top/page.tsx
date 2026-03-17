"use client";

import Link from "next/link";
import { AuthSection } from "@/components/auth/auth-section";
import { PageShell } from "@/components/ui/page-shell";

export default function TopPage() {
  return (
    <PageShell
      title="風流 - Kazenagare"
      subtitle="声を和の情景へ溶け込ませるインタラクティブ体験"
    >
      <div className="flex flex-col gap-6">
        <AuthSection />

        <div className="border-t border-wa-black/10 pt-4">
          <Link
            href="/garden"
            className="rounded-md border border-wa-black px-4 py-3 text-sm transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-wa-red/10 active:translate-y-[1px] active:scale-[0.98]"
          >
            庭一覧へ
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
