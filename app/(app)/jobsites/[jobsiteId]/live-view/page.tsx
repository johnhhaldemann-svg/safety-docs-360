import { JobsiteLiveViewClient } from "./live-view-client";

export default async function JobsiteLiveViewPage({
  params,
}: {
  params: Promise<{ jobsiteId: string }>;
}) {
  const { jobsiteId } = await params;
  return <JobsiteLiveViewClient jobsiteId={jobsiteId} />;
}
