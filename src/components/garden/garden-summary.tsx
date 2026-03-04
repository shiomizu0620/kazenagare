import type { GardenProfile } from "@/types/garden";

type GardenSummaryProps = {
  profile: GardenProfile;
  backgroundName: string;
};

export function GardenSummary({ profile, backgroundName }: GardenSummaryProps) {
  return (
    <section className="rounded-lg border border-wa-black/20 bg-white/70 p-4">
      <p className="text-sm">庭主: {profile.username}</p>
      <p className="text-sm">ID: {profile.userId}</p>
      <p className="text-sm">背景: {backgroundName}</p>
    </section>
  );
}
