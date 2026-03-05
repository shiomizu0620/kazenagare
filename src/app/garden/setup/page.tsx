import { GardenSetupForm } from "@/components/garden/garden-setup-form";
import { PageShell } from "@/components/ui/page-shell";

export default function GardenSetupPage() {
  return (
    <PageShell
      title="庭の初期設定"
      subtitle="背景・季節・時間帯を選んでから庭に入ります"
    >
      <GardenSetupForm nextPath="/test-ui" />
    </PageShell>
  );
}
