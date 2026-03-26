import { JobsiteSurfaceClient } from "../_components/jobsite-surface-client";

export default async function JobsiteOverviewPage({
  params,
}: {
  params: Promise<{ jobsiteId: string }>;
}) {
  const { jobsiteId } = await params;
  return (
    <JobsiteSurfaceClient
      jobsiteId={jobsiteId}
      surface="overview"
      title="Jobsite Overview"
      description="Context-aware jobsite summary scoped by jobsiteId."
    />
  );
}
