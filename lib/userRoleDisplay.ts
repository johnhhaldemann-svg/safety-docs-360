export function formatUserRoleLabel(role: string) {
  const normalized = role.trim().toLowerCase().replace(/\s+/g, "_");
  if (normalized === "sales_demo") {
    return "Sales Demo";
  }
  if (normalized === "manager" || normalized === "operations_manager") {
    return "Operations Manager";
  }
  if (normalized === "company_admin") {
    return "Company Admin";
  }
  if (normalized === "company_user") {
    return "Company User";
  }
  if (normalized === "safety_manager") {
    return "Safety Manager";
  }
  if (normalized === "project_manager") {
    return "Project Manager";
  }
  if (normalized === "field_supervisor") {
    return "Field Supervisor";
  }
  if (normalized === "foreman") {
    return "Foreman";
  }
  if (normalized === "field_user") {
    return "Field User";
  }
  if (normalized === "read_only") {
    return "Read Only";
  }
  if (normalized === "platform_admin") {
    return "Platform Admin";
  }
  if (normalized === "super_admin") {
    return "Super Admin";
  }
  return role.replace(/_/g, " ");
}

export function getUserDisplayName(
  profile: { preferredName?: string; fullName?: string } | null,
  email: string
) {
  const candidate = profile?.preferredName || profile?.fullName || email.split("@")[0] || "User";
  return candidate.trim() || "User";
}

export function getAvatarInitialsFromLabel(label: string) {
  const parts = label
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return (parts[0]?.[0] ?? "U") + (parts[1]?.[0] ?? "");
}
