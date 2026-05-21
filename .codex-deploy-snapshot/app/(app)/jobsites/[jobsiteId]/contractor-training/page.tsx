import { ContractorTrainingClient } from "./contractor-training-client";

export default async function JobsiteContractorTrainingPage({
  params,
}: {
  params: Promise<{ jobsiteId: string }>;
}) {
  const { jobsiteId } = await params;
  return <ContractorTrainingClient jobsiteId={jobsiteId} />;
}

