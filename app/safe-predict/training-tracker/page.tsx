import { Suspense } from "react";
import TrainingMatrixPage from "@/app/(app)/training-matrix/page";

export default function SafePredictTrainingTrackerPage() {
  return (
    <div className="min-h-[calc(100vh-5rem)] px-4 py-6 sm:px-7">
      <Suspense fallback={null}>
        <TrainingMatrixPage />
      </Suspense>
    </div>
  );
}
