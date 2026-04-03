import { redirect } from "next/navigation";

/** Legacy URL; JSA builder lives at `/jsa`. */
export default function LegacyDapsPage() {
  redirect("/jsa");
}
