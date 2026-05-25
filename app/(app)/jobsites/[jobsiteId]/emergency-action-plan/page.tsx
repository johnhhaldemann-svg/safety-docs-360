import { JobsiteEmergencyActionPlanClient } from "../_components/jobsite-emergency-action-plan-client";

export default async function JobsiteEmergencyActionPlanPage({
  params,
}: {
  params: Promise<{ jobsiteId: string }>;
}) {
  const { jobsiteId } = await params;
  return <JobsiteEmergencyActionPlanClient jobsiteId={jobsiteId} />;
}
