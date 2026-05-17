# File Evidence Controls

| Control | Status | Current Evidence | Gap |
| --- | --- | --- | --- |
| Company storage path convention | Verified | Paths use `companies/{companyId}/...` in [report export](../../app/api/company/reports/export/route.ts), [report attachment upload](../../app/api/company/reports/[id]/attachments/upload-url/route.ts), [corrective action upload](../../app/api/company/corrective-actions/[id]/upload-url/route.ts), and [field audit upload](../../app/api/company/field-audits/observations/[id]/upload-url/route.ts). | Document every storage-producing route in one table. |
| Report export signed URL TTL | Verified | [report export route](../../app/api/company/reports/export/route.ts) uses 120 seconds. | Confirm customer-facing expectation. |
| Library final access signed URL TTL | Verified | [library access route](../../app/api/library/access/[id]/route.ts) uses 60 seconds. | Normalize TTL policy if needed. |
| Upload signed URL TTL | Partial | Supabase `createSignedUploadUrl` is used in upload routes. | Document provider TTL and any client upload timeout behavior. |
| MIME type handling | Partial | Upload routes accept `mimeType` for client metadata. | Add central MIME allowlist and enforce server-side. |
| Size limits | Needs Confirmation | No central size policy found in the reviewed routes. | Define file size limits by evidence type and enforce. |
| Download/export audit | Partial | [downloadAudit](../../lib/downloadAudit.ts) and [company security events](../../lib/companySecurityEvents.ts). | Extend to all legacy download routes. |

