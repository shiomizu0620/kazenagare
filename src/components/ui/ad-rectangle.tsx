'use client';

export function AdRectangle() {
  return (
    <div className="w-[300px] h-[250px] bg-white/10 border border-white/20 flex items-center justify-center rounded-lg">
      <span className="text-xs tracking-[0.1em] text-white/40">スポンサーリンク</span>
      {/* ここにローディング画面用の広告タグを配置します */}
    </div>
  );
}