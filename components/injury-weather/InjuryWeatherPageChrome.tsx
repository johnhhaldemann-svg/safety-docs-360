import Link from "next/link";

/**
 * Light-shell context above the dark Safety Forecast dashboard so the route
 * reads as part of the same product (plan: minimal “embedded dark” strategy).
 */
export function InjuryWeatherPageChrome() {
  return (
    <div className="mb-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-solid)] px-4 py-3 text-sm shadow-[var(--app-shadow-soft)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-muted)]">Safety Forecast</p>
      <p className="mt-1 text-[var(--app-text)]">
        <span className="font-semibold text-[var(--app-text-strong)]">Injury Weather analytics</span>
        <span className="text-[var(--app-muted)]"> — </span>
        The module below uses a high-contrast forecast theme.{" "}
        <Link
          href="/dashboard"
          className="font-semibold text-[var(--app-accent-primary)] underline-offset-2 hover:underline"
        >
          Return to workspace home
        </Link>
      </p>
    </div>
  );
}
