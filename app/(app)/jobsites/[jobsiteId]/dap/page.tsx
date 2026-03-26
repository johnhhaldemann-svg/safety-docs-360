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
      title="Jobsite DAP"
      description="Scoped daily action plans for this jobsite."
    />
  );
}
