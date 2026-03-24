// src/components/ui/ad-banner-fixed.tsx
'use client';
import { useEffect, useRef, useState } from 'react';

export function AdBannerFixed() {
  const adRef = useRef<HTMLDivElement>(null);
  const [isFooterVisible, setIsFooterVisible] = useState(false);

  useEffect(() => {
    // 二重読み込み防止
    if (adRef.current && adRef.current.childNodes.length === 0) {
      const script = document.createElement('script');
      // ★ 忍者AdMaxで新たに発行した「横長バナー用」のURLをここに貼り付けてください
      script.src = "https://adm.shinobi.jp/s/421273f2126a8320a1990c975a42196a"; 
      script.async = true;
      adRef.current.appendChild(script);
    }
  }, []);

  useEffect(() => {
    const footer = document.getElementById('site-footer');
    if (!footer || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const nextVisible = entries.some((entry) => entry.isIntersecting);
        setIsFooterVisible(nextVisible);
      },
      {
        threshold: 0.01,
      },
    );

    observer.observe(footer);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-30 flex justify-center px-2 transition-opacity duration-150 ${
        isFooterVisible ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div
        className={`inline-flex flex-col items-center justify-center rounded-2xl border border-wa-black/10 bg-wa-white/70 p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.16)] backdrop-blur-[2px] ${
          isFooterVisible ? 'pointer-events-none' : 'pointer-events-auto'
        }`}
      >
        <span className="mb-0.5 text-[9px] tracking-[0.1em] text-wa-black/40">スポンサー</span>

        {/* 広告がここに展開されます (320x50などを想定) */}
        <div
          ref={adRef}
          className="min-h-[50px] min-w-[320px] max-w-full overflow-hidden text-[10px] text-wa-black/20"
        />
      </div>
    </div>
  );
}