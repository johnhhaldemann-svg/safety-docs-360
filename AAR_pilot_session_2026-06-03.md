# After Action Report — SafePredict Pilot Setup Sessions
**Date:** June 3, 2026  
**Sessions Covered:** Full demo build through 6-month data seed  
**Platform:** safety360docs.com (Supabase: mdqkfbnwxrasdmbsjcqv, Vercel)  
**Prepared by:** Claude (Cowork AI) + John Haldemann

---

## 1. MISSION OBJECTIVE

Build and verify a fully functional 3-company demo environment on the live SafePredict platform, simulating 6 months of real pilot usage across three distinct construction/industrial company types — ready to show to prospects, investors, and early pilot users.

---

## 2. WHAT WAS ACCOMPLISHED ✅

### Platform Access
- All 3 demo company logins confirmed working end-to-end on safety360docs.com
- Multi-tenant isolation verified — each company sees only its own data

### Demo Companies Live
| Company | Admin User | Sites | Login |
|---|---|---|---|
| [DEMO] Crestwood Homes | Sarah Chen | 2 | sarah.chen@safepredict.demo |
| [DEMO] Summit Commercial Construction | Marcus Rodriguez | 3 | marcus.rodriguez@safepredict.demo |
| [DEMO] IronBridge Industrial | James O'Bryan | 3 | james.obryan@safepredict.demo |
All passwords: `SafePredict2026!`

### Gus AI — Confirmed Live
- Gus AI generating real, contextual field coaching and risk recommendations from seeded data
- Executive Overview dashboard showing prioritized safety recommendations (HIGH/MEDIUM/LOW)
- Risk scores computing live per jobsite

### 6-Month Historical Data Seeded (Dec 2025 – May 2026)

| Record Type | Crestwood | Summit | IronBridge | Total |
|---|---|---|---|---|
| Observations / Corrective Actions | 18 | 18 | 18 | **54** |
| Incidents | 8 | 9 | 7 | **24** |
| Permits | 9 | 10 | 11 | **30** |
| Toolbox Talk Sessions | 6 | 6 | 6 | **18** |
| **Total records** | **41** | **43** | **42** | **126** |

### Data Storylines Built
- **Crestwood Homes (residential):** High fall hazard incidents in winter, improving PPE and scaffold compliance by spring. Two recordable injuries (ankle sprain, laceration). Clear improvement arc.
- **Summit Commercial (commercial):** Electrical and LOTO violations driving high risk in Q1, welder arc flash injury in March, near-fall caught by harness in May. Gus AI recommendations driving corrective actions.
- **IronBridge Industrial (heavy/chemical):** Most serious profile — LOTO non-compliance, chemical splash injury, hand crush fracture (14 days lost time), confined space near misses. Stop-work issued in December. Strong recovery by Q2.

### Files Saved to Workspace
- `demo_seed_6months.sql` — Full SQL seed script (can be re-run or used as reference)
- `AAR_pilot_session_2026-06-03.md` — This document

### Bugs Fixed Along the Way
1. **auth.users confirmation_token NULL** — Login failed immediately. Fixed by setting confirmation_token to empty string `''` for all 3 demo accounts.
2. **user_roles table empty** — Platform uses `user_roles` for RLS permission checks (not `company_memberships` alone). All users appeared as "Viewer" with no write access. Fixed by inserting correct company_admin roles.

---

## 3. WHAT WENT WRONG / ISSUES ❌

### Issue 1: 1M Context Window Hit — Twice
**What happened:** The session history grew too large for the 1M context window and timed out mid-work, twice.  
**Impact:** Required full session restart. Some task state was lost. Work had to be re-summarized from scratch.  
**Fix:** Break long build sessions into separate focused sessions. Save state files (like the SQL seed) early and often.

---

### Issue 2: Observation Form Bug — Silent Failure (NOT YET FIXED)
**What happened:** When submitting an observation through the UI form, the form cleared silently but nothing saved to the database.  
**Root cause found:** The API route inserts into `company_corrective_actions` but sends enum values that don't match DB constraints:
- `observation_type` UI sends `"needs correction"` → DB requires `negative`, `positive`, or `near_miss`
- `category` UI sends `"near miss observation"` → DB requires `near_miss` (underscore, no spaces)
- The form clears on submission giving the appearance of success, but the API returns 400 silently

**Impact:** Workers cannot submit observations through the UI. This is a critical gap for any real usage.  
**Status:** **OPEN BUG — needs code fix before pilot**  
**Fix needed:** In the API route that handles observation POSTs, add a value mapping/normalization layer before the DB insert. The UI display labels need to map to the correct DB enum values.

---

### Issue 3: Jobsite Draft Not Persisting to DB
**What happened:** Clicking "+ New Jobsite" and filling out the form created a browser-local draft with an ID like `draft-site-1780529358203`. Changing status to "Active" still didn't commit it to the database.  
**Root cause:** The frontend manages draft state locally. The record only reaches the DB when a specific publish/save action completes correctly.  
**Impact:** Wasted time trying to log observations against a non-existent DB jobsite. Had to insert jobsites directly via SQL.  
**Status:** **OPEN BUG — worth investigating UX flow**  
**Fix needed:** Either auto-save draft to DB with a draft status, or make the publish step more obvious. Also surface a clear error if the save fails.

---

### Issue 4: company_permits Has No Description Column
**What happened:** When inserting permit records, the SQL failed because the `description` column doesn't exist on `company_permits`.  
**Impact:** Minor — worked around by storing notes in `source_metadata` JSONB field.  
**Status:** Low priority. Workaround in place. Could add the column via migration if needed.

---

