import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react"; // アナリティクス分析用
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const isProduction = process.env.NODE_ENV === "production";

export const metadata: Metadata = {
  title: "風流 - Kazenagare",
  description: "声を和の情景へ溶け込ませるインタラクティブ体験",
  robots: isProduction
    ? "index, follow"
    : "noindex, nofollow", // 開発・ステージング環境ではインデックスされないようにし、本番環境ではインデックスを許可します。
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
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  );
}
