import { GardenSummary } from "@/components/garden/garden-summary";
import { PageShell } from "@/components/ui/page-shell";

type GardenUserPageProps = {
  params: Promise<{
    userId: string;
  }>;
};

export default async function GardenUserPage({ params }: GardenUserPageProps) {
  const { userId } = await params;

  return (
    <PageShell title={`${userId} の庭`} subtitle="静かな和の情景を巡る">
      <GardenSummary
        profile={{
          userId,
          username: userId,
          selectedBackgroundId: "bamboo-forest",
        }}
        backgroundName="竹林"
      />
    </PageShell>
  );
}
