import type { ReactNode } from "react";

type GardenFieldProps = {
  children?: ReactNode;
};

export function GardenField({ children }: GardenFieldProps) {
  return (
    <section className="relative h-[100dvh] w-[100dvw] overflow-hidden bg-wa-white text-wa-black">
      {children}
    </section>
  );
}
