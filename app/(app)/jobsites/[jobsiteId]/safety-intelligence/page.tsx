import { SafetyIntelligenceWorkflow } from "@/components/safety-intelligence/SafetyIntelligenceWorkflow";

export default async function JobsiteSafetyIntelligencePage({
  params,
}: {
  params: Promise<{ jobsiteId: string }>;
}) {
  const { jobsiteId } = await params;
  return <SafetyIntelligenceWorkflow jobsiteId={jobsiteId} />;
}
