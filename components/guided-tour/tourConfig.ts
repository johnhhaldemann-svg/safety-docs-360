/**
 * tourConfig.ts
 *
 * Defines the guided tour steps for two audiences:
 *   • "admin"  – company_admin, safety_manager, manager (sets up the account)
 *   • "user"   – field_user, foreman, employee, contractor (uses the platform day-to-day)
 *
 * Each step has a rich description + a direct link to the feature.
 */

export type TourAudience = "admin" | "user";

export type TourStep = {
  id: string;
  /** Lucide icon name (string) – imported dynamically in the modal */
  icon: string;
  /** Accent color class (Tailwind) */
  color: string;
  title: string;
  subtitle: string;
  body: string;
  /** Route the "Explore" CTA button links to */
  href: string;
  ctaLabel: string;
};

// ---------------------------------------------------------------------------
// ADMIN TOUR  (company_admin / safety_manager)
// ---------------------------------------------------------------------------
export const ADMIN_TOUR_STEPS: TourStep[] = [
  {
    id: "welcome_admin",
    icon: "ShieldCheck",
    color: "blue",
    title: "Welcome to SafePredict",
    subtitle: "Your AI-powered construction safety platform",
    body: "SafePredict gives you a single command center for your entire safety operation — real-time risk scoring, document management, field workflows, training tracking, and Gus, your AI safety coach. This quick tour covers the key areas so you can get your team up and running fast.",
    href: "/safe-predict",
    ctaLabel: "View Dashboard",
  },
  {
    id: "company_setup",
    icon: "Building2",
    color: "indigo",
    title: "Company & Jobsite Setup",
    subtitle: "The foundation of your safety workspace",
    body: "Start by completing your Company Profile and adding your active Jobsites. Every permit, JSA, incident, and training record is tied to a jobsite — so the more detail you add here, the more powerful the platform becomes. Add your safety contacts, trade type, and OSHA classification while you're here.",
    href: "/safe-predict/company-profile",
    ctaLabel: "Set Up Company Profile",
  },
  {
    id: "team_access",
    icon: "Users",
    color: "violet",
    title: "Team Access & User Roles",
    subtitle: "Invite your team and assign the right permissions",
    body: "Head to Team Access to invite safety managers, foremen, and field workers. SafePredict uses role-based access — company admins see everything, field users only see what's relevant to them. Invites go out by email and team members can activate their account in minutes.",
    href: "/safe-predict/team-access",
    ctaLabel: "Manage Team Access",
  },
  {
    id: "training",
    icon: "GraduationCap",
    color: "emerald",
    title: "Training Matrix & Certifications",
    subtitle: "Upload records and track expirations automatically",
    body: "The Training module is your compliance backbone. Upload certification PDFs (OSHA-10, OSHA-30, First Aid, equipment certs) for every employee and the platform tracks expiry dates for you. Managers get alerts before certs lapse — no more scrambling at audit time.",
    href: "/safe-predict/training",
    ctaLabel: "Open Training Tracker",
  },
  {
    id: "jsa",
    icon: "ClipboardCheck",
    color: "amber",
    title: "Job Safety Analysis (JSA)",
    subtitle: "Pre-task hazard identification before every job",
    body: "JSAs must be completed before high-risk work begins. SafePredict makes them fast — select the task type, pick hazards from the library, assign controls, and get a supervisor sign-off. Every JSA is date-stamped, linked to the worker and jobsite, and stored permanently for audits.",
    href: "/safe-predict/jsa",
    ctaLabel: "Go to JSA",
  },
  {
    id: "permits",
    icon: "FileText",
    color: "orange",
    title: "Permit Center",
    subtitle: "Hot work, confined space, excavation and more",
    body: "Manage all work permits from the Permit Center. Field workers submit requests, supervisors review and approve or deny digitally. Permit templates are pre-built for the most common construction permit types. Every approved permit is archived and searchable — no more paper folders.",
    href: "/safe-predict/permits",
    ctaLabel: "Open Permit Center",
  },
  {
    id: "incidents",
    icon: "AlertTriangle",
    color: "red",
    title: "Incident Reporting",
    subtitle: "Fast capture, OSHA-ready logging, corrective actions",
    body: "When something happens, speed matters. SafePredict's incident form guides the reporter through the right fields — type, severity, body part, root cause. Reports route automatically to managers for review. The platform pre-populates your OSHA 300 log and flags corrective actions that need follow-up.",
    href: "/safe-predict/incidents",
    ctaLabel: "View Incidents",
  },
  {
    id: "gus_ai",
    icon: "Sparkles",
    color: "cyan",
    title: "Gus — Your AI Safety Coach",
    subtitle: "Predictive risk, pattern recognition, and coaching",
    body: "Gus is SafePredict's built-in AI engine. He analyzes your historical incident data, near-misses, inspections, and weather conditions to surface your top risk factors before they become incidents. Gus also coaches supervisors with recommended toolbox talks and corrective actions. The more data you enter, the smarter Gus gets.",
    href: "/safe-predict/gus-coaching",
    ctaLabel: "Meet Gus",
  },
  {
    id: "finish_admin",
    icon: "Rocket",
    color: "green",
    title: "You're Ready to Go",
    subtitle: "Setup checklist and ongoing support",
    body: "Your setup is underway. Visit Get Started anytime to see your account setup checklist and track progress. If you ever need help, our Help Center is available from the sidebar — or reach out to your SafePredict account contact directly. Welcome to the platform.",
    href: "/safe-predict/get-started",
    ctaLabel: "View Setup Checklist",
  },
];

