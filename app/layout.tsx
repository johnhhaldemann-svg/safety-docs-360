import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "SafePredict | Safety360Docs",
    template: "%s | Safety360Docs",
  },
  description: "SafePredict by Safety360Docs: safety operations for risk, compliance, documentation, and field execution.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${plusJakarta.variable}`}>
      <body>
        {/* Sync table density before React so `useTableDensity` + first paint align with localStorage */}
        <Script
          id="table-density-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='safety360:tableDensity';var d=localStorage.getItem(k);if(d==='compact')document.documentElement.setAttribute('data-table-density','compact');else document.documentElement.removeAttribute('data-table-density');}catch(e){}})();`,
          }}
        />
        <a href="#main-content" className="app-skip-link">
          Skip to main content
        </a>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
