export type AdoptionChecklistItem = {
  id: "company_profile" | "team_invites" | "first_jobsite" | "first_document" | "command_center";
  label: string;
  note: string;
  href: string;
  complete: boolean;
};

export type AdoptionChecklistSummary = {
  items: AdoptionChecklistItem[];
  completedCount: number;
  totalCount: number;
  nextItem: AdoptionChecklistItem | null;
};

export type AdoptionChecklistInput = {
  companyProfile?: {
    name?: string | null;
    industry?: string | null;
    phone?: string | null;
    address_line_1?: string | null;
    city?: string | null;
    state_region?: string | null;
    country?: string | null;
  } | null;
  companyUsers?: Array<{ status?: string | null }>;
  companyInvites?: Array<{ status?: string | null }>;
  jobsites?: Array<{ status?: string | null }>;
  documents?: Array<{ status?: string | null; final_file_path?: string | null; draft_file_path?: string | null }>;
  commandCenterViewed?: boolean;
};

function filled(value?: string | null) {
  return Boolean((value ?? "").trim());
}

function isActiveStatus(status?: string | null) {
  const value = (status ?? "").trim().toLowerCase();
  return value !== "inactive" && value !== "archived" && value !== "closed";
}

export function buildAdoptionChecklist(input: AdoptionChecklistInput): AdoptionChecklistSummary {
  const profile = input.companyProfile;
  const companyProfileComplete = Boolean(
    profile &&
      filled(profile.name) &&
      filled(profile.industry) &&
      filled(profile.phone) &&
      filled(profile.address_line_1) &&
      filled(profile.city) &&
      filled(profile.state_region) &&
      filled(profile.country)
  );
  const hasTeamInvite =
    (input.companyInvites ?? []).some((invite) => isActiveStatus(invite.status)) ||
    (input.companyUsers ?? []).filter((user) => isActiveStatus(user.status)).length > 1;
  const hasJobsite = (input.jobsites ?? []).some((jobsite) => isActiveStatus(jobsite.status));
  const hasDocument = (input.documents ?? []).some(
    (document) => filled(document.final_file_path) || filled(document.draft_file_path) || filled(document.status)
  );

  const items: AdoptionChecklistItem[] = [
    {
      id: "company_profile",
      label: "Complete company profile",
      note: companyProfileComplete
        ? "Company identity is ready for invites, billing, and workspace records."
        : "Add company identity, contact, and address details so the workspace feels ready for the team.",
      href: "/company-setup",
      complete: companyProfileComplete,
    },
    {
      id: "team_invites",
      label: "Invite team members",
      note: hasTeamInvite
        ? "Team access has started."
        : "Invite a safety lead, manager, or field supervisor so the workspace has more than one operator.",
      href: "/company-users",
      complete: hasTeamInvite,
    },
    {
      id: "first_jobsite",
      label: "Add first jobsite",
      note: hasJobsite
        ? "At least one jobsite is available for field workflows."
        : "Create a jobsite to anchor JSAs, permits, incidents, reports, and risk signals.",
      href: "/jobsites",
      complete: hasJobsite,
    },
    {
      id: "first_document",
      label: "Upload or generate first document",
      note: hasDocument
        ? "The document workflow has started."
        : "Upload a file, submit a package, or generate a safety document to create the first workspace record.",
      href: "/library",
      complete: hasDocument,
    },
    {
      id: "command_center",
      label: "Open Command Center",
      note: input.commandCenterViewed
        ? "The operating hub is now part of the workflow."
        : "Use the Command Center as the daily start point for risk, open work, and recommended actions.",
      href: "/command-center",
      complete: Boolean(input.commandCenterViewed),
    },
  ];

  const completedCount = items.filter((item) => item.complete).length;

  return {
    items,
    completedCount,
    totalCount: items.length,
    nextItem: items.find((item) => !item.complete) ?? null,
  };
}
