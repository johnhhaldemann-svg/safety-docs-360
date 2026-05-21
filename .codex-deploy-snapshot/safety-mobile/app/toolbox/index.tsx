import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getMe, listToolboxSessions } from "@/api/mobile";
import { EmptyState, ErrorState, LoadingState, SelectionDropdown, StatusBanner } from "@/components/Enterprise";
import { RegisterAction, RegisterRow } from "@/components/ListPrimitives";
import { Screen } from "@/components/Screen";

type ToolboxSession = {
  id: string;
  status?: string | null;
  notes?: string | null;
  conducted_at?: string | null;
  created_at?: string | null;
};

export default function ToolboxScreen() {
  const { data } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const [selectedJobsiteId, setSelectedJobsiteId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const selectedJobsite = data?.jobsites.find((jobsite) => jobsite.id === selectedJobsiteId) ?? data?.jobsites[0] ?? null;
  const { data: sessions = [], isLoading, error, refetch } = useQuery<ToolboxSession[]>({
    queryKey: ["toolbox-sessions", selectedJobsite?.id],
    queryFn: () => listToolboxSessions(selectedJobsite?.id ?? ""),
    enabled: Boolean(selectedJobsite?.id),
  });

  return (
    <Screen title="Toolbox Talks" subtitle="Jobsite toolbox sessions and signoff notes.">
      <RegisterAction href="/toolbox/new" label="New Toolbox Talk" />
      <StatusBanner title="Online Session Log" detail="Toolbox sessions sync directly to the platform while online." tone="info" />
      <SelectionDropdown
        label="Jobsite"
        value={selectedJobsite?.name ?? "No assigned jobsite"}
        open={pickerOpen}
        options={(data?.jobsites ?? []).map((jobsite) => ({ id: jobsite.id, label: jobsite.name, meta: jobsite.status ?? undefined }))}
        onToggle={() => setPickerOpen((open) => !open)}
        onSelect={(id) => {
          setSelectedJobsiteId(id);
          setPickerOpen(false);
        }}
      />
      {isLoading ? <LoadingState title="Loading toolbox sessions..." /> : null}
      {error ? <ErrorState title="Toolbox Not Loaded" detail={error instanceof Error ? error.message : "Try again."} onRetry={() => void refetch()} /> : null}
      {!isLoading && !error && sessions.length === 0 ? <EmptyState title="No Sessions" detail="New toolbox sessions will appear here." /> : null}
      {sessions.map((session) => (
        <RegisterRow
          key={session.id}
          title={session.notes || "Toolbox session"}
          meta={session.conducted_at ? new Date(session.conducted_at).toLocaleString() : "No conducted time recorded"}
          badge={session.status ?? "draft"}
          detail={session.created_at ? `Created ${new Date(session.created_at).toLocaleString()}` : undefined}
        />
      ))}
    </Screen>
  );
}
