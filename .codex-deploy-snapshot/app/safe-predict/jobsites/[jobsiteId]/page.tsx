import { SafePredictJobsiteDetail } from "@/components/safe-predict/SafePredictJobsites";

export default async function SafePredictJobsiteDetailPage({
  params,
}: {
  params: Promise<{ jobsiteId: string }>;
}) {
  const { jobsiteId } = await params;
  return <SafePredictJobsiteDetail jobsiteId={decodeURIComponent(jobsiteId)} />;
}
