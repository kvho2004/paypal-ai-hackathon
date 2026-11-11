import type { Metadata } from "next";
import { Fredoka, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Rounded display face for Krumms headings, close to the chunky hand-drawn feel of the logo.
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Krumms",
  description: "One app, one AI agent, all your restaurant rewards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fredoka.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
