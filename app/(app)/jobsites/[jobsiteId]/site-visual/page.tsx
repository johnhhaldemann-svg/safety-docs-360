import { JobsiteSiteVisualClient } from "./site-visual-client";

export default async function JobsiteSiteVisualPage({
  params,
}: {
  params: Promise<{ jobsiteId: string }>;
}) {
  const { jobsiteId } = await params;
  return <JobsiteSiteVisualClient jobsiteId={jobsiteId} />;
}
