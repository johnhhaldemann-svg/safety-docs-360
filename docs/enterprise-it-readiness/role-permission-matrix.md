# Role / Permission Matrix

| Role | Status | Key Permission Evidence | Notes |
| --- | --- | --- | --- |
| `platform_admin` | Verified | Full `APP_PERMISSIONS` in [lib/rbac.ts](../../lib/rbac.ts) | Internal only. |
| `super_admin` | Verified | Full `APP_PERMISSIONS` in [lib/rbac.ts](../../lib/rbac.ts) | Internal only. |
| `admin` | Verified | Internal admin, analytics, user, template permissions in [lib/rbac.ts](../../lib/rbac.ts) | Internal/platform role. |
| `company_admin` | Verified | Company users, billing, analytics, assignments, docs in [lib/rbac.ts](../../lib/rbac.ts) | Primary customer admin role. |
| `manager` | Verified | Analytics, safety operations, dashboards, reports in [lib/rbac.ts](../../lib/rbac.ts) | Allowed to view security/audit evidence by [companyPermissions](../../lib/companyPermissions.ts). |
| `safety_manager` | Verified | Analytics, safety operations, dashboards, reports in [lib/rbac.ts](../../lib/rbac.ts) | Allowed to view security/audit evidence by [companyPermissions](../../lib/companyPermissions.ts). |
| `project_manager`, `field_supervisor`, `foreman`, `field_user` | Verified | Field/document permissions in [lib/rbac.ts](../../lib/rbac.ts) | Jobsite assignment controls apply in [company users page](../../app/%28app%29/company-users/page.tsx). |
| `read_only` | Verified | Read/report/library permissions in [lib/rbac.ts](../../lib/rbac.ts) | Denied security event API by [events route](../../app/api/company/security/events/route.ts). |

Security/Audit API access: `company_admin`, `manager`, `safety_manager`, platform admins, and users with company-user management or all-company-data permissions. Evidence: [events API](../../app/api/company/security/events/route.ts), [data requests API](../../app/api/company/data-requests/route.ts).
