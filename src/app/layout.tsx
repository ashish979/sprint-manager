import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Nav } from "./_components/nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sprint Manager",
  description: "Standups and duty rotations for your team, right inside Slack.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div
          aria-hidden
          className="glow-pulse pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-gradient-to-b from-[#4A154B]/15 via-[#4A154B]/7 to-transparent blur-2xl dark:from-[#4A154B]/28 dark:via-[#4A154B]/14"
        />
        <Nav />
        {children}
      </body>
    </html>
  );
}
