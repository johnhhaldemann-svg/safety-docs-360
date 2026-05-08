import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ClipboardList,
  FolderOpen,
  GraduationCap,
  HardHat,
  LayoutDashboard,
  Settings2,
  Shield,
  Users,
} from "lucide-react";
import type { NavSection } from "@/lib/appNavigation";
import type { WorkspaceNavGroup } from "@/lib/workspaceNavGroup";

type SectionWithGroup = NavSection & { group?: WorkspaceNavGroup };

const GROUP_ICONS: Record<WorkspaceNavGroup, LucideIcon> = {
  today: LayoutDashboard,
  audits: ClipboardList,
  documents: FolderOpen,
  fieldSites: HardHat,
  programs: GraduationCap,
  insights: BarChart3,
  account: Users,
};

const TITLE_HINTS: Array<{ test: (t: string) => boolean; Icon: LucideIcon }> = [
  { test: (t) => /superadmin|system|platform/i.test(t), Icon: Shield },
  { test: (t) => /admin|platform/i.test(t), Icon: Shield },
  { test: (t) => /document|library|template/i.test(t), Icon: FolderOpen },
  { test: (t) => /company|user|account|team|billing/i.test(t), Icon: Users },
  { test: (t) => /program|training|induction/i.test(t), Icon: GraduationCap },
  { test: (t) => /insight|report|analytics/i.test(t), Icon: BarChart3 },
  { test: (t) => /audit/i.test(t), Icon: ClipboardList },
  { test: (t) => /review|queue/i.test(t), Icon: ClipboardList },
  { test: (t) => /setup|profile|company/i.test(t), Icon: Settings2 },
];

export function getNavSectionIcon(section: NavSection): LucideIcon {
  const g = (section as SectionWithGroup).group;
  if (g && GROUP_ICONS[g]) {
    return GROUP_ICONS[g];
  }
  const title = section.title.trim();
  for (const { test, Icon } of TITLE_HINTS) {
    if (test(title)) {
      return Icon;
    }
  }
  return FolderOpen;
}
