# OWASP Self-Review Checklist

| Area | Status | Checklist Item | Evidence |
| --- | --- | --- | --- |
| Broken access control | Partial | Protected routes must use `authorizeRequest`, shared auth wrappers, or documented public exceptions. | [API RBAC audit](../api-rbac-audit.md) |
| Cryptographic failures | Needs Confirmation | Confirm TLS, at-rest encryption, secret storage, and no sensitive data in logs. | Vercel/Supabase dashboard evidence required. |
| Injection | Partial | Prefer Supabase query builders and parameterized APIs over raw SQL in route handlers. | Code review required. |
| Insecure design | Partial | Maintain gap register and remediation tickets for missing controls. | [gap register](gap-register.md) |
| Security misconfiguration | Needs Confirmation | Run Supabase advisors and Vercel environment review before production packet. | Supabase/Vercel evidence required. |
| Vulnerable components | Partial | Run dependency audit and CI. | [package.json](../../package.json), GitHub Actions evidence. |
| Identification/auth failures | Partial | Supabase Auth centralizes session validation. | [lib/rbac.ts](../../lib/rbac.ts) |
| Software/data integrity | Partial | Use GitHub Actions and Vercel deployment provenance. | [.github/workflows](../../.github/workflows) |
| Logging/monitoring failures | Partial | Central ledger added for high-value company events. | [audit summary](audit-logging-summary.md) |
| SSRF | Needs Confirmation | Review outbound integrations and AI/provider calls. | Integration route review required. |

