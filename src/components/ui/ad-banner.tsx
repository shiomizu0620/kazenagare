// src/components/ui/ad-banner.tsx
'use client';

export function AdBanner() {
  return (
    // 画面の一番下に固定（fixed bottom-0）され、UIの邪魔にならないようにします
    <div className="fixed bottom-0 left-0 w-full z-[100] bg-white/10 backdrop-blur-sm flex justify-center items-center py-1 pointer-events-auto">
      
      {/* 【ここに忍者AdMaxのタグを貼り付けます】
        忍者AdMaxで「スマートフォン用オーバーレイ」などの枠を作ると、
        以下のようなdivタグとscriptタグが発行されるので、それに差し替えてください。
      */}
      <div id="admax-sample-div" className="min-h-[50px] flex items-center justify-center text-xs text-muted-foreground">
        広告が表示されます
      </div>
      
      {/* Next.jsで外部スクリプトを読み込むための最適な方法（strategy="lazyOnload" で画面の表示スピードを落とさない） */}
      {/* <Script strategy="lazyOnload" src="https://adm.shinobi.jp/s/xxxxxx" /> */}
    </div>
  );
}