-- ============================================================
-- SafePredict / SafetyDocs360 — 6-Month Demo Seed Data
-- Generated: 2026-06-03
-- Covers: Dec 2025 – May 2026 (simulated pilot history)
-- ============================================================
-- Companies:
--   Crestwood Homes            | a0000001-0000-4000-8000-000000000001
--   Summit Commercial Const.   | a0000002-0000-4000-8000-000000000002
--   IronBridge Industrial      | a0000003-0000-4000-8000-000000000003
--
-- Users (company_admin):
--   Sarah Chen   (Crestwood)   | b1000001-0000-4000-8000-000000000001
--   Marcus Rodriguez (Summit)  | b1000002-0000-4000-8000-000000000002
--   James O'Bryan (IronBridge) | b1000003-0000-4000-8000-000000000003
--
-- Jobsites:
--   Crestwood:
--     Maple Ridge Estates – Phase 2    | c0000001-0000-4000-8000-000000000001
--     Phoenix Metro Residential Sites  | b0000001-0000-4000-8000-000000000001
--   Summit:
--     Downtown Dallas Commercial – Blk4| b0000002-0000-4000-8000-000000000001
--     Riverside Office Complex – Twr B | c0000002-0000-4000-8000-000000000002
--     Uptown Office Tower              | b0000002-0000-4000-8000-000000000002
--   IronBridge:
--     Cleveland Bridge Rehab – Site A  | b0000003-0000-4000-8000-000000000001
--     Akron Chemical Plant – Site B    | b0000003-0000-4000-8000-000000000002
--     Northside Steel Fab Facility     | c0000003-0000-4000-8000-000000000003
-- ============================================================


-- ============================================================
-- SECTION 1: CORRECTIVE ACTIONS / OBSERVATIONS
-- 15 records per company × 3 companies = 45 records
-- Spread Dec 2025 → May 2026
-- Note: observation_type='negative' REQUIRES sif_potential IS NOT NULL
-- ============================================================

INSERT INTO company_corrective_actions (
  company_id, jobsite_id, title, description,
  severity, priority, status,
  category, observation_type, sif_potential, sif_category,
  source_type, immediate_action_required,
  created_by, assigned_user_id,
  created_at, updated_at, due_at, closed_at
) VALUES

-- ── CRESTWOOD HOMES (residential – fall/ladder/housekeeping focus) ──

('a0000001-0000-4000-8000-000000000001','c0000001-0000-4000-8000-000000000001',
 'Missing guardrail on 2nd-floor walkway',
 'Guardrail section removed to pass materials and not replaced. Workers walking within 18 inches of open edge.',
 'high','high','verified_closed',
 'fall_hazard','negative',true,'fall_from_height',
 'field_issue',true,
 'b1000001-0000-4000-8000-000000000001','b1000001-0000-4000-8000-000000000001',
 '2025-12-03 07:45:00-05','2025-12-05 14:00:00-05',
 '2025-12-04 17:00:00-05','2025-12-05 14:00:00-05'),

('a0000001-0000-4000-8000-000000000001','c0000001-0000-4000-8000-000000000001',
 'Extension ladder not secured at top or bottom',
 'Aluminum ladder leaning on wall without top tie-off or base footing. Three workers observed using it.',
 'medium','medium','verified_closed',
 'fall_hazard','negative',true,'fall_from_height',
 'field_issue',false,
 'b1000001-0000-4000-8000-000000000001','b1000001-0000-4000-8000-000000000001',
 '2025-12-10 09:15:00-05','2025-12-12 11:00:00-05',
 '2025-12-12 17:00:00-05','2025-12-12 11:00:00-05'),

('a0000001-0000-4000-8000-000000000001','b0000001-0000-4000-8000-000000000001',
 'Positive: excellent housekeeping on framing floor',
 'All scrap lumber bundled and removed. Nail boards covered. Walkways clear on entire level 1.',
 'low','low','verified_closed',
 'housekeeping','positive',NULL,NULL,
 'field_issue',false,
 'b1000001-0000-4000-8000-000000000001',NULL,
 '2025-12-17 10:00:00-05','2025-12-17 10:00:00-05',
 NULL,'2025-12-17 10:00:00-05'),

('a0000001-0000-4000-8000-000000000001','b0000001-0000-4000-8000-000000000001',
 'Worker without hard hat in active overhead work zone',
 'Subcontractor employee observed below active framing crew without PPE. No hard hat or safety glasses.',
 'medium','medium','verified_closed',
 'ppe_violation','negative',true,'struck_by',
 'field_issue',false,
 'b1000001-0000-4000-8000-000000000001','b1000001-0000-4000-8000-000000000001',
 '2026-01-08 08:30:00-05','2026-01-09 15:00:00-05',
 '2026-01-10 17:00:00-05','2026-01-09 15:00:00-05'),

('a0000001-0000-4000-8000-000000000001','c0000001-0000-4000-8000-000000000001',
 'Scaffold plank with visible crack under load',
 'Single plank cracked lengthwise on second lift. Scaffold was loaded with three workers and roofing materials.',
 'high','high','verified_closed',
 'fall_hazard','negative',true,'fall_from_height',
 'field_issue',true,
 'b1000001-0000-4000-8000-000000000001','b1000001-0000-4000-8000-000000000001',
 '2026-01-15 07:00:00-05','2026-01-16 09:00:00-05',
 '2026-01-15 17:00:00-05','2026-01-16 09:00:00-05'),

('a0000001-0000-4000-8000-000000000001','b0000001-0000-4000-8000-000000000001',
 'Good catch: nail board identified and covered before shift',
 'Framing crew member flagged a nail board at the foot of the main stairway before crews arrived. Board covered and removed within 10 minutes.',
 'medium','low','verified_closed',
 'hazard','near_miss',false,NULL,
 'field_issue',false,
 'b1000001-0000-4000-8000-000000000001',NULL,
 '2026-01-22 06:55:00-05','2026-01-22 07:15:00-05',
 NULL,'2026-01-22 07:15:00-05'),

('a0000001-0000-4000-8000-000000000001','c0000001-0000-4000-8000-000000000001',
 'Damaged extension cord on first floor – pinched by door',
 'Heavy gauge cord running under exterior door frame with visible insulation damage. Active power tool connected.',
 'medium','medium','corrected',
 'electrical_hazard','negative',true,'electrical',
 'field_issue',true,
 'b1000001-0000-4000-8000-000000000001','b1000001-0000-4000-8000-000000000001',
 '2026-02-05 08:00:00-05','2026-02-19 10:00:00-05',
 '2026-02-07 17:00:00-05','2026-02-19 10:00:00-05'),

