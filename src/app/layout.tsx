import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react"; // アナリティクス分析用
import "./globals.css";
import Link from "next/link"; // 追加

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "kazenagare | 勉強・作業が捗る環境音と癒やしの箱庭",
  description: "ブラウザで開ける無料の環境音ツール。風鈴や虫の音を重ねて、自分だけの集中できる空間（庭）を作りましょう。インストール不要で、学校のPCやスマホのブラウザですぐに使えます。",
  keywords: ["作業用BGM", "環境音", "勉強", "集中", "ブラウザ", "無料", "箱庭"],
  robots: "noindex, nofollow",// ここはまだ開発中のサイトなので、検索エンジンにインデックスされないようにするための設定です。
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}

        {/* フッターを追加 */}
        <footer id="site-footer" className="w-full py-6 border-t border-[#3e3223]/5 bg-[#f3e5cd]/30 text-[10px] text-center space-x-6">
          <Link href="/privacy" className="hover:underline opacity-60">プライバシーポリシー</Link>
          <Link href="/credits" className="hover:underline opacity-60">クレジット</Link>
          <span className="opacity-40">© 2026 liberis</span>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
