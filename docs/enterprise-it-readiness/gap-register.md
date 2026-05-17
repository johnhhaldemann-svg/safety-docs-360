# Gap Register

| Gap | Status | Risk | Owner Needed | Next Action |
| --- | --- | --- | --- | --- |
| Hosted Supabase auth/security settings are not attached as evidence. | Needs Confirmation | IT reviewers may ask for session, MFA, password, and email confirmation settings. | Technical owner | Export dashboard screenshots and config notes. |
| Backup, PITR, restore, and DR objectives are not formally evidenced. | Needs Confirmation | Cannot make strong DR claims. | Technical/operations owner | Confirm Supabase backups, Vercel rollback, RPO/RTO, restore test. |
| SSO/SCIM is not production-ready. | Needs Confirmation | Enterprise identity reviewers may require SAML/OIDC and SCIM. | Product/engineering owner | Review [SSO/SCIM requirements](sso-scim-requirements.md). |
| SOC 2, ISO 27001, and pen-test claims are not available. | Needs Confirmation | Cannot answer assurance requests as completed. | Business/security owner | Use binder/checklists and engage qualified reviewers. |
| Audit ledger retention and export format are not formally approved. | Partial | Customers may require retention windows and immutable export controls. | Product/security owner | Define retention, export signing, and tamper-evidence requirements. |
| File control policy is partially documented but not fully normalized across all routes. | Partial | Upload/download TTL and MIME controls differ by route. | Engineering owner | Normalize MIME allowlist, size limits, TTL constants, and route coverage. |
| Privacy/legal docs are generic. | Needs Confirmation | Legal/privacy review required before external answers. | Legal/privacy owner | Review terms, privacy notice, subprocessor list, DPA posture. |

