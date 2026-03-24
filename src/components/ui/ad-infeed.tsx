'use client';

import { useEffect, useRef } from 'react';

export function AdInfeed() {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // すでにスクリプトが挿入されている場合は二重読み込みを防止
    if (adRef.current && adRef.current.childNodes.length === 0) {
      const script = document.createElement('script');
      // ★ 忍者AdMaxで発行されたタグの「src="..."」の中身（URL）をここに貼り付けてください
      script.src = "https://adm.shinobi.jp/s/e54e68372cd357851dbe1362d1d94d03"; 
      script.async = true;
      adRef.current.appendChild(script);
    }
  }, []);

  return (
    <li className="flex-shrink-0 flex flex-col items-center justify-center h-[27rem] w-[11.3rem] sm:h-[28.2rem] sm:w-[11.8rem] rounded-[1.65rem] border border-[#d9c0a0]/52 bg-[#f3e5cd]/60 overflow-hidden">
      <span className="text-[10px] tracking-[0.2em] text-[#6f5a42]/68 mb-2">スポンサー</span>
      
      {/* 広告がここに表示されます */}
      <div ref={adRef} className="min-w-[120px] min-h-[240px] flex items-center justify-center text-[10px] text-[#6f5a42]/40" />
    </li>
  );
}