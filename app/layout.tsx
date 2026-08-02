import type { Metadata } from "next";
import { Inter, Space_Grotesk, Noto_Sans_Devanagari } from "next/font/google";
import { QueryProvider } from "@/providers/QueryProvider";
import { themeForIST } from "@/lib/theme";
import "./globals.css";

// Inter is tuned for UI legibility at small sizes, which is most of this
// app's body text (11-14px labels, stats, station rows).
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  weight: ["400", "500", "600", "700"],
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
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
        className={`${inter.variable} ${spaceGrotesk.variable} ${notoDevanagari.variable} antialiased`}
      >
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
