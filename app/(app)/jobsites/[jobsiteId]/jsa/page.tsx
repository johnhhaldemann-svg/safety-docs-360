import { JsaWorkspace } from "@/components/jsa/JsaWorkspace";

export default async function JobsiteJsaPage({
  params,
}: {
  params: Promise<{ jobsiteId: string }>;
}) {
  const { jobsiteId } = await params;
  return <JsaWorkspace jobsiteId={jobsiteId} />;
}
