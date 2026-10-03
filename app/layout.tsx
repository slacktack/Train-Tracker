import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Handjet, Noto_Sans_Devanagari } from "next/font/google";
import { cookies } from "next/headers";
import { QueryProvider } from "@/providers/QueryProvider";
import { LangProvider, LANG_COOKIE, type Lang } from "@/lib/i18n/LangProvider";
import { AppNav } from "@/components/Nav/AppNav";
import { AlarmWatcher } from "@/components/Alarms/AlarmWatcher";
import { ThemeSync } from "@/components/ThemeSync";
import { NavTracker } from "@/lib/useGoBack";
import { OfflineLayer } from "@/components/Offline/OfflineLayer";
import { themeForIST } from "@/lib/theme";
import "./globals.css";

// Bricolage Grotesque: a characterful grotesk with an optical-size axis, so
// small UI text stays sturdy and headings get tighter and more expressive.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  axes: ["opsz", "wdth"],
  display: "swap",
});
// Handjet is a dot-matrix face; ELSH=16 turns the dots round like station LED boards.
const handjet = Handjet({
  subsets: ["latin"],
  variable: "--font-led",
  axes: ["ELGR", "ELSH"],
  display: "swap",
});
// Train names are frequently shown in Hindi (nameUnicode) — Inter has no
// Devanagari glyphs, so without this the browser silently falls back to
// whatever system font is installed, clashing with the rest of the UI.
const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-devanagari",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Train Tracker",
  description: "Live train tracking across India — real-time position, delay, and ETA.",
  manifest: "/manifest.webmanifest",
  applicationName: "Train Tracker",
  appleWebApp: {
    capable: true,
    title: "Train Tracker",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: "/icon.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E9EDF3" },
    { media: "(prefers-color-scheme: dark)", color: "#070B14" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Day → light, night → dark (IST). Server-rendered so there's no theme flash;
  // the client useTimeTheme() hook keeps it in sync while the tab stays open.
  const theme = themeForIST();
  const lang: Lang = cookies().get(LANG_COOKIE)?.value === 'hi' ? 'hi' : 'en';
  return (
    <html
      lang={lang}
      className={`${theme === 'dark' ? 'dark' : ''} ${bricolage.variable} ${handjet.variable} ${notoDevanagari.variable}`}
    >
      <body className="font-sans antialiased">
        <LangProvider initial={lang}>
          <QueryProvider>
            {children}
            <AppNav />
            <AlarmWatcher />
            <OfflineLayer />
            <NavTracker />
            <ThemeSync />
          </QueryProvider>
        </LangProvider>
      </body>
    </html>
  );
}
