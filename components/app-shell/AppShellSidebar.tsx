"use client";

import Image from "next/image";
import Link from "next/link";
import type { NavSection } from "@/lib/appNavigation";
import { isWorkspaceNavActive } from "@/lib/workspaceNavActive";
import { formatUserRoleLabel, getUserDisplayName } from "@/lib/userRoleDisplay";
import { getWorkspaceNavItemMeta } from "@/lib/workspaceNavigationModel";
import { getNavSectionIcon } from "@/lib/navSectionIcon";
import { ProfileAvatar, type ProfileSummary } from "./ProfileAvatar";
import { ChevronDownIcon } from "./shellIcons";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type KeyedNavSection = NavSection & { key: string };

type AppShellSidebarProps = {
  pathname: string;
  mobileMenuOpen: boolean;
  onNavLinkActivate: () => void;
  keyedSideSections: KeyedNavSection[];
  expandedSectionKey: string | null;
  onToggleSection: (key: string) => void;
  profileSummary: ProfileSummary | null;
  userEmail: string;
  userRole: string;
  workspaceLabel: string;
  accountStatus: string;
  onLogout: () => void;
};

export function AppShellSidebar({
  pathname,
  mobileMenuOpen,
  onNavLinkActivate,
  keyedSideSections,
  expandedSectionKey,
  onToggleSection,
  profileSummary,
  userEmail,
  userRole,
  workspaceLabel,
  accountStatus,
  onLogout,
}: AppShellSidebarProps) {
  return (
    <aside
      className={cx(
        "fixed inset-y-0 left-0 z-50 h-dvh w-[280px] max-w-[84vw] border-r border-[var(--app-border)] bg-[linear-gradient(180deg,_#fbfdff_0%,_#f3f7fe_58%,_#edf4fb_100%)] text-[var(--app-text-strong)] transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:w-[236px] lg:max-w-none lg:translate-x-0",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="p-3.5 pb-1">
          <div className="relative h-[4.9rem] w-full">
            <Image
              src="/brand/safety360docs-reference-neon-tight.png"
              alt="Safety360Docs by Reliance EHS"
              fill
              priority
              sizes="236px"
              className="object-contain object-left"
            />
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
          <div className="px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Menu</div>
          <div className="mt-3 space-y-0">
            {keyedSideSections.map((section, sectionIndex) => {
              const sectionDescription = (section as { description?: string }).description ?? "";
              const isExpanded = expandedSectionKey === section.key;
              const sectionContentId = `nav-section-panel-${section.key}`;
              const SectionIcon = getNavSectionIcon(section);
              return (
                <div
                  key={`nav-section-${sectionIndex}-${section.title}`}
                  className={sectionIndex > 0 ? "mt-4 border-t border-[var(--app-border)] pt-4" : ""}
                >
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={sectionContentId}
                    onClick={() => onToggleSection(section.key)}
                    className={cx(
                      "flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2 text-left transition duration-150",
                      isExpanded
                        ? "bg-white/78 text-[var(--app-text-strong)] shadow-sm ring-1 ring-[var(--app-accent-border-20)]"
                        : "text-slate-500 hover:bg-white/64 hover:text-[var(--app-text-strong)]"
                    )}
                  >
                    <div className="flex min-w-0 gap-2.5">
                      <span
                        className={cx(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--app-border-subtle)] bg-white/80 text-[var(--app-muted)] shadow-sm transition",
                          isExpanded && "border-[var(--app-accent-border-22)] text-[var(--app-accent-primary)]"
                        )}
                        aria-hidden
                      >
                        <SectionIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </span>
                      <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em]">{section.title}</div>
                      {sectionDescription ? (
                        <div className="mt-1 text-[10.5px] leading-4 text-[var(--app-muted)]">{sectionDescription}</div>
                      ) : null}
                      </div>
                    </div>
                    <span
                      className={cx(
                        "mt-0.5 inline-flex shrink-0 rounded-full border border-[var(--app-border)] bg-white/90 p-1 text-[var(--app-muted)]",
                        isExpanded && "text-[var(--app-accent-primary)]"
                      )}
                    >
                      <ChevronDownIcon expanded={isExpanded} />
                    </span>
                  </button>
                  <div
                    id={sectionContentId}
                    className={cx(
                      "grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-200 ease-out",
                      isExpanded ? "mt-1.5 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"
                    )}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="space-y-1 px-1 pb-1">
                        {section.items.map((item) => {
                          const active = isWorkspaceNavActive(pathname, item.href);
                          const navMeta = getWorkspaceNavItemMeta(item);
                          return (
                            <Link
                              key={`${section.title}-${item.href}`}
                              href={item.href}
                              className={cx(
                                "relative flex items-center rounded-xl border py-2.5 pl-3.5 pr-3 transition duration-150",
                                active
                                  ? "border-[var(--app-accent-border-24)] bg-white text-[var(--app-text-strong)] shadow-[0_6px_14px_rgba(37,99,235,0.1)] before:absolute before:inset-y-2.5 before:left-1 before:w-1 before:rounded-full before:bg-[var(--app-accent-primary)]"
                                  : "border-transparent text-[var(--app-text)] hover:bg-white/70 hover:text-[var(--app-text-strong)]"
                              )}
                              onClick={onNavLinkActivate}
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-[var(--app-text-strong)]">
                                  {item.label}
                                </div>
                                {!active ? (
                                  <div className="mt-0.5 truncate text-[10px] text-[var(--app-muted)]">
                                    {navMeta.description}
                                  </div>
                                ) : null}
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </nav>

        <div className="shrink-0 border-t border-white/10 bg-[rgba(244,248,255,0.92)] p-2.5 backdrop-blur">
          <div className="rounded-xl border border-[var(--app-border)] bg-white/84 p-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">Signed In</div>
            <div className="mt-3 flex items-center gap-3">
              <ProfileAvatar profile={profileSummary} email={userEmail} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--app-text-strong)]">
                  {getUserDisplayName(profileSummary, userEmail)}
                </div>
                <div className="mt-1 truncate text-xs text-[var(--app-text)]">
                  {profileSummary?.jobTitle || formatUserRoleLabel(userRole)}
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--app-accent-primary)]">
              {profileSummary?.tradeSpecialty || formatUserRoleLabel(userRole)}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-xs text-[var(--app-text)]">
              <span>{workspaceLabel}</span>
              <span className="capitalize">{accountStatus}</span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="app-btn-primary mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-bold app-shadow-action transition"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
