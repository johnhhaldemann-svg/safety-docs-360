// Organizations management, surfaced inside the Command Center dark shell.
// Re-exports the existing admin companies page so super admins stay within the
// /superadmin chrome instead of being dropped into the light /admin/companies page.
export { default } from "@/app/(app)/admin/companies/page";
