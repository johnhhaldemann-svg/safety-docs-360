import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Safety360Docs",
    template: "%s | Safety360Docs",
  },
  description: "Enterprise safety and compliance document workspace.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {/* Sync table density before React so `useTableDensity` + first paint align with localStorage */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='safety360:tableDensity';var d=localStorage.getItem(k);if(d==='compact')document.documentElement.setAttribute('data-table-density','compact');else document.documentElement.removeAttribute('data-table-density');}catch(e){}})();`,
          }}
        />
        <a href="#main-content" className="app-skip-link">
          Skip to main content
        </a>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}