('a0000001-0000-4000-8000-000000000001','b0000001-0000-4000-8000-000000000001',
 'Positive: 100% tie-off observed during roof sheathing',
 'All five roofing crew members properly harnessed and attached to anchor points throughout the morning shift.',
 'low','low','verified_closed',
 'housekeeping','positive',NULL,NULL,
 'field_issue',false,
 'b1000001-0000-4000-8000-000000000001',NULL,
 '2026-02-12 12:00:00-05','2026-02-12 12:00:00-05',
 NULL,'2026-02-12 12:00:00-05'),

('a0000001-0000-4000-8000-000000000001','c0000001-0000-4000-8000-000000000001',
 'Open excavation at site perimeter – no barrier',
 'Trench for foundation drain, approximately 4 ft deep and 30 ft long, left open overnight with no barricade, cover, or warning tape.',
 'high','high','corrected',
 'excavation_trench_concern','negative',true,'excavation_collapse',
 'field_issue',true,
 'b1000001-0000-4000-8000-000000000001','b1000001-0000-4000-8000-000000000001',
 '2026-02-19 07:30:00-05','2026-03-04 09:00:00-05',
 '2026-02-20 17:00:00-05','2026-03-04 09:00:00-05'),

('a0000001-0000-4000-8000-000000000001','b0000001-0000-4000-8000-000000000001',
 'Near miss: lumber bundle fell from elevated platform',
 'Bundle of 2x10s rolled off unsecured stack on the second-floor deck. Fell approximately 14 ft to the ground — no workers below at the time.',
 'high','high','corrected',
 'fall_hazard','near_miss',true,'struck_by',
 'field_issue',true,
 'b1000001-0000-4000-8000-000000000001','b1000001-0000-4000-8000-000000000001',
 '2026-03-04 13:00:00-05','2026-03-14 11:00:00-05',
 '2026-03-07 17:00:00-05','2026-03-14 11:00:00-05'),

('a0000001-0000-4000-8000-000000000001','c0000001-0000-4000-8000-000000000001',
 'Positive: all workers properly tied off during truss install',
 'Truss installation crew of six all tied off to ridge beam anchors. Competent person on site throughout operation.',
 'low','low','verified_closed',
 'housekeeping','positive',NULL,NULL,
 'field_issue',false,
 'b1000001-0000-4000-8000-000000000001',NULL,
 '2026-03-18 09:00:00-05','2026-03-18 09:00:00-05',
 NULL,'2026-03-18 09:00:00-05'),

('a0000001-0000-4000-8000-000000000001','b0000001-0000-4000-8000-000000000001',
 'Scaffolding base plates missing – north elevation',
 'Two scaffold legs on north side resting directly on soil, no base plates or mud sills. Grade is soft from recent rain.',
 'medium','medium','in_progress',
 'fall_hazard','negative',true,'fall_from_height',
 'field_issue',false,
 'b1000001-0000-4000-8000-000000000001','b1000001-0000-4000-8000-000000000001',
 '2026-04-02 08:00:00-05','2026-04-02 08:00:00-05',
 '2026-04-05 17:00:00-05',NULL),

('a0000001-0000-4000-8000-000000000001','c0000001-0000-4000-8000-000000000001',
 'Positive: 100% PPE compliance during drywall phase',
 'Full compliance observed across all 8 drywall workers — safety glasses, gloves, and dust masks. No coaching required.',
 'low','low','verified_closed',
 'housekeeping','positive',NULL,NULL,
 'field_issue',false,
 'b1000001-0000-4000-8000-000000000001',NULL,
 '2026-04-16 10:30:00-05','2026-04-16 10:30:00-05',
 NULL,'2026-04-16 10:30:00-05'),

('a0000001-0000-4000-8000-000000000001','b0000001-0000-4000-8000-000000000001',
 'Debris accumulation on main walkway – trip hazard',
 'Scrap drywall, PVC fittings, and packaging piled along the interior walkway between units 4 and 7. Walkway width reduced to less than 18 inches.',
 'low','low','open',
 'housekeeping','negative',false,NULL,
 'field_issue',false,
 'b1000001-0000-4000-8000-000000000001','b1000001-0000-4000-8000-000000000001',
 '2026-05-01 09:00:00-04','2026-05-01 09:00:00-04',
 '2026-05-08 17:00:00-04',NULL),

('a0000001-0000-4000-8000-000000000001','c0000001-0000-4000-8000-000000000001',
 'Good catch: spotter properly used for boom truck',
 'Operator and spotter used hand signals and radio for all picks. No overhead power line approach issues. Excellent communication.',
 'low','low','verified_closed',
 'hazard','positive',NULL,NULL,
 'field_issue',false,
 'b1000001-0000-4000-8000-000000000001',NULL,
 '2026-05-15 11:00:00-04','2026-05-15 11:00:00-04',
 NULL,'2026-05-15 11:00:00-04'),


-- ── SUMMIT COMMERCIAL CONSTRUCTION (commercial – electrical/heights/hot work) ──

('a0000002-0000-4000-8000-000000000002','b0000002-0000-4000-8000-000000000001',
 'Exposed wiring at panel box on Level 4',
 'Open panel cover with live 480V conductors exposed. Area not barricaded. Two workers observed working within 3 feet.',
 'high','high','verified_closed',
 'electrical_hazard','negative',true,'electrical',
 'field_issue',true,
 'b1000002-0000-4000-8000-000000000002','b1000002-0000-4000-8000-000000000002',
 '2025-12-02 08:15:00-05','2025-12-04 09:00:00-05',
 '2025-12-03 17:00:00-05','2025-12-04 09:00:00-05'),

('a0000002-0000-4000-8000-000000000002','c0000002-0000-4000-8000-000000000002',
 'Worker on scaffold without fall arrest – Level 8',
 'Iron worker observed on exterior scaffold at 78 ft elevation without harness or lanyard. Working within 2 ft of open edge.',
 'critical','critical','verified_closed',
 'fall_hazard','negative',true,'fall_from_height',
 'field_issue',true,
 'b1000002-0000-4000-8000-000000000002','b1000002-0000-4000-8000-000000000002',
 '2025-12-09 10:00:00-05','2025-12-11 13:00:00-05',
 '2025-12-09 17:00:00-05','2025-12-11 13:00:00-05'),

('a0000002-0000-4000-8000-000000000002','b0000002-0000-4000-8000-000000000001',
 'Good catch: lockout tag found on energized panel',
 'Maintenance tech found a LOTO tag on a panel he was about to open. Tag had been missed in morning walkdown. Verified energy was NOT isolated — LOTO was improperly applied.',
 'high','high','verified_closed',
 'electrical_hazard','near_miss',true,'hazardous_energy',
 'field_issue',true,
 'b1000002-0000-4000-8000-000000000002','b1000002-0000-4000-8000-000000000002',
 '2025-12-16 14:00:00-05','2025-12-18 10:00:00-05',
 NULL,'2025-12-18 10:00:00-05'),

