import { JobsiteSurfaceClient } from "../_components/jobsite-surface-client";

export default async function JobsitePermitsPage({
  params,
}: {
  params: Promise<{ jobsiteId: string }>;
}) {
  const { jobsiteId } = await params;
  return (
    <JobsiteSurfaceClient
      jobsiteId={jobsiteId}
      surface="permits"
      title="Jobsite Permits"
      description="Scoped permit operations for this jobsite."
    />
  );
}
