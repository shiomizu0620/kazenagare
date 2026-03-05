import { Suspense } from "react";
import { GardenFieldPlayground } from "@/components/garden/GardenFieldPlayground";

export default function TestUiPage() {
  return (
    <Suspense fallback={null}>
      <GardenFieldPlayground />
    </Suspense>
  );
}
