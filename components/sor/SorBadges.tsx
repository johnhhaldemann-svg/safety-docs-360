export function SorStatusBadge({ status }: { status: string }) {
  const tone =
    status === "draft"
      ? "bg-[var(--semantic-neutral-bg)] text-[var(--semantic-neutral)] ring-1 ring-[rgba(138,150,168,0.16)]"
      : status === "submitted"
        ? "bg-[var(--semantic-warning-bg)] text-[var(--semantic-warning)] ring-1 ring-[rgba(217,164,65,0.18)]"
        : status === "locked"
          ? "bg-[var(--semantic-success-bg)] text-[var(--semantic-success)] ring-1 ring-[rgba(46,158,91,0.18)]"
          : "bg-[var(--semantic-info-bg)] text-[var(--semantic-info)] ring-1 ring-[var(--app-accent-surface-18)]";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {status}
    </span>
  );
}

export function SorVerificationBadge({ result }: { result: "valid" | "invalid" | "broken_chain" }) {
  const ok = result === "valid";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        ok
          ? "bg-[var(--semantic-success-bg)] text-[var(--semantic-success)] ring-1 ring-[rgba(46,158,91,0.18)]"
          : "bg-[var(--semantic-danger-bg)] text-[var(--semantic-danger)] ring-1 ring-[rgba(217,83,79,0.18)]"
      }`}
    >
      {ok ? "Audit Verified" : "Audit Failed"}
    </span>
  );
}
