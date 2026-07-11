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
    <html lang="en" data-theme="sprint">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-base-200 text-base-content antialiased`}
      >
        <Nav />
        {children}
      </body>
    </html>
  );
}
