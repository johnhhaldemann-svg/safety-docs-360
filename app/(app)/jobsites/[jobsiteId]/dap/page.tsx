import { JobsiteSurfaceClient } from "../_components/jobsite-surface-client";

export default async function JobsiteDapPage({
  params,
}: {
  params: Promise<{ jobsiteId: string }>;
}) {
  const { jobsiteId } = await params;
  return (
    <JobsiteSurfaceClient
      jobsiteId={jobsiteId}
      surface="dap"
      title="Jobsite JSA"
      description="Scoped job safety analyses and planned activities for this jobsite."
    />
  );
}
