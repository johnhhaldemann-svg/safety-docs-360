"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]:not([disabled])",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.offsetParent !== null || element === document.activeElement
  );
}

export type UseFocusTrapOptions = {
  active: boolean;
  onEscape?: () => void;
  initialFocus?: RefObject<HTMLElement | null>;
  returnFocusOnClose?: boolean;
};

/**
 * Traps keyboard focus within the referenced container while `active`.
 *
 * - Cycles Tab / Shift+Tab between the first and last focusable elements.
 * - Optionally calls `onEscape` when Escape is pressed.
 * - On activation, moves focus to `initialFocus?.current` if provided, else the
 *   first focusable element inside the container.
 * - On deactivation, restores focus to the element that was focused before the
 *   trap engaged (when `returnFocusOnClose` is not explicitly false).
 */
export function useFocusTrap<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  { active, onEscape, initialFocus, returnFocusOnClose = true }: UseFocusTrapOptions
) {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const initialTarget = initialFocus?.current ?? getFocusableElements(container)[0] ?? container;
    if (initialTarget && !container.contains(document.activeElement)) {
      window.setTimeout(() => initialTarget.focus(), 0);
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onEscape) {
        event.preventDefault();
        onEscape();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusables = getFocusableElements(container);
      if (focusables.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (current === first || !container.contains(current)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (current === last || !container.contains(current)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (returnFocusOnClose && previouslyFocused.current) {
        window.setTimeout(() => {
          previouslyFocused.current?.focus();
          previouslyFocused.current = null;
        }, 0);
      }
    };
  }, [active, containerRef, onEscape, initialFocus, returnFocusOnClose]);
}
