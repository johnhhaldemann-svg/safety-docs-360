import { Suspense } from "react";
import JsaPage from "@/app/(app)/jsa/page";

export default function SafePredictJsaPage() {
  return (
    <div className="app-shell-light min-h-[calc(100vh-5rem)] px-4 py-6 sm:px-7">
      <Suspense fallback={<div className="flex items-center justify-center py-24 text-slate-400 text-sm">Loading JSA builder…</div>}>
        <JsaPage />
      </Suspense>
    </div>
  );
}
