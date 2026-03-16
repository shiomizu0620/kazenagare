import { GardenSetupForm } from "@/components/garden/setup/garden-setup-form";
import { PageShell } from "@/components/ui/page-shell";

export default function GardenSetupPage() {
  return (
    <PageShell
      title="庭の初期設定"
      subtitle="季節を選んでから庭に入ります"
    >
      <GardenSetupForm nextPath="/garden/empty" />
    </PageShell>
  );
}
