import { redirect } from "next/navigation";

// permit-center is not in the SafePredict nav — redirect to the canonical permits page.
export default function SafePredictPermitCenterPage() {
  redirect("/safe-predict/permits");
}
