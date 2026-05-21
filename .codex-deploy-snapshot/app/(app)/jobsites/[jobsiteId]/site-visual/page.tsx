import { redirect } from "next/navigation";

export default async function JobsiteSiteVisualPage({
  params,
}: {
  params: Promise<{ jobsiteId: string }>;
}) {
  const { jobsiteId } = await params;
  redirect(`/jobsites/${encodeURIComponent(jobsiteId)}/overview`);
}
