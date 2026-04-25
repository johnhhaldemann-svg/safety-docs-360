"use client";

import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { NavItem } from "@/lib/appNavigation";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

type AppCommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NavItem[];
};

export function AppCommandPalette({ open, onOpenChange, items }: AppCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return items;
    }
    return items.filter((item) => {
      const label = item.label.toLowerCase();
      const href = item.href.toLowerCase();
      const short = item.short.toLowerCase();
      return label.includes(q) || href.includes(q) || short.includes(q);
    });
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    const clearQuery = window.setTimeout(() => setQuery(""), 0);
    return () => {
      window.clearTimeout(clearQuery);
    };
  }, [open]);

  useFocusTrap(dialogRef, {
    active: open,
    onEscape: () => onOpenChange(false),
    initialFocus: inputRef,
  });

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close command menu"
        className="absolute inset-0 bg-[rgba(22,50,79,0.18)] backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Go to page"
        className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--app-border-strong)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(242,247,255,0.98)_100%)] shadow-[0_28px_70px_rgba(38,64,106,0.22)]"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,_var(--app-accent-primary)_0%,_var(--semantic-success)_58%,_var(--semantic-warning)_100%)]" />
        <div className="border-b border-[var(--app-border)] p-4">
          <label htmlFor="command-palette-input" className="sr-only">
            Search pages
          </label>
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--app-border-strong)] bg-white/90 px-4 py-3 shadow-[0_10px_22px_rgba(76,108,161,0.07)]">
            <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--app-muted)]" />
            <input
              ref={inputRef}
              id="command-palette-input"
              type="search"
              autoComplete="off"
              placeholder="Go to..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full border-0 bg-transparent text-sm font-medium text-[var(--app-text-strong)] outline-none placeholder:text-[var(--app-muted)]"
            />
          </div>
          <p className="mt-2 px-1 text-xs text-[var(--app-muted)]">
            Jump to a workspace page. Press Esc to close.
          </p>
        </div>
        <ul
          className="max-h-[min(50vh,360px)] overflow-y-auto p-2"
          role="listbox"
          aria-label="Matching pages"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-[var(--app-muted)]">No matches</li>
          ) : (
            filtered.map((item) => (
              <li key={item.href} role="option" aria-selected={false}>
                <Link
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className="group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--app-text)] transition hover:bg-white/90 hover:shadow-[0_8px_18px_rgba(76,108,161,0.07)] active:bg-[var(--app-accent-surface-12)]"
                >
                  <span className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--app-accent-surface-14)] text-[11px] font-black text-[var(--app-accent-primary)]">
                    {item.short}
                  </span>
                  <span className="min-w-0 flex-1 font-medium">{item.label}</span>
                  <span className="truncate text-xs text-[var(--app-muted)]">{item.href}</span>
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-[var(--app-accent-primary)] opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"
                  />
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
