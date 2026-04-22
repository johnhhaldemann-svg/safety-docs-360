import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>
        <a href="#main-content" className="app-skip-link">
          Skip to main content
        </a>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}