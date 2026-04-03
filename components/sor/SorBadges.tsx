export function SorStatusBadge({ status }: { status: string }) {
  const tone =
    status === "draft"
      ? "bg-slate-800/70 text-slate-300"
      : status === "submitted"
        ? "bg-blue-100 text-blue-800"
        : status === "locked"
          ? "bg-purple-100 text-purple-800"
          : "bg-amber-100 text-amber-100";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{status}</span>;
}

export function SorVerificationBadge({ result }: { result: "valid" | "invalid" | "broken_chain" }) {
  const ok = result === "valid";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        ok ? "bg-emerald-100 text-emerald-100" : "bg-red-100 text-red-100"
      }`}
    >
      {ok ? "Audit Verified" : "Audit Failed"}
    </span>
  );
}
