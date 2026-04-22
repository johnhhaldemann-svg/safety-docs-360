"use client";

import Link from "next/link";
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
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4">
      <button
        type="button"
        aria-label="Close command menu"
        className="absolute inset-0 bg-[rgba(37,99,235,0.07)] backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Go to page"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-[var(--app-border-subtle)] bg-white/95 shadow-[var(--app-shadow-soft)]"
      >
        <div className="border-b border-[var(--app-border)] p-3">
          <label htmlFor="command-palette-input" className="sr-only">
            Search pages
          </label>
          <input
            ref={inputRef}
            id="command-palette-input"
            type="search"
            autoComplete="off"
            placeholder="Go to…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 text-sm text-[var(--app-text-strong)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)]"
          />
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
                  className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--app-text)] transition hover:bg-[var(--app-accent-primary-soft)] active:bg-[rgba(79,125,243,0.12)]"
                >
                  <span className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(79,125,243,0.14)] text-[11px] font-black text-[var(--app-accent-primary)]">
                    {item.short}
                  </span>
                  <span className="min-w-0 flex-1 font-medium">{item.label}</span>
                  <span className="truncate text-xs text-[var(--app-muted)]">{item.href}</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
