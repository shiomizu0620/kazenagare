import type { ReactNode } from "react";

type GardenFieldProps = {
  children?: ReactNode;
};

export function GardenField({ children }: GardenFieldProps) {
  return (
    <section className="relative h-[100svh] w-[100dvw] overflow-hidden overscroll-none bg-wa-white text-wa-black md:h-[100dvh] md:overscroll-auto">
      {children}
    </section>
  );
}