### Issue 5: Chrome Extension Intermittent Disconnects
**What happened:** Chrome extension disconnected multiple times during login verification, requiring retry.  
**Impact:** Slowed down the UI verification steps.  
**Status:** Environment issue, not a platform bug. No action needed.

---

### Issue 6: Existing Seed Records Have June 2026 Timestamps
**What happened:** The 6 original records seeded in the previous session have `created_at = now()` (June 2026), not historical dates. They appear recent rather than historical in the timeline.  
**Impact:** Minor visual inconsistency — 6 records appear current rather than 6 months old.  
**Fix:** Run an UPDATE to backdate those original records to May or April 2026 to blend in with the historical dataset. (SQL below in Appendix.)

---

## 4. OPEN BUGS — PRIORITY LIST

| Priority | Bug | Impact |
|---|---|---|
| 🔴 Critical | Observation form silent failure (enum mismatch) | Workers cannot submit observations from UI |
| 🟠 High | Jobsite draft doesn't persist to DB | Confusing UX; users think jobsite was created when it wasn't |
| 🟡 Medium | Original seed records have wrong timestamps | Minor visual inconsistency in timeline |
| 🟢 Low | company_permits missing description column | Notes stored in metadata — functional workaround |

---

## 5. WHAT SHOULD HAPPEN NEXT

### Before Any Pilot Demo
1. **Fix the observation form enum mismatch** — this is the most important thing. The primary daily workflow (submit observation → Gus processes → corrective action → close loop) is broken from the UI.
2. **Backdate the 6 original seed records** (SQL in Appendix)
3. **Verify Gus AI is reading historical data** — log in as all 3 users and confirm dashboards show the 6-month story

### Before Real Pilot Users Onboard
4. Add more worker accounts (non-admin) so companies have a realistic workforce count
5. Consider adding JSA records (`company_jsas`) for a more complete picture
6. Review the permit workflow — confirm permits can be created from the UI end-to-end

### Nice to Have
7. Add a 4th demo company (different industry — roofing, utilities, or oil & gas) for variety
8. Generate monthly risk score snapshots in `company_risk_scores` so trend charts show 6 months of movement

---

## 6. LESSONS LEARNED

1. **Save SQL seed files before executing, not after.** Having the file meant we could resume without rewriting everything.
2. **Check DB constraints before building UI.** The enum mismatch bug would have been caught immediately if constraints were audited first.
3. **Use direct DB inserts for demo data.** Fighting the UI for demo seeding is slower and riskier than clean SQL. Build UI-first for real users.
4. **Break long sessions into focused chunks under ~800k context.** One session per major task (auth, data model, seeding, UI verification) is more reliable than one marathon session.
5. **The platform RLS model uses user_roles, not company_memberships.** Always seed both tables when creating demo users.

---

## APPENDIX A: Backdate Original Seed Records

Run this SQL to set the 6 original records (from the first session) to April–May 2026 instead of June:

```sql
-- Backdate original Crestwood records to late April 2026
UPDATE company_corrective_actions
SET created_at = '2026-04-25 09:00:00-04', updated_at = '2026-04-25 09:00:00-04'
WHERE company_id = 'a0000001-0000-4000-8000-000000000001'
  AND created_at > '2026-06-01';

-- Backdate original Summit records
UPDATE company_corrective_actions
SET created_at = '2026-04-28 09:00:00-04', updated_at = '2026-04-28 09:00:00-04'
WHERE company_id = 'a0000002-0000-4000-8000-000000000002'
  AND created_at > '2026-06-01';

-- Backdate original IronBridge records
UPDATE company_corrective_actions
SET created_at = '2026-04-30 09:00:00-04', updated_at = '2026-04-30 09:00:00-04'
WHERE company_id = 'a0000003-0000-4000-8000-000000000003'
  AND created_at > '2026-06-01';
```

---

## APPENDIX B: Demo Login Credentials

| Company | Email | Password | Role |
|---|---|---|---|
| [DEMO] Crestwood Homes | sarah.chen@safepredict.demo | SafePredict2026! | Company Admin |
| [DEMO] Summit Commercial | marcus.rodriguez@safepredict.demo | SafePredict2026! | Company Admin |
| [DEMO] IronBridge Industrial | james.obryan@safepredict.demo | SafePredict2026! | Company Admin |

Platform: https://safety360docs.com  
Supabase Project: mdqkfbnwxrasdmbsjcqv  
Vercel Project: safety360docs

---

## APPENDIX C: Key UUIDs Reference

```
-- COMPANIES
Crestwood Homes:               a0000001-0000-4000-8000-000000000001
Summit Commercial Construction: a0000002-0000-4000-8000-000000000002
IronBridge Industrial:         a0000003-0000-4000-8000-000000000003

-- USERS
Sarah Chen (Crestwood):        b1000001-0000-4000-8000-000000000001
Marcus Rodriguez (Summit):     b1000002-0000-4000-8000-000000000002
James O'Bryan (IronBridge):    b1000003-0000-4000-8000-000000000003

-- JOBSITES
Maple Ridge Estates – Phase 2:     c0000001-0000-4000-8000-000000000001
Phoenix Metro Residential Sites:   b0000001-0000-4000-8000-000000000001
Downtown Dallas Commercial – Blk4: b0000002-0000-4000-8000-000000000001
Riverside Office Complex – Twr B:  c0000002-0000-4000-8000-000000000002
Uptown Office Tower:               b0000002-0000-4000-8000-000000000002
Cleveland Bridge Rehab – Site A:   b0000003-0000-4000-8000-000000000001
Akron Chemical Plant – Site B:     b0000003-0000-4000-8000-000000000002
Northside Steel Fab Facility:      c0000003-0000-4000-8000-000000000003
```
