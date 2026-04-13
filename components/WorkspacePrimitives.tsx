import Link from "next/link";

/**
 * Use on native `<select>` elements in the authenticated app so the closed control and
 * (where the OS allows) the dropdown list match the light enterprise shell.
 */
export const appNativeSelectClassName =
  "rounded-xl border border-[var(--app-border-strong)] bg-[rgba(255,255,255,0.98)] px-4 py-2.5 text-sm text-[var(--app-text-strong)] shadow-[0_8px_18px_rgba(76,108,161,0.06)] outline-none transition focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[rgba(79,125,243,0.18)]";

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
    <section className="rounded-3xl border border-[var(--app-border-strong)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(241,247,255,0.96)_100%)] p-6 shadow-[var(--app-shadow)] sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--app-accent-primary)]">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--app-text-strong)] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-[1.65] text-[var(--app-text)]">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3 lg:justify-end">{actions}</div> : null}
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
      className={`rounded-2xl border border-[var(--app-border-strong)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(241,247,255,0.94)_100%)] p-6 shadow-[var(--app-shadow-soft)] ${className}`.trim()}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--app-text-strong)]">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-relaxed text-[var(--app-text)]">{description}</p> : null}
        </div>
        {aside}
      </div>
      <div className="mt-6 space-y-5">{children}</div>
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
      ? "border-[rgba(46,158,91,0.24)] bg-[var(--semantic-success-bg)] text-[var(--semantic-success)]"
      : tone === "warning"
        ? "border-[rgba(217,164,65,0.28)] bg-[var(--semantic-warning-bg)] text-[var(--semantic-warning)]"
        : tone === "error"
          ? "border-[rgba(217,83,79,0.28)] bg-[var(--semantic-danger-bg)] text-[var(--semantic-danger)]"
          : "border-[rgba(138,150,168,0.3)] bg-[var(--semantic-neutral-bg)] text-[var(--semantic-neutral)]";
  const label =
    tone === "success"
      ? "Success"
      : tone === "warning"
        ? "Attention"
        : tone === "error"
          ? "Error"
          : "Notice";

  return (
    <div className={`rounded-2xl border px-4 py-3.5 text-sm shadow-[0_8px_20px_rgba(76,108,161,0.06)] ${toneClass}`}>
      <div className="flex items-start gap-3">
        <span className="rounded-full border border-current/15 bg-white/55 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em]">
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
    <div className="rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.94)_0%,_rgba(241,247,255,0.9)_100%)] p-8 text-center shadow-[var(--app-shadow-soft)]">
      <p className="text-base font-semibold text-[var(--app-text-strong)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">{description}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex rounded-xl bg-[var(--app-accent-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_22px_rgba(79,125,243,0.22)] transition hover:bg-[var(--app-accent-primary-hover)] active:bg-[var(--app-accent-primary-active)]"
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
    <div className="rounded-2xl border border-[var(--app-border)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.94)_0%,_rgba(244,249,255,0.9)_100%)] p-5 shadow-[var(--app-shadow-soft)]">
      <h3 className="text-base font-semibold text-[var(--app-text-strong)]">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] px-4 py-3.5"
          >
            <span
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                item.done
                  ? "bg-[var(--semantic-success-bg)] text-[var(--semantic-success)] ring-1 ring-[rgba(46,158,91,0.2)]"
                  : "bg-[var(--semantic-neutral-bg)] text-[var(--semantic-neutral)]"
              }`}
            >
              {item.done ? "OK" : "-"}
            </span>
            <span className="text-sm font-medium text-[var(--app-text)]">{item.label}</span>
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
      ? "bg-[#d8f1e2] text-[#247c49] ring-1 ring-[rgba(46,158,91,0.24)]"
      : tone === "warning"
        ? "bg-[#fdeabf] text-[#9b6b12] ring-1 ring-[rgba(217,164,65,0.24)]"
        : tone === "error"
          ? "bg-[#fad9d8] text-[#b94440] ring-1 ring-[rgba(217,83,79,0.24)]"
          : tone === "info"
            ? "bg-[#d8e6ff] text-[#325fda] ring-1 ring-[rgba(79,125,243,0.22)]"
            : "bg-[#e7edf5] text-[#637387] ring-1 ring-[rgba(138,150,168,0.18)]";

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
    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(241,247,255,0.94)_100%)] p-5 shadow-[var(--app-shadow-soft)]">
      <h3 className="text-base font-semibold text-[var(--app-text-strong)]">{title}</h3>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">{description}</p>
      ) : null}
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] px-4 py-4.5"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--app-text-strong)]">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--app-text)]">{item.detail}</p>
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
    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(241,247,255,0.9)_100%)] p-5 shadow-[var(--app-shadow-soft)]">
      <h3 className="text-base font-semibold text-[var(--app-text-strong)]">{title}</h3>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">{description}</p>
      ) : null}
      <div className="mt-4 grid gap-3">
        {steps.map((step, index) => {
          const toneClass = step.complete
            ? "border-[rgba(46,158,91,0.2)] bg-[var(--semantic-success-bg)]"
            : step.active
              ? "border-[rgba(79,125,243,0.2)] bg-[var(--semantic-info-bg)]"
              : "border-[var(--app-border)] bg-[var(--app-panel)]";
          const badgeClass = step.complete
            ? "bg-[var(--semantic-success-bg)] text-[var(--semantic-success)] ring-1 ring-[rgba(46,158,91,0.2)]"
            : step.active
              ? "bg-[var(--semantic-info-bg)] text-[var(--semantic-info)] ring-1 ring-[rgba(79,125,243,0.2)]"
              : "bg-[var(--semantic-neutral-bg)] text-[var(--semantic-neutral)]";

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
                  <p className="text-sm font-semibold text-[var(--app-text-strong)]">{step.label}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--app-text)]">{step.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
