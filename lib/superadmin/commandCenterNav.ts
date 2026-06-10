import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  Building2,
  ClipboardCheck,
  Crosshair,
  FileCheck2,
  FileText,
  FlaskConical,
  Gauge,
  History,
  LayoutDashboard,
  LibraryBig,
  LockKeyhole,
  Map as MapIcon,
  Rocket,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

/**
 * Navigation model for the Superadmin Command Center dark shell.
 *
 * Every route that exists in the classic superadmin hub (see `superadminNavigation.ts`)
 * is represented here so the redesign does not remove access to any tool. Sections mirror
 * the Command Center mockup grouping (Overview / Operations / Compliance / AI / Content /
 * Platform) while pointing at the real, already-built pages.
 */
export type CommandCenterNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Optional numeric key into the live status payload to render a count badge. */
  badge?: "unseenTickets" | "pendingOwners";
};

export type CommandCenterNavSection = {
  title: string;
  items: CommandCenterNavItem[];
};

export const commandCenterNav: CommandCenterNavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/superadmin", label: "Command Center", icon: LayoutDashboard },
      { href: "/superadmin/health", label: "Health Command Center", icon: Gauge },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/superadmin/onboarding", label: "Onboarding", icon: Rocket },
      { href: "/superadmin/owner-validation", label: "Owner Validation", icon: ClipboardCheck, badge: "pendingOwners" },
      { href: "/superadmin/users", label: "User Management", icon: Users },
      { href: "/superadmin/organizations", label: "Organizations", icon: Building2 },
    ],
  },
  {
    title: "Compliance",
    items: [
      { href: "/superadmin/help-tickets", label: "Escalations", icon: AlertTriangle, badge: "unseenTickets" },
      { href: "/superadmin/what-changed", label: "Audit · What Changed", icon: History },
      { href: "/superadmin/osha-ipa-lab", label: "Compliance Tracker", icon: ShieldCheck },
      { href: "/superadmin/jurisdiction-standards", label: "Jurisdiction Standards", icon: Scale },
      { href: "/superadmin/csep-completeness-review", label: "CSEP Review", icon: FileCheck2 },
    ],
  },
  {
    title: "AI & Predictions",
    items: [
      { href: "/superadmin/ai-engine", label: "AI Engine", icon: BrainCircuit },
      { href: "/superadmin/ai-improvements", label: "AI Improvements", icon: Sparkles },
      { href: "/superadmin/ai-knowledge-map", label: "AI Knowledge Map", icon: MapIcon },
      { href: "/superadmin/prediction-validation", label: "Prediction Validation", icon: Crosshair },
      { href: "/superadmin/injury-weather", label: "Injury Weather", icon: Activity },
    ],
  },
  {
    title: "Content & Builders",
    items: [
      { href: "/superadmin/builder-text", label: "Builder Text", icon: FileText },
      { href: "/superadmin/csep-programs", label: "CSEP Programs", icon: FileCheck2 },
      { href: "/superadmin/document-library", label: "Document Library", icon: LibraryBig },
      { href: "/superadmin/csep-survey-test", label: "Survey Test", icon: FlaskConical },
    ],
  },
  {
    title: "Platform",
    items: [
      { href: "/superadmin/system-health", label: "System Health", icon: Activity },
      { href: "/superadmin/cyber-security", label: "Cyber Security", icon: LockKeyhole },
      { href: "/superadmin/system-test", label: "System Test", icon: FlaskConical },
    ],
  },
];

const allItems = commandCenterNav.flatMap((section) => section.items);

/** Longest-prefix match so nested routes (e.g. /superadmin/health/owners) resolve correctly. */
export function findActiveCommandCenterItem(pathname: string): CommandCenterNavItem | null {
  let best: CommandCenterNavItem | null = null;
  for (const item of allItems) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (!best || item.href.length > best.href.length) {
        best = item;
      }
    }
  }
  return best;
}
