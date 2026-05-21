import { JobsiteSurfaceClient } from "../_components/jobsite-surface-client";

export default async function JobsiteTeamPage({
  params,
}: {
  params: Promise<{ jobsiteId: string }>;
}) {
  const { jobsiteId } = await params;
  return (
    <JobsiteSurfaceClient
      jobsiteId={jobsiteId}
      surface="team"
      title="Jobsite Team"
      description="Company users, managers, and safety roles visible for this jobsite."
    />
  );
}
