import {
  adminSideSections,
  companyAdminSideSections,
  flattenNavItemsFromSections,
  internalAdminAppendedSection,
  superadminOnlySideSections,
  type NavItem,
  type NavSection,
} from "@/lib/appNavigation";
import { mapSafePredictSurfaceHref } from "@/lib/safePredictRouteMap";

export type SafePredictPlatformAction = NavItem & {
  sectionTitle: string;
  source: "company" | "admin" | "superadmin" | "platform";
};

export type SafePredictPlatformActionSection = {
  title: string;
  description: string;
  source: SafePredictPlatformAction["source"];
  items: SafePredictPlatformAction[];
};

function actionSource(section: NavSection): SafePredictPlatformAction["source"] {
  if (section.items.some((item) => item.href.startsWith("/superadmin"))) return "superadmin";
  if (section.title === "Platform") return "platform";
  if (section.audience === "admin" || section.group === "review") return "admin";
  return "company";
}

function normalizeAction(section: NavSection, item: NavItem): SafePredictPlatformAction {
  const nativeHref = mapSafePredictSurfaceHref(item.href);
  const keywords =
    item.href === "/permits"
      ? [...(item.keywords ?? []), "permits", "create permit", "permit center"]
      : item.keywords;
  return {
    ...item,
    href: nativeHref,
    keywords,
    sectionTitle: section.title,
    source: actionSource(section),
    description:
      nativeHref !== item.href
        ? item.description ?? `Open ${item.label} in the SafetyDoc360 operating platform.`
        : item.description,
  };
}

function sectionToPlatformSection(section: NavSection): SafePredictPlatformActionSection {
  const source = actionSource(section);
  return {
    title: section.title,
    description:
      section.description ??
      (source === "company"
        ? "Core company workspace tools available through SafetyDoc360."
        : "Protected platform tools available from the connected system."),
    source,
    items: section.items
      .filter((item) => item.href !== "/safe-predict")
      .map((item) => normalizeAction(section, item)),
  };
}

export const safePredictPlatformActionSections: SafePredictPlatformActionSection[] = [
  ...companyAdminSideSections.map(sectionToPlatformSection),
  sectionToPlatformSection(internalAdminAppendedSection),
  ...adminSideSections.map(sectionToPlatformSection),
  ...superadminOnlySideSections.map(sectionToPlatformSection),
].filter((section) => section.items.length > 0);

export const safePredictPlatformActions: SafePredictPlatformAction[] =
  flattenNavItemsFromSections(safePredictPlatformActionSections).map((item) => {
    const action = safePredictPlatformActionSections
      .flatMap((section) => section.items)
      .find((candidate) => candidate.href === item.href);
    return action ?? { ...item, sectionTitle: "Platform", source: "company" };
  });

export function filterSafePredictPlatformActions(
  actions: SafePredictPlatformAction[],
  query: string
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return actions;

  return actions.filter((action) => {
    const searchableText = [
      action.label,
      action.href,
      action.short,
      action.description,
      action.primaryActionLabel,
      action.sectionTitle,
      ...(action.keywords ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return searchableText.includes(normalizedQuery);
  });
}
