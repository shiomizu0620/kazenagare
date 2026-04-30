import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://kazenagare.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "kazenagare（風流）| 無料の和風環境音ブラウザアプリ",
    template: "%s | kazenagare",
  },
  description: "ブラウザで開ける無料の環境音ツール。風鈴・虫の音・焚き火など和の音を重ねて、自分だけの箱庭を作ろう。インストール不要、スマホ・PCどちらでもすぐ使えます。",
  keywords: ["環境音", "作業用BGM", "和風", "風鈴", "箱庭", "無料", "ブラウザ", "勉強", "集中", "環境音 ブラウザ", "和風 BGM"],
  robots: "noindex, nofollow", // 公開時にこの行を削除する
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: BASE_URL,
    siteName: "kazenagare（風流）",
    title: "kazenagare（風流）| 無料の和風環境音ブラウザアプリ",
    description: "風鈴・虫の音・焚き火など和の音を重ねて、自分だけの箱庭を作ろう。無料・インストール不要。",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "kazenagare - 和風環境音ブラウザアプリ" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "kazenagare（風流）| 無料の和風環境音ブラウザアプリ",
    description: "風鈴・虫の音・焚き火など和の音を重ねて、自分だけの箱庭を作ろう。無料・インストール不要。",
    images: ["/og-image.png"],
  },
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
          <Link href="/terms" className="hover:underline opacity-60">利用規約</Link>
          <Link href="/privacy" className="hover:underline opacity-60">プライバシーポリシー</Link>
          <Link href="/credits" className="hover:underline opacity-60">クレジット</Link>
          <span className="opacity-40">© 2026 liberis</span>
        </footer>
        <Analytics />
        <Script src="https://adm.shinobi.jp/s/421273f2126a8320a1990c975a42196a" strategy="afterInteractive" />
      </body>
    </html>
  );
}
