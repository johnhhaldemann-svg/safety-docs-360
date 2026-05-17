# Validation Lane

| Step | Status | Evidence Target |
| --- | --- | --- |
| Pull request / branch review | Partial | GitHub diff, tests, reviewer comments. |
| GitHub Actions | Partial | Successful CI run from [.github/workflows](../../.github/workflows). |
| Supabase staging migration | Needs Confirmation | Migration applied to staging, RLS checked, advisors run. |
| Vercel Preview | Needs Confirmation | Preview URL, deployment logs, environment-variable review. |
| Browser verification | Needs Confirmation | Company admin Security/Audit screenshots, API smoke evidence, console check. |
| Human review | Needs Confirmation | Legal, privacy, security, and product sign-off before customer sharing. |

Minimum release evidence for this roadmap: focused route/helper tests, lint/type checks, staging migration proof, preview screenshot of `/company-users` Security/Audit, and updated [API RBAC audit](../api-rbac-audit.md).

