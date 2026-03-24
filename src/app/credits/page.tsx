// src/app/credits/page.tsx
import { PageShell } from "@/components/ui/page-shell";

export default function CreditsPage() {
  return (
    <PageShell title="クレジット" subtitle="Credits & Attributions">
      <div className="space-y-8 leading-relaxed text-[#3e3223]">
        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-[#3e3223]/10 pb-2">素材提供</h2>
          <div className="space-y-4">
            <div>
              <p className="font-semibold">BGM・音源：</p>
              <p>
                DOVA-SYNDROME (
                <a 
                  href="https://dova-s.jp/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-sky-700 hover:underline"
                >
                  https://dova-s.jp/
                </a>
                )
              </p>
              {/* 曲名と作曲者名がわかる場合は以下のように追記するのが推奨されます */}
              {/* <p className="text-sm opacity-80">「曲名」by 作曲者名</p> */}
            </div>
            <div>
              <p className="font-semibold">動画・イラスト素材：</p>
              <a 
                href="https://telopict.com/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-sky-700 hover:underline"
              >
                TELOPICT.com (https://telopict.com/)
              </a>
            </div>
            <div>
              <p className="font-semibold">背景・追加素材・環境音：</p>
              <p>liberis 制作チーム</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-[#3e3223]/10 pb-2">技術・ライブラリ</h2>
          <ul className="list-disc list-inside space-y-1 opacity-80">
            <li>Next.js / React</li>
            <li>p5.js (Visual Rendering)</li>
            <li>Supabase (Backend / Realtime)</li>
            <li>Lucide React (Icons)</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-[#3e3223]/10 pb-2">開発</h2>
          <p className="font-medium">Development Team &quot;liberis&quot;</p>
          <p className="text-xs opacity-60">inspired by My Voice Zoo</p>
        </section>

        <div className="pt-8">
          <p className="text-center text-xs opacity-40">© 2026 liberis. All Rights Reserved.</p>
        </div>
      </div>
    </PageShell>
  );
}