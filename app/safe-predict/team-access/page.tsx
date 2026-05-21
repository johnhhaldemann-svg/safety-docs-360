import { Suspense } from "react";
import CompanyUsersPage from "@/app/(app)/company-users/page";

export default function SafePredictTeamAccessPage() {
  return (
    <div className="min-h-[calc(100vh-5rem)] px-4 py-6 sm:px-7">
      <Suspense fallback={null}>
        <CompanyUsersPage />
      </Suspense>
    </div>
  );
}
