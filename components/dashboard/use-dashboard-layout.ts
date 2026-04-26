"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardAvailableBlock, DashboardBlockId } from "@/components/dashboard/types";
import {
  areDashboardLayoutsEqual,
  getAvailableDashboardBlocks,
  getDashboardRoleDefaultLayout,
  normalizeDashboardLayout,
  validateDashboardLayout,
} from "@/lib/dashboardLayout";
import type { DashboardRole } from "@/lib/dashboardRole";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const supabase = getSupabaseBrowserClient();

type DashboardLayoutResponse = {
  savedLayout: DashboardBlockId[] | null;
  defaultLayout: DashboardBlockId[];
  effectiveLayout: DashboardBlockId[];
  availableBlocks: DashboardAvailableBlock[];
  error?: string;
};

type StatusMessage = {
  tone: "success" | "warning" | "error";
  text: string;
} | null;

function getLocalLayoutFallback(role: DashboardRole) {
  const availableBlocks = getAvailableDashboardBlocks({ role });
  const availableBlockIds = availableBlocks.map((block) => block.id);
  const defaultLayout = normalizeDashboardLayout({
    layout: getDashboardRoleDefaultLayout(role),
    defaultLayout: getDashboardRoleDefaultLayout(role),
    availableBlockIds,
  });

  return {
    availableBlocks,
    defaultLayout,
    effectiveLayout: defaultLayout,
  };
}

async function getAccessToken() {
  const session = await supabase.auth.getSession();
  return session.data.session?.access_token ?? null;
}

export function useDashboardLayout({ role }: { role: DashboardRole }) {
  const fallback = getLocalLayoutFallback(role);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savedLayout, setSavedLayout] = useState<DashboardBlockId[] | null>(null);
  const [defaultLayout, setDefaultLayout] = useState<DashboardBlockId[]>(fallback.defaultLayout);
  const [effectiveLayout, setEffectiveLayout] = useState<DashboardBlockId[]>(fallback.effectiveLayout);
  const [draftLayout, setDraftLayout] = useState<DashboardBlockId[]>(fallback.effectiveLayout);
  const [availableBlocks, setAvailableBlocks] = useState<DashboardAvailableBlock[]>(
    fallback.availableBlocks
  );
  const [message, setMessage] = useState<StatusMessage>(null);

  const applyPayload = useCallback((payload: DashboardLayoutResponse) => {
    setSavedLayout(payload.savedLayout);
    setDefaultLayout(payload.defaultLayout);
    setEffectiveLayout(payload.effectiveLayout);
    setDraftLayout(payload.effectiveLayout);
    setAvailableBlocks(payload.availableBlocks);
  }, []);

  const refresh = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setLoading(false);
      setEditing(false);
      setSavedLayout(null);
      return;
    }

    try {
      const response = await fetchWithTimeout(
        "/api/dashboard/layout",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
        15000
      );
      const payload = (await response.json().catch(() => null)) as DashboardLayoutResponse | null;

      if (!response.ok || !payload) {
        setMessage({
          tone: "error",
          text: payload?.error || "Dashboard layout could not be loaded.",
        });
        setLoading(false);
        return;
      }

      applyPayload(payload);
      setLoading(false);
    } catch {
      setMessage({
        tone: "error",
        text: "Dashboard layout could not be loaded.",
      });
      setLoading(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    const nextFallback = getLocalLayoutFallback(role);
    queueMicrotask(() => {
      setLoading(true);
      setEditing(false);
      setSavedLayout(null);
      setDefaultLayout(nextFallback.defaultLayout);
      setEffectiveLayout(nextFallback.effectiveLayout);
      setDraftLayout(nextFallback.effectiveLayout);
      setAvailableBlocks(nextFallback.availableBlocks);
      setMessage(null);
      void refresh();
    });
  }, [refresh, role]);

  const updateSlot = useCallback((slotIndex: number, blockId: DashboardBlockId) => {
    setDraftLayout((current) => {
      const next = [...current];
      next[slotIndex] = blockId;
      return new Set(next).size === next.length ? next : current;
    });
  }, []);

  const startEditing = useCallback(() => {
    setDraftLayout(effectiveLayout);
    setEditing(true);
    setMessage(null);
  }, [effectiveLayout]);

  const cancelEditing = useCallback(() => {
    setDraftLayout(effectiveLayout);
    setEditing(false);
    setMessage(null);
  }, [effectiveLayout]);

  const save = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setMessage({
        tone: "error",
        text: "You need to be signed in to save the dashboard layout.",
      });
      return;
    }

    const availableBlockIds = availableBlocks.map((block) => block.id);
    const validated = validateDashboardLayout({
      layout: draftLayout,
      availableBlockIds,
    });
    if (!validated.ok) {
      setMessage({
        tone: "warning",
        text: validated.error,
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetchWithTimeout(
        "/api/dashboard/layout",
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ layout: validated.layout }),
        },
        15000
      );
      const payload = (await response.json().catch(() => null)) as DashboardLayoutResponse | null;

      if (!response.ok || !payload) {
        setMessage({
          tone: "error",
          text: payload?.error || "Dashboard layout could not be saved.",
        });
        return;
      }

      applyPayload(payload);
      setEditing(false);
      setMessage({
        tone: "success",
        text: "Dashboard layout saved.",
      });
    } catch {
      setMessage({
        tone: "error",
        text: "Dashboard layout could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  }, [applyPayload, availableBlocks, draftLayout]);

  const reset = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setMessage({
        tone: "error",
        text: "You need to be signed in to reset the dashboard layout.",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetchWithTimeout(
        "/api/dashboard/layout",
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        15000
      );
      const payload = (await response.json().catch(() => null)) as DashboardLayoutResponse | null;

      if (!response.ok || !payload) {
        setMessage({
          tone: "error",
          text: payload?.error || "Dashboard layout could not be reset.",
        });
        return;
      }

      applyPayload(payload);
      setEditing(false);
      setMessage({
        tone: "success",
        text: "Dashboard layout reset to the role default.",
      });
    } catch {
      setMessage({
        tone: "error",
        text: "Dashboard layout could not be reset.",
      });
    } finally {
      setSaving(false);
    }
  }, [applyPayload]);

  const hasUnsavedChanges =
    editing && !areDashboardLayoutsEqual(draftLayout, effectiveLayout);

  return {
    loading,
    saving,
    editing,
    savedLayout,
    defaultLayout,
    effectiveLayout,
    draftLayout,
    availableBlocks,
    message,
    hasUnsavedChanges,
    startEditing,
    cancelEditing,
    updateSlot,
    save,
    reset,
    refresh,
  };
}
