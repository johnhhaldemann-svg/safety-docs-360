"use client";

/**
 * TourProvider.tsx
 *
 * Context that:
 *  1. Fetches the user's role and tour completion state on mount.
 *  2. Auto-triggers the guided tour for users who haven't seen it yet.
 *  3. Exposes `startTour()` so any component (e.g., a sidebar button) can
 *     manually launch the tour.
 *  4. Persists completion/dismissal back to /api/onboarding/tour.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { GuidedTourModal } from "./GuidedTourModal";
import { getTourSteps } from "./tourConfig";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type TourContextValue = {
  /** Programmatically open the tour (e.g., from a sidebar "Take a Tour" button) */
  startTour: () => void;
  /** True while tour is visible */
  isOpen: boolean;
};

const TourContext = createContext<TourContextValue>({
  startTour: () => undefined,
  isOpen: false,
});

export function useTour(): TourContextValue {
  return useContext(TourContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

type TourState = {
  guided_tour_completed_at: string | null;
  guided_tour_dismissed_at: string | null;
};

const supabase = getSupabaseBrowserClient();

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const hasAutoTriggered = useRef(false);

  // -------------------------------------------------------------------------
  // On mount: fetch role + tour state, auto-trigger if first time
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token || cancelled) return;

        const headers = { Authorization: `Bearer ${session.access_token}` };

        // Fetch user role
        const meRes = await fetch("/api/auth/me", { headers });
        if (!meRes.ok || cancelled) return;
        const me = (await meRes.json().catch(() => null)) as {
          user?: { role?: string };
        } | null;
        const userRole = me?.user?.role ?? null;
        if (cancelled) return;
        setRole(userRole);

        // Fetch tour state
        const tourRes = await fetch("/api/onboarding/tour", { headers });
        const tourState = tourRes.ok
          ? ((await tourRes.json().catch(() => null)) as TourState | null)
          : null;

        if (cancelled) return;

        // Auto-trigger only once if user has never completed OR dismissed
        const seen = tourState?.guided_tour_completed_at || tourState?.guided_tour_dismissed_at;
        if (!seen && !hasAutoTriggered.current) {
          hasAutoTriggered.current = true;
          // Slight delay so the page layout renders first
          window.setTimeout(() => {
            if (!cancelled) setIsOpen(true);
          }, 1200);
        }
      } catch {
        // Non-critical; tour won't auto-trigger but can still be manually started
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Persist tour state to the API
  // -------------------------------------------------------------------------
  const persistTourState = useCallback(async (payload: Partial<TourState>) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      await fetch("/api/onboarding/tour", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch {
      // Non-blocking
    }
  }, []);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const handleFinish = useCallback(() => {
    setIsOpen(false);
    void persistTourState({
      guided_tour_completed_at: new Date().toISOString(),
    });
  }, [persistTourState]);

  const handleDismiss = useCallback(() => {
    setIsOpen(false);
    void persistTourState({
      guided_tour_dismissed_at: new Date().toISOString(),
    });
  }, [persistTourState]);

  const startTour = useCallback(() => {
    setIsOpen(true);
  }, []);

  const steps = getTourSteps(role);

  return (
    <TourContext.Provider value={{ startTour, isOpen }}>
      {children}

      {isOpen && (
        <GuidedTourModal
          steps={steps}
          onFinish={handleFinish}
          onDismiss={handleDismiss}
        />
      )}
    </TourContext.Provider>
  );
}
