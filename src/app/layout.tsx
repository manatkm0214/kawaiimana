import React from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Balance",
  description: "Shared household dashboard with goals, budget presets, and design customization.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = {
    "--font-geist-sans": '"Segoe UI", "Hiragino Sans", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif',
    "--font-geist-mono": '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  } as React.CSSProperties;

  return (
    <html lang="ja" data-theme="light" className="h-full antialiased" style={fontVars}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var bg=localStorage.getItem('kakeibo-custom-bg');if(bg)document.documentElement.style.setProperty('--background',bg);var theme=localStorage.getItem('kakeibo-theme')||'light';document.documentElement.setAttribute('data-theme',theme);if(theme==='dark')document.documentElement.classList.add('dark');}catch(e){document.documentElement.setAttribute('data-theme','light');}})()`,
          }}
        />
      </head>
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">{children}</body>
    </html>
  );
}
