import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Content Agent — AI Writer",
  description: "Generate SEO-optimised Polish articles using a 3-agent AI pipeline",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body style={{ minHeight: "100vh" }}>{children}</body>
    </html>
  );
}