('a0000002-0000-4000-8000-000000000002','b0000002-0000-4000-8000-000000000001',
 'Hot work permit expired – welding continued',
 'Welder observed working 45 minutes after hot work permit expiration. Fire watch had left the area.',
 'high','high','corrected',
 'fire_hot_work_concern','negative',true,'line_of_fire',
 'field_issue',true,
 'b1000002-0000-4000-8000-000000000002','b1000002-0000-4000-8000-000000000002',
 '2026-01-06 15:30:00-05','2026-01-20 11:00:00-05',
 '2026-01-08 17:00:00-05','2026-01-20 11:00:00-05'),

('a0000002-0000-4000-8000-000000000002','c0000002-0000-4000-8000-000000000002',
 'Scaffold overloaded beyond rated capacity',
 'Swing scaffold loaded with drywall panels estimated at 1,800 lbs. Scaffold rated for 1,200 lbs. Three workers also on platform.',
 'critical','critical','corrected',
 'fall_hazard','negative',true,'fall_from_height',
 'field_issue',true,
 'b1000002-0000-4000-8000-000000000002','b1000002-0000-4000-8000-000000000002',
 '2026-01-13 09:00:00-05','2026-01-27 09:00:00-05',
 '2026-01-13 17:00:00-05','2026-01-27 09:00:00-05'),

('a0000002-0000-4000-8000-000000000002','b0000002-0000-4000-8000-000000000002',
 'Positive: 3-point contact observed on all ladder use',
 'Morning walkthrough: all 12 workers observed using 3-point contact on ladders. No cell phone use. No tools being carried.',
 'low','low','verified_closed',
 'housekeeping','positive',NULL,NULL,
 'field_issue',false,
 'b1000002-0000-4000-8000-000000000002',NULL,
 '2026-01-20 11:00:00-05','2026-01-20 11:00:00-05',
 NULL,'2026-01-20 11:00:00-05'),

('a0000002-0000-4000-8000-000000000002','b0000002-0000-4000-8000-000000000001',
 'PPE violation: grinding without eye protection',
 'Two workers grinding structural steel without face shields or safety glasses. Flying sparks observed 10+ ft radius.',
 'medium','medium','corrected',
 'ppe_violation','negative',true,'struck_by',
 'field_issue',false,
 'b1000002-0000-4000-8000-000000000002','b1000002-0000-4000-8000-000000000002',
 '2026-02-03 13:00:00-05','2026-02-14 10:00:00-05',
 '2026-02-05 17:00:00-05','2026-02-14 10:00:00-05'),

('a0000002-0000-4000-8000-000000000002','c0000002-0000-4000-8000-000000000002',
 'Near miss: tool dropped from Level 6 – no barricade below',
 'Impact wrench fell approximately 55 ft from Level 6 exterior deck. Landed 4 ft from a concrete finisher who did not see it coming.',
 'high','high','corrected',
 'hazard','near_miss',true,'struck_by',
 'field_issue',true,
 'b1000002-0000-4000-8000-000000000002','b1000002-0000-4000-8000-000000000002',
 '2026-02-10 10:30:00-05','2026-02-24 11:00:00-05',
 '2026-02-12 17:00:00-05','2026-02-24 11:00:00-05'),

('a0000002-0000-4000-8000-000000000002','b0000002-0000-4000-8000-000000000001',
 'Positive: fire watch properly positioned for all hot work',
 'All three welding crews had dedicated fire watches, correct extinguisher type, and 30-minute post-work monitoring. Full compliance.',
 'low','low','verified_closed',
 'housekeeping','positive',NULL,NULL,
 'field_issue',false,
 'b1000002-0000-4000-8000-000000000002',NULL,
 '2026-02-24 15:00:00-05','2026-02-24 15:00:00-05',
 NULL,'2026-02-24 15:00:00-05'),

('a0000002-0000-4000-8000-000000000002','b0000002-0000-4000-8000-000000000002',
 'LOTO procedure not followed during HVAC startup',
 'Mechanic began startup sequence on roof HVAC unit while electrical sub was still working inside the unit. No lockout applied.',
 'critical','critical','corrected',
 'electrical_hazard','negative',true,'hazardous_energy',
 'field_issue',true,
 'b1000002-0000-4000-8000-000000000002','b1000002-0000-4000-8000-000000000002',
 '2026-03-10 14:00:00-05','2026-03-21 10:00:00-05',
 '2026-03-10 17:00:00-05','2026-03-21 10:00:00-05'),

('a0000002-0000-4000-8000-000000000002','c0000002-0000-4000-8000-000000000002',
 'Positive: all welding equipment properly grounded',
 'Electrical inspection of all 8 welding machines on Tower B. All properly grounded, cables in good condition, no damage noted.',
 'low','low','verified_closed',
 'housekeeping','positive',NULL,NULL,
 'field_issue',false,
 'b1000002-0000-4000-8000-000000000002',NULL,
 '2026-03-24 09:00:00-05','2026-03-24 09:00:00-05',
 NULL,'2026-03-24 09:00:00-05'),

('a0000002-0000-4000-8000-000000000002','c0000002-0000-4000-8000-000000000002',
 'Unsecured materials on exterior scaffolding',
 'Stacks of metal decking panels not strapped or toe-boarded on Level 5 scaffold. High wind advisory in effect.',
 'medium','medium','in_progress',
 'fall_hazard','negative',true,'struck_by',
 'field_issue',false,
 'b1000002-0000-4000-8000-000000000002','b1000002-0000-4000-8000-000000000002',
 '2026-04-07 09:00:00-05','2026-04-07 09:00:00-05',
 '2026-04-10 17:00:00-05',NULL),

('a0000002-0000-4000-8000-000000000002','b0000002-0000-4000-8000-000000000002',
 'Positive: 100% fall protection compliance on all towers',
 'Full site inspection of Uptown Tower and Riverside Tower B. All 23 workers with documented tie-off. Anchor points confirmed rated.',
 'low','low','verified_closed',
 'housekeeping','positive',NULL,NULL,
 'field_issue',false,
 'b1000002-0000-4000-8000-000000000002',NULL,
 '2026-04-21 14:00:00-05','2026-04-21 14:00:00-05',
 NULL,'2026-04-21 14:00:00-05'),

('a0000002-0000-4000-8000-000000000002','b0000002-0000-4000-8000-000000000001',
 'Crane operating near overhead power lines – Tower B',
 'Boom truck extended within estimated 12 feet of 13.8kV overhead line during concrete bucket lift. No utility spotter present.',
 'high','high','open',
 'electrical_hazard','negative',true,'electrical',
 'field_issue',true,
 'b1000002-0000-4000-8000-000000000002','b1000002-0000-4000-8000-000000000002',
 '2026-05-05 10:00:00-04','2026-05-05 10:00:00-04',
 '2026-05-08 17:00:00-04',NULL),

