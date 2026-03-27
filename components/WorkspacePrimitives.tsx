import Link from "next/link";

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
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
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
  contentClassName = "",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`.trim()}
    >
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {aside ? (
          <div className="flex shrink-0 flex-row flex-wrap items-center justify-start gap-2 sm:justify-end">
            {aside}
          </div>
        ) : null}
      </div>
      <div className={`mt-6 min-h-0 ${contentClassName}`.trim()}>{children}</div>
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
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : tone === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-slate-200 bg-slate-50 text-slate-700";
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
        <span className="rounded-full border border-current/15 bg-white/50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em]">
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
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <p className="text-base font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500"
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
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
          >
            <span
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                item.done
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {item.done ? "OK" : "-"}
            </span>
            <span className="text-sm font-medium text-slate-700">{item.label}</span>
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
      ? "bg-emerald-100 text-emerald-700"
      : tone === "warning"
        ? "bg-amber-100 text-amber-700"
        : tone === "error"
          ? "bg-red-100 text-red-700"
          : tone === "info"
            ? "bg-sky-100 text-sky-700"
            : "bg-slate-200 text-slate-700";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClass}`}>
      {label}
    </span>
  );
}

export function ActivityFeed({
  title,
  description,
  items,
  className = "",
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
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`.trim()}
    >
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      ) : null}
      <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
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
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      ) : null}
      <div className="mt-4 grid gap-3">
        {steps.map((step, index) => {
          const toneClass = step.complete
            ? "border-emerald-200 bg-emerald-50"
            : step.active
              ? "border-sky-200 bg-sky-50"
              : "border-slate-200 bg-white";
          const badgeClass = step.complete
            ? "bg-emerald-100 text-emerald-700"
            : step.active
              ? "bg-sky-100 text-sky-700"
              : "bg-slate-100 text-slate-500";

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
                  <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{step.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
