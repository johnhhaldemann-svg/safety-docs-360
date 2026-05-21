import { SafePredictNativeWorkspace } from "@/components/safe-predict/SafePredictNativeWorkspace";
import type { SafePredictWorkspaceSlug } from "@/lib/safePredictWorkspaceConfig";

export function SafePredictWorkspaceRoute({ workspace }: { workspace: SafePredictWorkspaceSlug }) {
  return <SafePredictNativeWorkspace workspace={workspace} />;
}