('a0000002-0000-4000-8000-000000000002','c0000002-0000-4000-8000-000000000002',
 'Good catch: rebar caps installed on all vertical rebar',
 'Entire rebar mat covered with OSHA-compliant caps before framing crew arrived. No impalement hazards present.',
 'low','low','verified_closed',
 'hazard','positive',NULL,NULL,
 'field_issue',false,
 'b1000002-0000-4000-8000-000000000002',NULL,
 '2026-05-19 09:30:00-04','2026-05-19 09:30:00-04',
 NULL,'2026-05-19 09:30:00-04'),


-- ── IRONBRIDGE INDUSTRIAL (heavy industry – LOTO/confined space/chemical) ──

('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000002',
 'LOTO not applied before conveyor maintenance',
 'Millwright began maintenance on belt conveyor without lockout/tagout. Conveyor was in standby mode, not de-energized. SIF event category: hazardous energy.',
 'critical','critical','corrected',
 'electrical_hazard','negative',true,'hazardous_energy',
 'field_issue',true,
 'b1000003-0000-4000-8000-000000000003','b1000003-0000-4000-8000-000000000003',
 '2025-12-01 07:00:00-05','2025-12-15 11:00:00-05',
 '2025-12-01 17:00:00-05','2025-12-15 11:00:00-05'),

('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000002',
 'Chemical drums stored without secondary containment',
 'Four 55-gallon drums of sulfuric acid stored in main warehouse without containment pallets. Berm not in place.',
 'high','high','corrected',
 'hazard','negative',true,'line_of_fire',
 'field_issue',true,
 'b1000003-0000-4000-8000-000000000003','b1000003-0000-4000-8000-000000000003',
 '2025-12-08 09:00:00-05','2025-12-22 10:00:00-05',
 '2025-12-10 17:00:00-05','2025-12-22 10:00:00-05'),

('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000002',
 'Near miss: worker entered confined space without permit',
 'Operator entered reactor vessel to retrieve tool before atmosphere testing was complete. No entry permit issued. Rescue plan not in place.',
 'critical','critical','corrected',
 'hazard','near_miss',true,'confined_space',
 'field_issue',true,
 'b1000003-0000-4000-8000-000000000003','b1000003-0000-4000-8000-000000000003',
 '2025-12-15 13:00:00-05','2025-12-29 11:00:00-05',
 '2025-12-15 17:00:00-05','2025-12-29 11:00:00-05'),

('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000001',
 'Positive: LOTO audit – all locks applied correctly',
 'Unannounced LOTO audit across 12 energy isolation points on Bridge Rehab Site A. All locks and tags properly applied. Audit rating: PASS.',
 'low','low','verified_closed',
 'housekeeping','positive',NULL,NULL,
 'field_issue',false,
 'b1000003-0000-4000-8000-000000000003',NULL,
 '2026-01-05 10:00:00-05','2026-01-05 10:00:00-05',
 NULL,'2026-01-05 10:00:00-05'),

('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000002',
 'Atmosphere test not performed before confined space entry',
 'Two workers entered a process vessel for inspection without completing pre-entry atmosphere test. H2S and O2 levels unverified.',
 'critical','critical','corrected',
 'hazard','negative',true,'confined_space',
 'field_issue',true,
 'b1000003-0000-4000-8000-000000000003','b1000003-0000-4000-8000-000000000003',
 '2026-01-12 08:00:00-05','2026-01-26 11:00:00-05',
 '2026-01-12 17:00:00-05','2026-01-26 11:00:00-05'),

('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000002',
 'PPE non-compliance: no respirator in chemical transfer zone',
 'Three workers observed in acid transfer area without half-face respirators. SDS requires APF-10 minimum.',
 'high','high','corrected',
 'ppe_violation','negative',true,'line_of_fire',
 'field_issue',false,
 'b1000003-0000-4000-8000-000000000003','b1000003-0000-4000-8000-000000000003',
 '2026-01-19 14:00:00-05','2026-02-02 10:00:00-05',
 '2026-01-22 17:00:00-05','2026-02-02 10:00:00-05'),

('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000002',
 'Good catch: gas detector alarm acknowledged and evacuated',
 'Operator heard gas detector alarm in Tank Farm C, immediately followed evacuation procedure, pulled all personnel before investigation. Leak confirmed minor — valve packing.',
 'low','low','verified_closed',
 'hazard','positive',NULL,NULL,
 'field_issue',false,
 'b1000003-0000-4000-8000-000000000003',NULL,
 '2026-02-02 09:00:00-05','2026-02-02 09:00:00-05',
 NULL,'2026-02-02 09:00:00-05'),

('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000001',
 'Crane load chart not present during bridge beam lift',
 'Mobile crane operator conducting multi-ton bridge beam pick without load chart in cab. Rigger did not verify lift plan before signaling.',
 'high','high','corrected',
 'equipment_issue','negative',true,'crane_rigging',
 'field_issue',true,
 'b1000003-0000-4000-8000-000000000003','b1000003-0000-4000-8000-000000000003',
 '2026-02-09 11:00:00-05','2026-02-23 10:00:00-05',
 '2026-02-11 17:00:00-05','2026-02-23 10:00:00-05'),

('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000002',
 'Near miss: compressed gas cylinder tipped over',
 'Oxygen cylinder not secured to wall rack in welding bay. Cylinder tipped when cart passed, valve struck concrete. No ignition.',
 'high','high','corrected',
 'hazard','near_miss',true,'struck_by',
 'field_issue',true,
 'b1000003-0000-4000-8000-000000000003','b1000003-0000-4000-8000-000000000003',
 '2026-02-23 15:00:00-05','2026-03-09 10:00:00-05',
 '2026-02-25 17:00:00-05','2026-03-09 10:00:00-05'),

('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000002',
 'Positive: confined space training completion – full crew',
 'All 18 chemical plant operators completed updated confined space entry training. Permits now reviewed; no gaps in certification.',
 'low','low','verified_closed',
 'housekeeping','positive',NULL,NULL,
 'field_issue',false,
 'b1000003-0000-4000-8000-000000000003',NULL,
 '2026-03-09 14:00:00-05','2026-03-09 14:00:00-05',
 NULL,'2026-03-09 14:00:00-05'),

('a0000003-0000-4000-8000-000000000003','c0000003-0000-4000-8000-000000000003',
 'Scaffold incomplete on tank vessel repair platform',
 'Intermediate guard rail missing on east side of tank scaffold at 22 ft elevation. Workers using platform for bolt inspection.',
 'high','high','in_progress',
 'fall_hazard','negative',true,'fall_from_height',
 'field_issue',false,
 'b1000003-0000-4000-8000-000000000003','b1000003-0000-4000-8000-000000000003',
 '2026-03-16 08:00:00-05','2026-03-16 08:00:00-05',
 '2026-03-19 17:00:00-05',NULL),

('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000002',
 'Positive: all chemical handlers in correct PPE',
 'Full compliance observed in acid transfer zone. All workers with face shields, chemical splash suits, and butyl rubber gloves properly donned.',
 'low','low','verified_closed',
 'housekeeping','positive',NULL,NULL,
 'field_issue',false,
 'b1000003-0000-4000-8000-000000000003',NULL,
 '2026-04-06 11:00:00-05','2026-04-06 11:00:00-05',
 NULL,'2026-04-06 11:00:00-05'),

