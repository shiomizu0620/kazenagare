"use client";

import Link from "next/link";
import { GardenSummary } from "@/components/garden/garden-summary";
import { PageShell } from "@/components/ui/page-shell";
import { FurinCanvas } from "@/components/visual/furin-canvas";
import { useAudio } from "@/hooks/useAudio";
import { useGarden } from "@/hooks/useGarden";
import { AuthSection } from "@/components/auth/auth-section"; // 作ったファイルを読み込む

export default function Home() {
  const { isListening, volume, toggleListening } = useAudio();
  const {
    profile,
    selectedBackground,
    randomGardenPath,
    selectNextBackground,
    visitAnotherGarden,
  } = useGarden();

  return (
    <PageShell
      title="風流 - Kazenagare"
      subtitle="声を和の情景へ溶け込ませるインタラクティブ体験"
    >
      <div className="grid gap-6 md:grid-cols-2">
        <GardenSummary
          profile={profile}
          backgroundName={selectedBackground.name}
        />
        <FurinCanvas isListening={isListening} volume={volume} />
      </div>

      <div className="flex flex-col gap-4 mt-6">
        
        {/* === ここにログイン機能をガサッと表示 === */}
        <AuthSection />
        {/* ==================================== */}

        <div className="flex flex-wrap gap-3 mt-2">
          <button
            type="button"
            onClick={toggleListening}
            className="rounded-md border border-gray-400 px-4 py-2 text-sm"
          >
            {isListening ? "収音を止める" : "収音を始める"}
          </button>

          <button
            type="button"
            onClick={selectNextBackground}
            className="rounded-md border border-gray-400 px-4 py-2 text-sm"
          >
            背景を切り替える
          </button>

          <Link
            href={`/garden/${profile.userId}/qr`}
            className="rounded-md border border-gray-400 px-4 py-2 text-sm flex items-center"
          >
            自分の庭を表示（QR共有）
          </Link>

          <Link
            href={randomGardenPath}
            onClick={visitAnotherGarden}
            className="rounded-md border border-gray-400 px-4 py-2 text-sm flex items-center"
          >
            ランダムな庭へ
          </Link>

          <Link
            href="/garden/me"
            className="rounded-md border border-gray-400 px-4 py-2 text-sm flex items-center"
          >
            自分の庭でオブジェクトを置く
          </Link>
        </div>
      </div>
    </PageShell>
  );
}