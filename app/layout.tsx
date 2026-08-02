import type { Metadata } from "next";
import localFont from "next/font/local";
import { QueryProvider } from "@/providers/QueryProvider";
import { themeForIST } from "@/lib/theme";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});
const spaceGrotesk = localFont({
  src: "./fonts/SpaceGrotesk-VariableFont_wght.woff2",
  variable: "--font-display",
  weight: "300 700",
});

export const metadata: Metadata = {
  title: "Train Tracker",
  description: "Real-time train tracking web app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Day → light, night → dark (IST). Server-rendered so there's no theme flash;
  // the client useTimeTheme() hook keeps it in sync while the tab stays open.
  const theme = themeForIST();
  return (
    <html lang="en" className={theme === 'dark' ? 'dark' : ''}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} antialiased`}
      >
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