('a0000003-0000-4000-8000-000000000003','c0000003-0000-4000-8000-000000000003',
 'Angle grinder guard removed during operation',
 'Worker operating 9-inch angle grinder with wheel guard fully removed. No face shield. Sparks directed toward coworker 6 ft away.',
 'medium','medium','corrected',
 'equipment_issue','negative',true,'struck_by',
 'field_issue',false,
 'b1000003-0000-4000-8000-000000000003','b1000003-0000-4000-8000-000000000003',
 '2026-04-20 10:00:00-05','2026-05-04 10:00:00-04',
 '2026-04-23 17:00:00-05','2026-05-04 10:00:00-04'),

('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000002',
 'Positive: 100% fall protection compliance – chemical process area',
 'All personnel in elevated process areas properly harnessed. Safety audit score: 98/100.',
 'low','low','verified_closed',
 'housekeeping','positive',NULL,NULL,
 'field_issue',false,
 'b1000003-0000-4000-8000-000000000003',NULL,
 '2026-05-04 14:00:00-04','2026-05-04 14:00:00-04',
 NULL,'2026-05-04 14:00:00-04'),

('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000002',
 'Heat stress monitoring not documented during high-heat day',
 'Outdoor temperature reached 91°F. No heat stress monitoring logs completed for afternoon shift. Workers not observed drinking water regularly.',
 'medium','medium','open',
 'hazard','negative',false,NULL,
 'field_issue',false,
 'b1000003-0000-4000-8000-000000000003','b1000003-0000-4000-8000-000000000003',
 '2026-05-18 16:00:00-04','2026-05-18 16:00:00-04',
 '2026-05-22 17:00:00-04',NULL);


-- ============================================================
-- SECTION 2: INCIDENTS
-- 4 per company × 3 = 12 records
-- ============================================================

INSERT INTO company_incidents (
  company_id, jobsite_id, title, description,
  severity, status, category,
  owner_user_id, created_by,
  occurred_at, created_at, updated_at, closed_at,
  injury_type, body_part, injury_source, exposure_event_type,
  injury_day_of_week, injury_month, injury_season, injury_time_of_day,
  days_away_from_work, days_restricted, recordable, lost_time, fatality,
  sif_flag, escalation_level, stop_work_status
) VALUES

-- CRESTWOOD incidents
('a0000001-0000-4000-8000-000000000001','c0000001-0000-4000-8000-000000000001',
 'Framing carpenter – sprain from ladder slip',
 'Worker descending a 6-ft stepladder slipped on the second rung. Twisted right ankle on landing. Sent to urgent care. Returned to modified duty next day.',
 'medium','closed','incident',
 'b1000001-0000-4000-8000-000000000001','b1000001-0000-4000-8000-000000000001',
 '2025-12-11 10:30:00-05','2025-12-11 11:00:00-05','2026-01-08 09:00:00-05','2026-01-08 09:00:00-05',
 'sprain','foot','ladder','fall_same_level',
 'thursday',12,'winter','morning',
 0,4,true,false,false,
 false,'none','normal'),

('a0000001-0000-4000-8000-000000000001','b0000001-0000-4000-8000-000000000001',
 'Roofer – laceration from utility knife',
 'Worker cutting membrane roofing material slipped and lacerated left palm. Required 4 stitches at urgent care. Returned to work same day with modified duty.',
 'medium','closed','incident',
 'b1000001-0000-4000-8000-000000000001','b1000001-0000-4000-8000-000000000001',
 '2026-02-03 13:15:00-05','2026-02-03 14:00:00-05','2026-03-01 10:00:00-05','2026-03-01 10:00:00-05',
 'laceration','hand','hand_tools','contact_with_equipment',
 'tuesday',2,'winter','afternoon',
 0,2,true,false,false,
 false,'none','normal'),

('a0000001-0000-4000-8000-000000000001','c0000001-0000-4000-8000-000000000001',
 'Electrician – struck by falling pipe section',
 'Rough-in plumber dropped a 3-inch PVC section from above. Pipe struck electrician below on shoulder. Bruising and minor contusion. No lost time.',
 'medium','closed','incident',
 'b1000001-0000-4000-8000-000000000001','b1000001-0000-4000-8000-000000000001',
 '2026-03-18 09:45:00-05','2026-03-18 10:00:00-05','2026-04-02 10:00:00-05','2026-04-02 10:00:00-05',
 'contusion','shoulder','material_handling','struck_by_object',
 'tuesday',3,'spring','morning',
 0,0,true,false,false,
 false,'none','normal'),

('a0000001-0000-4000-8000-000000000001','b0000001-0000-4000-8000-000000000001',
 'Laborer – heat illness during exterior work',
 'Worker became dizzy and nauseous during exterior concrete work on 94°F day. Treated on site by first aid, transported to ER as precaution. Released same day.',
 'medium','in_progress','incident',
 'b1000001-0000-4000-8000-000000000001','b1000001-0000-4000-8000-000000000001',
 '2026-05-21 14:30:00-04','2026-05-21 15:00:00-04','2026-05-21 15:00:00-04',NULL,
 'heat_illness','other','other','temperature_extreme',
 'thursday',5,'spring','afternoon',
 1,0,true,true,false,
 false,'monitor','normal'),

-- SUMMIT incidents
('a0000002-0000-4000-8000-000000000002','b0000002-0000-4000-8000-000000000001',
 'Ironworker – laceration from power tool',
 'Circular saw kickback during steel stud cutting. Blade contacted worker''s left forearm. 8 stitches required. Returned to work 2 days later.',
 'high','closed','incident',
 'b1000002-0000-4000-8000-000000000002','b1000002-0000-4000-8000-000000000002',
 '2026-01-14 08:45:00-05','2026-01-14 09:15:00-05','2026-02-10 11:00:00-05','2026-02-10 11:00:00-05',
 'laceration','hand','hand_tools','contact_with_equipment',
 'wednesday',1,'winter','morning',
 2,5,true,true,false,
 false,'none','normal'),

('a0000002-0000-4000-8000-000000000002','c0000002-0000-4000-8000-000000000002',
 'Concrete finisher – back strain lifting form panels',
 'Worker lifted heavy aluminum form panel without mechanical assist. Reported lower back pain at end of shift. Modified duty for 10 days.',
 'medium','closed','incident',
 'b1000002-0000-4000-8000-000000000002','b1000002-0000-4000-8000-000000000002',
 '2026-02-25 16:00:00-05','2026-02-25 16:30:00-05','2026-03-15 10:00:00-05','2026-03-15 10:00:00-05',
 'strain','back','material_handling','overexertion',
 'wednesday',2,'winter','afternoon',
 0,10,true,false,false,
 false,'none','normal'),

