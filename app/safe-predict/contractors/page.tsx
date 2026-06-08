import { Suspense } from "react";
import CompanyContractorsPage from "@/app/(app)/company-contractors/page";

// app-shell-light: CSS class in globals.css that overrides dark zinc/white text
// classes (text-white, text-zinc-300, etc.) to readable dark equivalents.
// Without it, those colours are invisible on the SafePredict light background.
export default function SafePredictContractorsPage() {
  return (
    <div className="app-shell-light min-h-[calc(100vh-5rem)] px-4 py-6 sm:px-7">
      <Suspense fallback={<div className="flex items-center justify-center py-24 text-slate-400 text-sm">Loading contractors…</div>}>
        <CompanyContractorsPage />
      </Suspense>
    </div>
  );
}
