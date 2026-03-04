"use client";

import Link from "next/link";
import { GardenSummary } from "@/components/garden/garden-summary";
import { PageShell } from "@/components/ui/page-shell";
import { FurinCanvas } from "@/components/visual/furin-canvas";
import { useAudio } from "@/hooks/useAudio";
import { useGarden } from "@/hooks/useGarden";

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

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={toggleListening}
          className="rounded-md border border-wa-black px-4 py-2 text-sm"
        >
          {isListening ? "収音を止める" : "収音を始める"}
        </button>

        <button
          type="button"
          onClick={selectNextBackground}
          className="rounded-md border border-wa-black px-4 py-2 text-sm"
        >
          背景を切り替える
        </button>

        <Link
          href={randomGardenPath}
          onClick={visitAnotherGarden}
          className="rounded-md border border-wa-black px-4 py-2 text-sm"
        >
          ランダムな庭へ
        </Link>
      </div>
    </PageShell>
  );
}