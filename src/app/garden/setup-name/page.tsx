"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GardenSetupNamePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/garden/setup");
  }, [router]);

  return null;
}
