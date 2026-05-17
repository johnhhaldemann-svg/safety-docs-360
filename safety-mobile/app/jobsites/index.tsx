import { useQuery } from "@tanstack/react-query";
import { getMe } from "@/api/mobile";
import { EmptyState, ErrorState, LoadingState } from "@/components/Enterprise";
import { RegisterRow } from "@/components/ListPrimitives";
import { Screen } from "@/components/Screen";

export default function JobsitesScreen() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const jobsites = data?.jobsites ?? [];

  return (
    <Screen title="Jobsites" subtitle="Assigned jobsites available to this field account.">
      {isLoading ? <LoadingState title="Loading jobsites..." /> : null}
      {error ? <ErrorState title="Jobsites Not Loaded" detail={error instanceof Error ? error.message : "Try again."} onRetry={() => void refetch()} /> : null}
      {!isLoading && !error && jobsites.length === 0 ? <EmptyState title="No Jobsites Assigned" detail="Ask a company admin to assign this user to a jobsite." /> : null}
      {jobsites.map((jobsite) => (
        <RegisterRow
          key={jobsite.id}
          title={jobsite.name}
          meta={jobsite.customer_company_name || "Company jobsite"}
          badge={jobsite.status ?? "active"}
        />
      ))}
    </Screen>
  );
}
