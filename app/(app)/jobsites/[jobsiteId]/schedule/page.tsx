import { JobsiteScheduleClient } from "./schedule-client";

export default async function JobsiteSchedulePage({
  params,
}: {
  params: Promise<{ jobsiteId: string }>;
}) {
  const { jobsiteId } = await params;
  return <JobsiteScheduleClient jobsiteId={jobsiteId} />;
}
