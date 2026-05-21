/** Active nav item: exact path or nested under `href`. */
export function isWorkspaceNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export {
  getJobsiteWorkspacePhaseId,
  JOBSITE_NAV_PHASES,
  jobsitePhaseChildLinks,
  parseJobsiteIdFromPath,
} from "@/lib/jobsiteWorkspaceNav";
