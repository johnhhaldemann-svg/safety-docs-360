export function SorStatusBadge({ status }: { status: string }) {
  const tone =
    status === "draft"
      ? "bg-slate-100 text-slate-700"
      : status === "submitted"
        ? "bg-blue-100 text-blue-800"
        : status === "locked"
          ? "bg-purple-100 text-purple-800"
          : "bg-amber-100 text-amber-800";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{status}</span>;
}

export function SorVerificationBadge({ result }: { result: "valid" | "invalid" | "broken_chain" }) {
  const ok = result === "valid";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
      }`}
    >
      {ok ? "Audit Verified" : "Audit Failed"}
    </span>
  );
}