('a0000002-0000-4000-8000-000000000002','b0000002-0000-4000-8000-000000000001',
 'Welder – flash burn to eyes',
 'Welder working without proper helmet shade experienced arc flash. Sought medical care following day for eye pain and photophobia. Restricted duty 3 days.',
 'high','closed','incident',
 'b1000002-0000-4000-8000-000000000002','b1000002-0000-4000-8000-000000000002',
 '2026-03-28 14:00:00-05','2026-03-28 14:30:00-05','2026-04-15 10:00:00-05','2026-04-15 10:00:00-05',
 'burn','eye','electrical_system','electrical',
 'friday',3,'spring','afternoon',
 0,3,true,false,false,
 true,'urgent','normal'),

('a0000002-0000-4000-8000-000000000002','c0000002-0000-4000-8000-000000000002',
 'Scaffold worker – near-fall caught by harness',
 'Worker slipped on wet scaffold plank at Level 9 and fell approximately 18 inches before harness arrested the fall. No injury. Equipment inspected and cleared.',
 'high','closed','incident',
 'b1000002-0000-4000-8000-000000000002','b1000002-0000-4000-8000-000000000002',
 '2026-05-07 09:30:00-04','2026-05-07 10:00:00-04','2026-05-14 10:00:00-04','2026-05-14 10:00:00-04',
 'other','other','scaffold','fall_to_lower_level',
 'thursday',5,'spring','morning',
 0,0,false,false,false,
 true,'monitor','normal'),

-- IRONBRIDGE incidents
('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000002',
 'Process operator – chemical splash to forearm',
 'Pressurized fitting failed during connection to transfer line. Dilute acid splashed operator''s forearm. Decontaminated on site; treated at occupational health clinic. No lost time.',
 'high','closed','incident',
 'b1000003-0000-4000-8000-000000000003','b1000003-0000-4000-8000-000000000003',
 '2025-12-18 10:00:00-05','2025-12-18 10:30:00-05','2026-01-12 11:00:00-05','2026-01-12 11:00:00-05',
 'chemical_burn','hand','other','exposure_harmful_substance',
 'thursday',12,'winter','morning',
 0,3,true,false,false,
 true,'urgent','normal'),

('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000001',
 'Bridge rigger – hand crush from slip of beam',
 'Bridge beam shifted during pick due to sling slippage. Rigger''s right hand caught between beam and temporary support. Fractured two fingers. 14 days away from work.',
 'critical','closed','incident',
 'b1000003-0000-4000-8000-000000000003','b1000003-0000-4000-8000-000000000003',
 '2026-02-17 13:30:00-05','2026-02-17 14:00:00-05','2026-03-10 11:00:00-05','2026-03-10 11:00:00-05',
 'fracture','fingers','heavy_equipment','caught_in_between',
 'tuesday',2,'winter','afternoon',
 14,7,true,true,false,
 true,'critical','cleared'),

('a0000003-0000-4000-8000-000000000003','c0000003-0000-4000-8000-000000000003',
 'Fabricator – grinder disc shatter',
 'Type 27 grinding disc shattered at high speed, sending fragments into worker''s shin and boot. Lacerations required 6 stitches. Guard had been removed.',
 'high','closed','incident',
 'b1000003-0000-4000-8000-000000000003','b1000003-0000-4000-8000-000000000003',
 '2026-04-22 08:15:00-05','2026-04-22 09:00:00-05','2026-05-10 10:00:00-04','2026-05-10 10:00:00-04',
 'laceration','foot','hand_tools','struck_by_object',
 'wednesday',4,'spring','morning',
 0,5,true,false,false,
 false,'none','normal'),

('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000002',
 'Millwright – heat exhaustion during maintenance shutdown',
 'Worker performing shutdown maintenance in enclosed vessel space became disoriented and nauseous. Removed from space; treated with fluids and cooling. Returned next shift.',
 'medium','in_progress','incident',
 'b1000003-0000-4000-8000-000000000003','b1000003-0000-4000-8000-000000000003',
 '2026-05-20 15:00:00-04','2026-05-20 15:30:00-04','2026-05-20 15:30:00-04',NULL,
 'heat_illness','other','other','temperature_extreme',
 'wednesday',5,'spring','afternoon',
 1,0,true,true,false,
 false,'monitor','normal');


-- ============================================================
-- SECTION 3: PERMITS
-- 5 per company × 3 = 15 records
-- permit_type is free text (no enum constraint)
-- ============================================================

INSERT INTO company_permits (
  company_id, jobsite_id, permit_type, title, description,
  severity, status, category,
  owner_user_id, created_by,
  created_at, updated_at, due_at
) VALUES

-- CRESTWOOD permits
('a0000001-0000-4000-8000-000000000001','c0000001-0000-4000-8000-000000000001',
 'Hot Work','Hot Work Permit – Plumbing Torch Work Level 2',
 'Permit for propane torch use during copper pipe sweating on Level 2. Fire watch assigned: Jose Reyes. Extinguisher staged.',
 'medium','closed','corrective_action',
 'b1000001-0000-4000-8000-000000000001','b1000001-0000-4000-8000-000000000001',
 '2025-12-08 07:00:00-05','2025-12-08 16:30:00-05','2025-12-08 16:00:00-05'),

('a0000001-0000-4000-8000-000000000001','b0000001-0000-4000-8000-000000000001',
 'Excavation','Excavation Permit – Foundation Drain Trench',
 'Permit for 4-ft trench along south perimeter for foundation drain. Competent person: Mike Torres. Soil classification Type B.',
 'high','closed','corrective_action',
 'b1000001-0000-4000-8000-000000000001','b1000001-0000-4000-8000-000000000001',
 '2026-01-20 07:00:00-05','2026-01-27 15:00:00-05','2026-01-27 15:00:00-05'),

('a0000001-0000-4000-8000-000000000001','c0000001-0000-4000-8000-000000000001',
 'Elevated Work','Elevated Work Permit – Truss Installation',
 'Permit for truss crane pick and installation at elevations up to 28 ft. Competent person required. 100% tie-off enforced.',
 'high','closed','corrective_action',
 'b1000001-0000-4000-8000-000000000001','b1000001-0000-4000-8000-000000000001',
 '2026-03-15 07:00:00-05','2026-03-18 16:00:00-05','2026-03-18 16:00:00-05'),

('a0000001-0000-4000-8000-000000000001','b0000001-0000-4000-8000-000000000001',
 'Hot Work','Hot Work Permit – Roofing Torch Application',
 'Torch-down roofing membrane application. Fire watch: two-person team. 1-hour post-work monitoring required.',
 'medium','active','corrective_action',
 'b1000001-0000-4000-8000-000000000001','b1000001-0000-4000-8000-000000000001',
 '2026-05-12 07:00:00-04','2026-05-12 07:00:00-04','2026-05-12 16:00:00-04'),

