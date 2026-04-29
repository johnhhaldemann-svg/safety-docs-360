import { JobsiteSurfaceClient } from "../_components/jobsite-surface-client";

export default async function JobsiteAnalyticsPage({
  params,
}: {
  params: Promise<{ jobsiteId: string }>;
}) {
  const { jobsiteId } = await params;
  return (
    <JobsiteSurfaceClient
      jobsiteId={jobsiteId}
      surface="analytics"
      title="Jobsite Analytics"
      description="Operational safety metrics, risk signals, and trend indicators for this jobsite."
    />
  );
}
