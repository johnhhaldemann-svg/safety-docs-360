import { AppWorkspaceLayout } from "@/components/app-shell/AppWorkspaceLayout";

export const dynamic = "force-dynamic";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppWorkspaceLayout>{children}</AppWorkspaceLayout>;
}