('a0000001-0000-4000-8000-000000000001','c0000001-0000-4000-8000-000000000001',
 'Crane Lift','Critical Lift Permit – Roof Package Unit Pick',
 'Pick of 4,800 lb HVAC package unit to roof using 50-ton hydraulic crane. Engineered lift plan attached. Ground conditions verified.',
 'high','active','corrective_action',
 'b1000001-0000-4000-8000-000000000001','b1000001-0000-4000-8000-000000000001',
 '2026-05-28 07:00:00-04','2026-05-28 07:00:00-04','2026-05-28 16:00:00-04'),

-- SUMMIT permits
('a0000002-0000-4000-8000-000000000002','b0000002-0000-4000-8000-000000000001',
 'Hot Work','Hot Work Permit – Structural Steel Welding Level 4',
 'Welding of structural connections on Level 4 commercial core. Fire watch: R. Gutierrez. Hot work zone radius 35 ft. Combustibles removed.',
 'high','closed','corrective_action',
 'b1000002-0000-4000-8000-000000000002','b1000002-0000-4000-8000-000000000002',
 '2025-12-15 07:00:00-05','2025-12-15 17:00:00-05','2025-12-15 17:00:00-05'),

('a0000002-0000-4000-8000-000000000002','c0000002-0000-4000-8000-000000000002',
 'Elevated Work','Elevated Work Permit – Exterior Curtain Wall Level 8-12',
 'Swing scaffold and fall protection plan for curtain wall installation on Tower B levels 8 through 12. Max elevation 115 ft.',
 'critical','closed','corrective_action',
 'b1000002-0000-4000-8000-000000000002','b1000002-0000-4000-8000-000000000002',
 '2026-01-27 07:00:00-05','2026-02-28 17:00:00-05','2026-02-28 17:00:00-05'),

('a0000002-0000-4000-8000-000000000002','b0000002-0000-4000-8000-000000000001',
 'LOTO','Lockout/Tagout Permit – Electrical Panel Replacement',
 'LOTO for replacement of main 480V distribution panel on Level 5. Qualified electrician only. Verification test required before re-energize.',
 'critical','closed','corrective_action',
 'b1000002-0000-4000-8000-000000000002','b1000002-0000-4000-8000-000000000002',
 '2026-03-05 07:00:00-05','2026-03-05 17:00:00-05','2026-03-05 17:00:00-05'),

('a0000002-0000-4000-8000-000000000002','c0000002-0000-4000-8000-000000000002',
 'Hot Work','Hot Work Permit – Deck Welding Levels 13-15',
 'Metal deck welding on upper three levels. Two-person fire watch. Combustible survey completed. Duration: 5 days.',
 'high','active','corrective_action',
 'b1000002-0000-4000-8000-000000000002','b1000002-0000-4000-8000-000000000002',
 '2026-05-19 07:00:00-04','2026-05-19 07:00:00-04','2026-05-23 17:00:00-04'),

('a0000002-0000-4000-8000-000000000002','b0000002-0000-4000-8000-000000000002',
 'Crane Lift','Critical Lift Permit – Cooling Tower Pick',
 'Pick of two 12,000 lb cooling tower sections to roof of Uptown Tower. Engineered lift plan. Ground bearing pressure verified by geotech.',
 'critical','active','corrective_action',
 'b1000002-0000-4000-8000-000000000002','b1000002-0000-4000-8000-000000000002',
 '2026-05-27 07:00:00-04','2026-05-27 07:00:00-04','2026-05-27 17:00:00-04'),

-- IRONBRIDGE permits
('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000002',
 'Confined Space','Confined Space Entry Permit – Reactor Vessel R-201',
 'Entry into Reactor R-201 for internal inspection. Attendant: D. Marsh. Rescue team on standby. O2: 20.9%, LEL: 0%, H2S: 0 ppm confirmed.',
 'critical','closed','corrective_action',
 'b1000003-0000-4000-8000-000000000003','b1000003-0000-4000-8000-000000000003',
 '2025-12-29 08:00:00-05','2025-12-29 15:00:00-05','2025-12-29 15:00:00-05'),

('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000001',
 'Crane Lift','Critical Lift Permit – Bridge Beam Set Span 4',
 'Setting 78-ft, 42-ton bridge beam using 300-ton crawler crane. Engineered rigging plan. All underground utilities marked. Spotter assigned.',
 'critical','closed','corrective_action',
 'b1000003-0000-4000-8000-000000000003','b1000003-0000-4000-8000-000000000003',
 '2026-02-24 07:00:00-05','2026-02-24 17:00:00-05','2026-02-24 17:00:00-05'),

('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000002',
 'Hot Work','Hot Work Permit – Tank Farm Welding',
 'Repair welding on Tank T-14 shell. Area purged and gas-free verified. Fire watch: two people. Combustible monitor running continuously.',
 'critical','closed','corrective_action',
 'b1000003-0000-4000-8000-000000000003','b1000003-0000-4000-8000-000000000003',
 '2026-03-20 08:00:00-05','2026-03-20 17:00:00-05','2026-03-20 17:00:00-05'),

('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000002',
 'Confined Space','Confined Space Entry – Pump Vault PV-07',
 'Entry for pump replacement in below-grade pump vault. Forced air ventilation. Continuous atmosphere monitoring. Attendant trained and posted.',
 'high','active','corrective_action',
 'b1000003-0000-4000-8000-000000000003','b1000003-0000-4000-8000-000000000003',
 '2026-05-13 08:00:00-04','2026-05-13 08:00:00-04','2026-05-13 17:00:00-04'),

('a0000003-0000-4000-8000-000000000003','c0000003-0000-4000-8000-000000000003',
 'LOTO','Lockout/Tagout Permit – Press Line Maintenance',
 'LOTO for full press line shutdown for scheduled PM. 14 energy isolation points. Group LOTO procedure. Duration: 2 days.',
 'high','active','corrective_action',
 'b1000003-0000-4000-8000-000000000003','b1000003-0000-4000-8000-000000000003',
 '2026-05-26 07:00:00-04','2026-05-26 07:00:00-04','2026-05-27 17:00:00-04');


-- ============================================================
-- SECTION 4: TOOLBOX TALK SESSIONS
-- 6 per company × 3 = 18 records
-- ============================================================

INSERT INTO company_toolbox_sessions (
  company_id, jobsite_id, conducted_by, conducted_at,
  notes, status, created_at, updated_at
) VALUES

-- CRESTWOOD toolbox talks
('a0000001-0000-4000-8000-000000000001','c0000001-0000-4000-8000-000000000001',
 'b1000001-0000-4000-8000-000000000001',
 '2025-12-05 07:00:00-05',
 'Fall Protection Basics — Reviewed harness inspection, anchor points, and 100% tie-off policy. 8 attendees. Triggered by guardrail incident earlier in week.',
 'completed','2025-12-05 07:00:00-05','2025-12-05 08:00:00-05'),

