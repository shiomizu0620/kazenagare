import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'wa-black': '#2B2B2B', // 消炭色
        'wa-white': '#F2F2F2', // 胡粉色
        'wa-red': '#A52175',   // 牡丹色
        'wa-gold': '#B8860B',  // 黄土色
      },
      fontFamily: {
        'serif': ['"Noto Serif JP"', 'serif'],
      },
    },
  },
  plugins: [],
};
export default config;