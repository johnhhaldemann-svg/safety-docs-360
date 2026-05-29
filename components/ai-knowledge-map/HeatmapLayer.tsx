export function HeatmapLayer({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(239,68,68,0.18),transparent_34%),radial-gradient(circle_at_64%_58%,rgba(234,179,8,0.13),transparent_28%)] mix-blend-screen" />
  );
}
