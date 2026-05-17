# SAML/OIDC + SCIM Requirements

This is a provider-neutral design draft. Do not claim production SSO or SCIM readiness until implemented, tested, and reviewed.

| Requirement | Status | Acceptance Criteria | Design Notes |
| --- | --- | --- | --- |
| OIDC login | Needs Confirmation | Company can configure issuer, client ID, client secret, scopes, redirect URI, and allowed domains. | Store provider config by company; secrets must use encrypted storage or provider vault. |
| SAML 2.0 login | Needs Confirmation | Company can configure entity ID, ACS URL, IdP SSO URL, signing cert, name ID, and attribute mappings. | Support signed assertions; require metadata validation. |
| Domain routing | Needs Confirmation | Email/domain identifies company identity provider without leaking tenant data. | Add verified company domains table. |
| JIT provisioning | Needs Confirmation | First SSO login can create pending or active membership according to company policy. | Must respect `company_memberships` and `user_roles`. |
| SCIM users | Needs Confirmation | Create, update, suspend, reactivate, and delete/deprovision users by company. | Add SCIM token table, audit events, idempotency keys. |
| SCIM groups | Needs Confirmation | Group-to-role/jobsite mapping is configurable and audited. | Map groups to app roles and optional jobsite assignments. |
| Admin UI | Needs Confirmation | Company admins can view provider status, last sync, errors, and mappings. | Extend Security/Audit area or integrations hub. |
| Audit | Needs Confirmation | Every SSO/SCIM login, provision, role change, and deprovision event is logged. | Use `company_security_events`. |

Suggested database additions: `company_identity_providers`, `company_verified_domains`, `company_scim_tokens`, `company_scim_identities`, `company_group_role_mappings`, and `company_identity_audit_errors`.

