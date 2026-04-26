import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ClipboardList,
  FolderOpen,
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
  fieldSites: HardHat,
  programs: ClipboardList,
  insights: BarChart3,
  account: Users,
};

const TITLE_HINTS: Array<{ test: (t: string) => boolean; Icon: LucideIcon }> = [
  { test: (t) => /admin|platform/i.test(t), Icon: Shield },
  { test: (t) => /account|team|billing|report/i.test(t), Icon: Users },
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
