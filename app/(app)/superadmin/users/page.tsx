// User management, surfaced inside the Command Center dark shell.
// Re-exports the existing admin users page so super admins stay within the
// /superadmin chrome instead of being dropped into the light /admin/users page.
export { default } from "@/app/(app)/admin/users/page";
