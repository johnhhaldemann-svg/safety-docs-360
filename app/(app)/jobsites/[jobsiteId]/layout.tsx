import { JobsiteTopTabs } from "./_components/jobsite-top-tabs";

export default async function JobsiteScopedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ jobsiteId: string }>;
}) {
  const { jobsiteId } = await params;

  return (
    <div className="space-y-4">
      <JobsiteTopTabs jobsiteId={jobsiteId} />
      {children}
    </div>
  );
}
