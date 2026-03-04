import type { ReactNode } from "react";

type PageShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function PageShell({ title, subtitle, children }: PageShellProps) {
  return (
    <main className="min-h-screen bg-wa-white text-wa-black font-serif">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold">{title}</h1>
          {subtitle ? <p className="text-base">{subtitle}</p> : null}
        </header>
        {children}
      </div>
    </main>
  );
}
