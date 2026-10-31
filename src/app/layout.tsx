import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], weight: ["400", "500"], display: "swap" });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["italic"], weight: ["500"], display: "swap" });

export const metadata: Metadata = {
  title: "DeckCraft — Give a topic, get a ready deck",
  description: "Research-backed academic presentations for students. Real sources, designed slides, your college's title slide. Free preview, PDF and editable PowerPoint.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F5F0E6",
};

/**
 * Runs before first paint: marks JS (for scroll reveals) and turns the glass blur off on budget phones
 * (low memory or few cores, data saver, reduced transparency, or no backdrop-filter support).
 * ?fx=low / ?fx=full force either mode for testing.
 */
const FX = `(function(){var d=document.documentElement;d.classList.add('js');try{var n=navigator,q=location.search,m=n.deviceMemory,c=n.hardwareConcurrency,a=/Android/i.test(n.userAgent),s=n.connection&&n.connection.saveData,low=(m&&m<=2)||(a&&m&&m<=4)||(c&&c<=4)||s||!(window.CSS&&(CSS.supports('backdrop-filter','blur(1px)')||CSS.supports('-webkit-backdrop-filter','blur(1px)')))||matchMedia('(prefers-reduced-transparency: reduce)').matches;if(/fx=low/.test(q))low=true;if(/fx=full/.test(q))low=false;if(low)d.classList.add('lowfx')}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${newsreader.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: FX }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
