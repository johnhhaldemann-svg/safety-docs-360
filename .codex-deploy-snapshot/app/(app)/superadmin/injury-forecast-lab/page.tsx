import { redirect } from "next/navigation";

/** Old path; OSHA IPA Streamlit entry lives at /superadmin/osha-ipa-lab. */
export default function LegacyInjuryForecastLabRedirectPage() {
  redirect("/superadmin/osha-ipa-lab");
}
