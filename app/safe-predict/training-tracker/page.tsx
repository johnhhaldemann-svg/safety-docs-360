import { Suspense } from "react";
import TrainingMatrixPage from "@/app/(app)/training-matrix/page";

export default function SafePredictTrainingTrackerPage() {
  return (
    <div className="min-h-[calc(100vh-5rem)] px-4 py-6 sm:px-7">
      <Suspense fallback={<div className="flex items-center justify-center py-24 text-slate-400 text-sm">Loading training tracker…</div>}>
        <TrainingMatrixPage />
      </Suspense>
    </div>
  );
}
