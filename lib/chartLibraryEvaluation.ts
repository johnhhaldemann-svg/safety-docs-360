/**
 * Recharts / Visx evaluation for future complex charts (brush, stacked areas, export).
 * Bundle sizes are approximate minified+gzipped; run `npm i recharts@3` and `npx howfat recharts` if you add one.
 * As of 2026 Q2: staying on custom SVG + these metrics keeps the main app chart-free; add a library
 * when a feature clearly needs it (e.g. zoomable X-scale, 6+ series, CSV export with chart).
 */
export const EVALUATION = {
  recharts: {
    when: "Rapid line/area with CartesianGrid, Recharts default tooltips, and responsive containers.",
    tradeoffs: "React component tree; tree-shake only partially; theming to match safety_docs dark panels is manual.",
    approxGzipKb: 45,
  },
  visx: {
    when: "Composable low-level D3-like charts with full control over a11y and layout.",
    tradeoffs: "More wiring than Recharts; multiple @visx/* packages; strong fit if you outgrow hand-rolled SVG.",
    approxGzipKb: 25,
  },
  stayCustom: {
    when: "Sparklines, simple heatmaps, 2–3 line series, and static legends — current approach.",
  },
} as const;