('a0000001-0000-4000-8000-000000000001','b0000001-0000-4000-8000-000000000001',
 'b1000001-0000-4000-8000-000000000001',
 '2026-01-06 07:00:00-05',
 'Ladder Safety — 3-point contact, securing top and bottom, correct angle. 11 attendees. New year safety kickoff.',
 'completed','2026-01-06 07:00:00-05','2026-01-06 08:00:00-05'),

('a0000001-0000-4000-8000-000000000001','c0000001-0000-4000-8000-000000000001',
 'b1000001-0000-4000-8000-000000000001',
 '2026-02-03 07:00:00-05',
 'Electrical Safety — Extension cord inspection, GFCI use, safe distances from overhead lines. 9 attendees.',
 'completed','2026-02-03 07:00:00-05','2026-02-03 08:00:00-05'),

('a0000001-0000-4000-8000-000000000001','b0000001-0000-4000-8000-000000000001',
 'b1000001-0000-4000-8000-000000000001',
 '2026-03-03 07:00:00-05',
 'Struck-By Hazards — Overhead work barricading, tool tethering, hard hat requirements. 13 attendees. Triggered by near miss last week.',
 'completed','2026-03-03 07:00:00-05','2026-03-03 08:00:00-05'),

('a0000001-0000-4000-8000-000000000001','c0000001-0000-4000-8000-000000000001',
 'b1000001-0000-4000-8000-000000000001',
 '2026-04-07 07:00:00-05',
 'Scaffold Safety — Base plate requirements, plank inspection, load ratings, fall protection on scaffold. 10 attendees.',
 'completed','2026-04-07 07:00:00-05','2026-04-07 08:00:00-05'),

('a0000001-0000-4000-8000-000000000001','b0000001-0000-4000-8000-000000000001',
 'b1000001-0000-4000-8000-000000000001',
 '2026-05-05 07:00:00-04',
 'Heat Illness Prevention — Signs of heat exhaustion, hydration requirements, buddy system in high temps. 14 attendees.',
 'completed','2026-05-05 07:00:00-04','2026-05-05 08:00:00-04'),

-- SUMMIT toolbox talks
('a0000002-0000-4000-8000-000000000002','b0000002-0000-4000-8000-000000000001',
 'b1000002-0000-4000-8000-000000000002',
 '2025-12-04 07:00:00-05',
 'Electrical Safety and LOTO — Panel safety, exposed conductors, lockout procedure review. 16 attendees. Triggered by panel box incident.',
 'completed','2025-12-04 07:00:00-05','2025-12-04 08:00:00-05'),

('a0000002-0000-4000-8000-000000000002','c0000002-0000-4000-8000-000000000002',
 'b1000002-0000-4000-8000-000000000002',
 '2026-01-05 07:00:00-05',
 'Fall Arrest Systems — Harness fit, D-ring placement, lanyard types, self-retracting lifelines. 22 attendees. Critical for high-rise work on Tower B.',
 'completed','2026-01-05 07:00:00-05','2026-01-05 08:00:00-05'),

('a0000002-0000-4000-8000-000000000002','b0000002-0000-4000-8000-000000000001',
 'b1000002-0000-4000-8000-000000000002',
 '2026-02-02 07:00:00-05',
 'Hot Work Safety — Permit requirements, fire watch duties, post-work monitoring, combustible survey. 18 attendees.',
 'completed','2026-02-02 07:00:00-05','2026-02-02 08:00:00-05'),

('a0000002-0000-4000-8000-000000000002','c0000002-0000-4000-8000-000000000002',
 'b1000002-0000-4000-8000-000000000002',
 '2026-03-09 07:00:00-05',
 'Overhead Hazards – Tool and Material Tethering — Barricading below overhead work, toe boards, tool tethers. 20 attendees.',
 'completed','2026-03-09 07:00:00-05','2026-03-09 08:00:00-05'),

('a0000002-0000-4000-8000-000000000002','b0000002-0000-4000-8000-000000000002',
 'b1000002-0000-4000-8000-000000000002',
 '2026-04-06 07:00:00-05',
 'PPE Compliance — Eye protection selection, grinder PPE, hearing protection zones. 19 attendees. Response to flash burn incident.',
 'completed','2026-04-06 07:00:00-05','2026-04-06 08:00:00-05'),

('a0000002-0000-4000-8000-000000000002','c0000002-0000-4000-8000-000000000002',
 'b1000002-0000-4000-8000-000000000002',
 '2026-05-04 07:00:00-04',
 'Utility and Power Line Safety — Crane clearances, spotter requirements, 10-ft rule for overhead power. 17 attendees.',
 'completed','2026-05-04 07:00:00-04','2026-05-04 08:00:00-04'),

-- IRONBRIDGE toolbox talks
('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000002',
 'b1000003-0000-4000-8000-000000000003',
 '2025-12-03 07:00:00-05',
 'Lockout/Tagout Refresher — Group LOTO, energy verification, re-energization sequence. 14 attendees. Triggered by conveyor LOTO incident.',
 'completed','2025-12-03 07:00:00-05','2025-12-03 08:00:00-05'),

('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000002',
 'b1000003-0000-4000-8000-000000000003',
 '2026-01-07 07:00:00-05',
 'Confined Space Entry — Permit requirements, atmosphere testing, attendant duties, rescue plan. 16 attendees. High priority after December near miss.',
 'completed','2026-01-07 07:00:00-05','2026-01-07 08:00:00-05'),

('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000001',
 'b1000003-0000-4000-8000-000000000003',
 '2026-02-04 07:00:00-05',
 'Rigging and Crane Safety — Sling inspections, load charts, pre-lift checklist, signal person requirements. 12 attendees.',
 'completed','2026-02-04 07:00:00-05','2026-02-04 08:00:00-05'),

('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000002',
 'b1000003-0000-4000-8000-000000000003',
 '2026-03-04 07:00:00-05',
 'Chemical Handling Safety — SDS review, secondary containment, PPE for acid handling, emergency response. 18 attendees.',
 'completed','2026-03-04 07:00:00-05','2026-03-04 08:00:00-05'),

('a0000003-0000-4000-8000-000000000003','c0000003-0000-4000-8000-000000000003',
 'b1000003-0000-4000-8000-000000000003',
 '2026-04-07 07:00:00-05',
 'Grinder and Power Tool Safety — Guard requirements, disc inspections, PPE selection, kickback prevention. 10 attendees. Response to grinder disc shatter incident.',
 'completed','2026-04-07 07:00:00-05','2026-04-07 08:00:00-05'),

('a0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000002',
 'b1000003-0000-4000-8000-000000000003',
 '2026-05-06 07:00:00-04',
 'Heat Illness and Permit-Required Work in Summer — Hydration, work-rest schedules, buddy system for confined space in heat. 20 attendees.',
 'completed','2026-05-06 07:00:00-04','2026-05-06 08:00:00-04');
