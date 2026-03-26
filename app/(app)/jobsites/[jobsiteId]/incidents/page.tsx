import { JobsiteSurfaceClient } from "../_components/jobsite-surface-client";

export default async function JobsiteIncidentsPage({
  params,
}: {
  params: Promise<{ jobsiteId: string }>;
}) {
  const { jobsiteId } = await params;
  return (
    <JobsiteSurfaceClient
      jobsiteId={jobsiteId}
      surface="incidents"
      title="Jobsite Incidents"
      description="Scoped incident and near-miss operations for this jobsite."
    />
  );
}
