import { JobsiteSurfaceClient } from "../_components/jobsite-surface-client";

export default async function JobsiteReportsPage({
  params,
}: {
  params: Promise<{ jobsiteId: string }>;
}) {
  const { jobsiteId } = await params;
  return (
    <JobsiteSurfaceClient
      jobsiteId={jobsiteId}
      surface="reports"
      title="Jobsite Reports"
      description="Scoped reports and summaries for this jobsite."
    />
  );
}