// ---------------------------------------------------------------------------
// USER TOUR  (field_user / foreman / employee / contractor)
// ---------------------------------------------------------------------------
export const USER_TOUR_STEPS: TourStep[] = [
  {
    id: "welcome_user",
    icon: "HardHat",
    color: "blue",
    title: "Welcome to SafePredict",
    subtitle: "Your safety companion on the jobsite",
    body: "SafePredict keeps your safety records, permits, and training in one place. This short tour will show you the key things you'll use every day so you can hit the ground running.",
    href: "/safe-predict",
    ctaLabel: "View My Dashboard",
  },
  {
    id: "jsa_user",
    icon: "ClipboardCheck",
    color: "amber",
    title: "Job Safety Analysis (JSA)",
    subtitle: "Complete before starting any high-risk task",
    body: "Before starting work on any task with identified hazards, you'll need to complete a JSA. Select your task, identify the hazards, and describe the controls you'll use. Your supervisor will review and sign off digitally. It only takes a few minutes and keeps everyone protected.",
    href: "/safe-predict/jsa",
    ctaLabel: "Start a JSA",
  },
  {
    id: "permits_user",
    icon: "FileText",
    color: "orange",
    title: "Work Permits",
    subtitle: "Request approval before permitted work begins",
    body: "Certain tasks — hot work, confined space entry, working at height — require a permit. Use the Permit Center to submit your request, describe the work, and wait for supervisor approval. Never start permitted work without a signed permit in hand.",
    href: "/safe-predict/permits",
    ctaLabel: "Request a Permit",
  },
  {
    id: "incidents_user",
    icon: "AlertTriangle",
    color: "red",
    title: "Reporting an Incident",
    subtitle: "Log injuries, near-misses, and property damage",
    body: "If something happens — an injury, a near-miss, equipment damage — report it immediately. Find Incidents in the menu, click New Report, and fill in what happened, where, and who was involved. Your report goes directly to your safety manager. Prompt reporting is required and protects everyone.",
    href: "/safe-predict/incidents",
    ctaLabel: "Go to Incidents",
  },
  {
    id: "training_user",
    icon: "GraduationCap",
    color: "emerald",
    title: "Your Training & Certifications",
    subtitle: "View required training and your cert status",
    body: "The Training section shows your current certifications, expiry dates, and any training that's been assigned to you. Make sure your certifications are up to date — expired certs can affect your ability to perform certain tasks on site.",
    href: "/safe-predict/training",
    ctaLabel: "View My Training",
  },
  {
    id: "gus_user",
    icon: "Sparkles",
    color: "cyan",
    title: "Gus AI — Safety Insights",
    subtitle: "Your AI-powered safety assistant",
    body: "Gus is SafePredict's AI safety engine. He surfaces risk patterns on your jobsite and helps safety managers assign toolbox talks based on what's actually happening in the field. When you complete JSAs and report observations, you're feeding Gus the data he needs to keep your site safer.",
    href: "/safe-predict/gus-coaching",
    ctaLabel: "See Gus Insights",
  },
  {
    id: "finish_user",
    icon: "CheckCircle2",
    color: "green",
    title: "You're All Set",
    subtitle: "Stay safe — the platform has your back",
    body: "That's the quick tour. Remember: JSA before work, permit before permitted tasks, and report incidents immediately. If you have questions, visit Help & Support from the sidebar or ask your safety manager. Stay safe out there.",
    href: "/safe-predict",
    ctaLabel: "Go to Dashboard",
  },
];

export const ADMIN_ROLES = new Set([
  "super_admin",
  "admin",
  "company_admin",
  "safety_manager",
  "manager",
]);

export function getTourSteps(role: string | null | undefined): TourStep[] {
  if (!role) return USER_TOUR_STEPS;
  return ADMIN_ROLES.has(role.toLowerCase()) ? ADMIN_TOUR_STEPS : USER_TOUR_STEPS;
}

export function getTourAudience(role: string | null | undefined): TourAudience {
  if (!role) return "user";
  return ADMIN_ROLES.has(role.toLowerCase()) ? "admin" : "user";
}
