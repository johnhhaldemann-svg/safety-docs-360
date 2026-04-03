"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NavItem } from "@/lib/appNavigation";

type AppCommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NavItem[];
};

export function AppCommandPalette({ open, onOpenChange, items }: AppCommandPaletteProps) {
  const [query, setQuery] = useState("");
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
    if (open) {
      setQuery("");
      const t = window.setTimeout(() => inputRef.current?.focus(), 10);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        onOpenChange(false);
      }
    },
    [open, onOpenChange]
  );

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4">
      <button
        type="button"
        aria-label="Close command menu"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Go to page"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-600 bg-slate-900 shadow-[0_24px_48px_rgba(0,0,0,0.45)]"
      >
        <div className="border-b border-slate-700/80 p-3">
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
            className="w-full rounded-xl border border-slate-600 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-teal-500"
          />
          <p className="mt-2 px-1 text-xs text-slate-500">
            Jump to a workspace page. Press Esc to close.
          </p>
        </div>
        <ul
          className="max-h-[min(50vh,360px)] overflow-y-auto p-2"
          role="listbox"
          aria-label="Matching pages"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-slate-500">No matches</li>
          ) : (
            filtered.map((item) => (
              <li key={item.href} role="option">
                <Link
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-white/10 active:bg-white/15"
                >
                  <span className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/20 text-[11px] font-black text-teal-100">
                    {item.short}
                  </span>
                  <span className="min-w-0 flex-1 font-medium">{item.label}</span>
                  <span className="truncate text-xs text-slate-500">{item.href}</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
