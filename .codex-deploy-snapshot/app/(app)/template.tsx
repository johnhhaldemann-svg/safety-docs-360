"use client";

/**
 * Remounts on segment navigation; pairs with `.app-page-transition` in globals.css
 * for a subtle enter animation (disabled when `prefers-reduced-motion: reduce` via global rules).
 */
export default function AppSegmentTemplate({ children }: { children: React.ReactNode }) {
  return <div className="app-page-transition">{children}</div>;
}
