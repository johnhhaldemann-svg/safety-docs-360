import { Suspense } from "react";

import PermitsPage from "@/app/(app)/permits/page";

export default function SafePredictPermitCenterPage() {
  return (
    <div className="min-h-[calc(100vh-5rem)] px-4 py-6 sm:px-7">
      <Suspense fallback={<div className="text-sm text-[var(--app-muted)]">Loading permit center...</div>}>
        <PermitsPage />
      </Suspense>
    </div>
  );
}
