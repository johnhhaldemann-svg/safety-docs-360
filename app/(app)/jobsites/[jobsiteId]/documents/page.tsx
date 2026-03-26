import { JobsiteSurfaceClient } from "../_components/jobsite-surface-client";

export default async function JobsiteDocumentsPage({
  params,
}: {
  params: Promise<{ jobsiteId: string }>;
}) {
  const { jobsiteId } = await params;
  return (
    <JobsiteSurfaceClient
      jobsiteId={jobsiteId}
      surface="documents"
      title="Jobsite Documents"
      description="Scoped documents payload for this jobsite."
    />
  );
}
