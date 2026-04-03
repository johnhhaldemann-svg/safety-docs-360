import Link from "next/link";

/**
 * Use on native `<select>` elements in the authenticated app so the closed control and
 * (where the OS allows) the dropdown list stay dark-on-light-text. Complements
 * `html { color-scheme: dark }` in globals.css.
 */
export const appNativeSelectClassName =
  "rounded-xl border border-slate-600/90 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 [color-scheme:dark] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/35";

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-700/80 bg-slate-900/80 p-6 shadow-lg sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-300">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-[1.65] text-slate-300">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}

export function SectionCard({
  title,
  description,
  children,
  aside,
  className = "",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-700/80 bg-slate-900/80 p-6 shadow-lg ${className}`.trim()}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-relaxed text-slate-300">{description}</p> : null}
        </div>
        {aside}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function InlineMessage({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "error";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-100"
      : tone === "warning"
        ? "border-amber-500/35 bg-amber-950/45 text-amber-100/95"
        : tone === "error"
          ? "border-red-500/35 bg-red-950/40 text-red-100"
          : "border-slate-600 bg-slate-950/50 text-slate-300";
  const label =
    tone === "success"
      ? "Success"
      : tone === "warning"
        ? "Attention"
        : tone === "error"
          ? "Error"
          : "Update";

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${toneClass}`}>
      <div className="flex items-start gap-3">
        <span className="rounded-full border border-current/20 bg-white/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em]">
          {label}
        </span>
        <div className="flex-1 pt-0.5">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-950/40 p-8 text-center">
      <p className="text-base font-semibold text-slate-100">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex rounded-xl bg-[linear-gradient(135deg,_#0d9488_0%,_#059669_100%)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(13,148,136,0.25)] transition hover:opacity-95"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function StartChecklist({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; done: boolean }>;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-950/40 p-5">
      <h3 className="text-base font-semibold text-slate-100">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-3"
          >
            <span
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                item.done
                  ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/35"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {item.done ? "OK" : "-"}
            </span>
            <span className="text-sm font-medium text-slate-300">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "error" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/30"
      : tone === "warning"
        ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/30"
        : tone === "error"
          ? "bg-red-500/20 text-red-200 ring-1 ring-red-500/30"
          : tone === "info"
            ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/30"
            : "bg-slate-700 text-slate-200 ring-1 ring-slate-600";

  return (
    <span
      className={`inline-flex min-h-[1.625rem] items-center justify-center rounded-full px-3.5 py-1.5 text-center text-xs font-semibold leading-none ${toneClass}`}
    >
      {label}
    </span>
  );
}

export function ActivityFeed({
  title,
  description,
  items,
}: {
  title: string;
  description?: string;
  items: Array<{
    id: string;
    title: string;
    detail: string;
    meta: string;
    tone?: "neutral" | "success" | "warning" | "error" | "info";
  }>;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5 shadow-lg">
      <h3 className="text-base font-semibold text-slate-100">{title}</h3>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      ) : null}
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-slate-700/60 bg-slate-950/50 px-4 py-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">{item.detail}</p>
              </div>
              <StatusBadge label={item.meta} tone={item.tone ?? "neutral"} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorkflowPath({
  title,
  description,
  steps,
}: {
  title: string;
  description?: string;
  steps: Array<{
    label: string;
    detail: string;
    active?: boolean;
    complete?: boolean;
  }>;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-950/40 p-5">
      <h3 className="text-base font-semibold text-slate-100">{title}</h3>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      ) : null}
      <div className="mt-4 grid gap-3">
        {steps.map((step, index) => {
          const toneClass = step.complete
            ? "border-emerald-500/35 bg-emerald-950/30"
            : step.active
              ? "border-teal-500/40 bg-teal-950/25"
              : "border-slate-700/80 bg-slate-900/50";
          const badgeClass = step.complete
            ? "bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-500/35"
            : step.active
              ? "bg-teal-500/25 text-teal-100 ring-1 ring-teal-400/35"
              : "bg-slate-800 text-slate-400";

          return (
            <div
              key={step.label}
              className={`rounded-xl border px-4 py-4 ${toneClass}`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${badgeClass}`}
                >
                  {step.complete ? "OK" : index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-100">{step.label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{step.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
