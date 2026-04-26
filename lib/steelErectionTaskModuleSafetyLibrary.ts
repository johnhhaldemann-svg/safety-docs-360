/**
 * Full safety-plan content for steel erection CSEP task modules. Merged in assemble with
 * reference-pack extracts so every module meets minimum depth even when metadata or DOCX
 * excerpts are short.
 */

export type SteelTaskModuleSafetyPlanPack = {
  safetyExposure: readonly string[];
  requiredSafetyControls: readonly string[];
  accessRestrictions: readonly string[];
  requiredPpe: readonly string[];
  permitsHoldPoints: readonly string[];
  stopWorkTriggers: readonly string[];
  verificationHandoff: readonly string[];
};

/** Minimum substantive lines per safety subsection after merge (assemble enforces). */
export const STEEL_TASK_MODULE_SUBSECTION_MIN_LINES = 4;

const GENERIC_STEEL_TASK_PACK: SteelTaskModuleSafetyPlanPack = {
  safetyExposure: [
    "Workers may be exposed to suspended loads, line-of-fire contact with moving steel, falls from incomplete walking surfaces, struck-by from tools or materials, and changing sequence conditions that erode established controls.",
    "Interfaces with other trades, equipment traffic, and incomplete barricades can widen the exposure footprint without a fresh hazard briefing.",
    "Hearing, visibility, and thermal stress can compound recognition of movement hazards during crane picks and ground-clearing activity.",
    "Structural instability or unverified anchor conditions may be inherited if work begins before written notifications and field verification are complete.",
  ],
  requiredSafetyControls: [
    "Assign a competent person for the shift, document the pre-task plan, and verify hoisting, access, fall protection, and emergency communications before exposing crews.",
    "Maintain barricades, swing-radius controls, spotters where required, and exclusion under suspended loads at all times during active picks.",
    "Use engineering documents and approved sequences for bolting, bracing, and decking; do not substitute field judgment for missing approvals.",
    "Keep housekeeping, tag lines, rigging inspections, and two-way radio discipline aligned with the site lift plan and Subpart R coordination requirements.",
  ],
  accessRestrictions: [
    "Limit access to the laydown, pick path, and connection zones to essential personnel; redirect visitors and deliveries outside the controlled boundary.",
    "Keep ladders, MEWPs, and climbing access inside approved routes; do not create ad hoc access through active rigging or deck bundles.",
    "Protect leading edges, openings, and incomplete stairs before authorizing follow-on crews to cross or work above/below the line.",
    "Maintain clear headcount and accountability for personnel inside multi-trade areas during simultaneous operations.",
  ],
  requiredPpe: [
    "Hard hat, safety glasses, high-visibility apparel, and cut-resistant gloves appropriate to sharp edges and rigging activity.",
    "ANSI-rated safety footwear with slip resistance suited to mud, cutoffs, and deck surface conditions.",
    "Fall-arrest or fall-restraint systems with inspected harness, lanyard, and anchorage whenever working in fall hazard zones identified by the JHA.",
    "Hearing protection where crane picks, deck installation, or grinding generate sustained elevated noise; upgrade to faceshields or welding PPE when those tasks begin.",
  ],
  permitsHoldPoints: [
    "Confirm crane certificates, operator qualifications, and lift/pick plans for the picks in scope; hold picks until documented critical-lift approvals are valid when triggered.",
    "Verify concrete strength notifications, anchor-rod repair notices, and GC/CM release criteria before setting major members.",
    "Apply hot-work, confined space, or electrical permits only when those triggers exist for the actual task that day.",
    "Use deck-controlled zones, leading-edge releases, or engineered drawings as named hold points per the site steel erection plan.",
  ],
  stopWorkTriggers: [
    "Stop work if rigging is damaged, tags are missing, or the load drifts from the approved path; restart only after qualified rigging inspection and signal-person readiness.",
    "Stop work if weather, visibility, or ground conditions exceed plan limits, or if any part of the frame is out of plumb/tolerance without an approved correction plan.",
    "Stop work if workers enter fall zones or under suspended loads, or if barricades and warning lines are removed without replacement.",
    "Stop work if permits expire, crane alarms/indicators malfunction, or emergency communications cannot be completed end-to-end.",
  ],
  verificationHandoff: [
    "Document inspections, pick logs, torque or welding maps when applicable, and corrective actions; the competent person signs that the work face matches the approved condition.",
    "Record communications to trades below and beside the pick zone, including time of release and any residual restrictions.",
    "Handoff packages bundle lock-out status of utilities, open penetrations, and temporary bracing so the receiving crew inherits known exposures.",
    "Final walk verification confirms housekeeping, secured materials, and controlled openings before daily authorization ends.",
  ],
};

export const STEEL_TASK_MODULE_SAFETY_LIBRARY: Record<string, SteelTaskModuleSafetyPlanPack> = {
  steel_pre_erection_planning_and_site_readiness: {
    safetyExposure: [
      "Premature lifting or loading before concrete and anchor notifications are satisfied can overload bases, rods, or partially cured supports.",
      "Congested laydown, unclear crane staging, and weak perimeter security increase struck-by and caught-between risk for survey, trucking, and ironworkers.",
      "Overhead and buried utilities that are not field-verified create shock, arc, strike, or excavation release exposures during mat placement and early picks.",
      "Poorly sequenced deliveries and incomplete access roads can destabilize cranes, trailers, and walking routes before the first engineered pick.",
    ],
    requiredSafetyControls: [
      "Verify written concrete strength and anchor-rod status per controlling-contractor notifications before mobilizing picks onto those supports.",
      "Define crane locations, outrigger mats, swing limits, exclusion zones, and laydown order on drawings or written lift plans reviewed with the crew.",
      "Confirm weather triggers, manning levels, and rescue/fall plans for early leading-edge exposures before authorizing access to elevated sequencing reviews.",
      "Stage barricades, signage, and traffic control for deliveries so pedestrian and equipment routes cannot drift into active work paths.",
    ],
    accessRestrictions: [
      "Restrict climbing or walking on incomplete deck, column lines, or unsecured bundles to personnel performing verification with approved fall protection.",
      "Separate truck queuing, crane swing, and pedestrian briefing areas; escort visitors and drivers who must enter the pre-erection zone.",
      "Keep evacuation and emergency routes open; do not block hydrants, shoring, or muster points with laydown staging.",
      "Control temporary stairs and ladders used for layout checks so they cannot project into potential lift zones.",
    ],
    requiredPpe: [
      "Baseline construction PPE plus task-specific vests for crane spotters and traffic controllers when deliveries cross live routes.",
      "Fall protection systems appropriate for layout or preview work at edges, decks under construction, or near unguarded openings.",
      "Foot protection suitable for rebar, mud, and mat transitions; gloves when handling strapping, templates, and sharp edge survey stakes.",
      "Eye and face protection when reviewing grinding, burning, or drilling conducted by others in the vicinity of planning walkdowns.",
    ],
    permitsHoldPoints: [
      "Written notifications for concrete strength, anchor rods, repairs, and engineered temporary supports are mandatory hold points per Subpart R prior to loading.",
      "Site-specific traffic, right-of-way, and utility mark-out requirements may gate deliveries and crane assembly; confirm before cutting or moving mats.",
      "Environmental or owner security approvals may apply when work occurs near occupied spaces or sensitive operations.",
      "Hold startup if the baseline competence roster (operators, riggers, connectors, signal persons) does not match the shift plan.",
    ],
    stopWorkTriggers: [
      "Stop if notification packages are absent, contradictory, or expired relative to the members that will receive load in the first picks.",
      "Stop if access roads, mat capacity, underground structures, or overhead lines cannot be confirmed for current gross loads and crane configuration.",
      "Stop if weather or communications changes invalidate the documented pick sequence or drop-zone discipline.",
      "Stop if deliveries, spectators, or trades enter undocumented routes through the planned crane swing or laydown footprint.",
    ],
    verificationHandoff: [
      "Archive written notifications, crane mat placement photos, and utility mark-out tickets with the daily pre-erection checklist.",
      "Transmit laydown sequencing updates, weight summaries, and restricted-route maps to trucking and ironworker foremen before first pick.",
      "Confirm that survey control points, anchor templates, and brace staging inventory match the issued-for-construction package revision.",
      "Sign off that emergency muster routes, hydration stations, and radio channel assignments are verified for the mobilization footprint.",
    ],
  },

  steel_receiving_unloading_inspecting_and_staging: {
    safetyExposure: [
      "Suspended loads over personnel and rigging attachment mistakes during offload remain the primary life-safety exposures.",
      "Shifting dunnage, unstable stacks, and improvised shims create crush and roll exposures for taggers and inspectors walking bundles.",
      "Sharp edges, banding, and coating flakes drive cut, puncture, and respiratory irritation risks during shakeout.",
      "Traffic from haul trucks and forklifts around blind corners elevates struck-by risk for spotters and ironworkers simultaneously.",
    ],
    requiredSafetyControls: [
      "Use qualified riggers and documented rigging components for every lift; reject frayed straps, altered shackles, and mismatched WLL tags.",
      "Maintain dedicated landing zones, tag lines, controlled approach angles, and two-way radio discipline for every pick off the truck.",
      "Stack and chock in erection order with engineered or manufacturer limits for height, tier width, and slope; band distressed members out of service.",
      "Inspect for shipping damage, camber mismatch, and connection interference before members enter the active setting path.",
    ],
    accessRestrictions: [
      "Keep non-essential personnel outside the offloading arc, cribbing area, and forklift interchange lines during all phases of the unload.",
      "Limit walking between nested bundles; use approved openings and maintain aisles at least as wide as the site traffic plan requires.",
      "Separate pedestrian inspection routes from crane swing and from mobile equipment reversing paths.",
      "Close or barricade laydown areas after hours to prevent unauthorized reconfiguration of cribbing.",
    ],
    requiredPpe: [
      "Helmet-mounted brim or full-brim hard hats when working under stacked bundles or lift slings overhead.",
      "Cut-resistant gloves, metatarsal guards when required by site rules for heavy plate moves, and high-cut snagging-resistant outerwear.",
      "High-visibility apparel for spotters, drivers, and unloading personnel in intersecting traffic paths.",
      "Hearing protection in laydown yards with simultaneous crane picks and truck idle.",
    ],
    permitsHoldPoints: [
      "Crane/lift permits, critical pick plans, and road-occupancy approvals must cover gross offload weights and radius shown on the ticket.",
      "Inspection holds for damaged or rejected members must be communicated to material control before those pieces enter sequencing.",
      "Owner or railroad approvals may gate certain delivery routes; verify before rerouting heavy loads.",
      "Oversize permits and flagging requirements attach to specific haul corridors; mirror them in the laydown map.",
    ],
    stopWorkTriggers: [
      "Stop if the load chart, rigging scheme, or spotter roster does not match the member being picked or if anyone is under the load.",
      "Stop if cribbing sinks, packages lean, or wind/ground conditions invalidate the mat or stacking plan.",
      "Stop if communications are lost between crane operator, rigger, and truck driver during any phase of the set.",
      "Stop if traffic control fails or pedestrian breaches occur inside the unloading control line.",
    ],
    verificationHandoff: [
      "Document offload times, damage tags, crane and rigging inspections, and any member quarantines; release laydown only after the competent person acknowledges stack stability.",
      "Transmit laydown maps, weight summaries, and damaged-member lists to field engineering and connectors prior to picks moving steel to the column line.",
      "Sign off housekeeping, banding removal, and housekeeping lanes before opening adjacent trades into the laydown apron.",
      "Keep retained samples or photos of damage consistent with carrier claims instructions when cargo release is disputed.",
    ],
  },

  steel_setting_columns_and_base_lines: {
    safetyExposure: [
      "Column picks place workers near suspended loads, high binding compression, and moving tails during rotation.",
      "Workers aligning bases encounter pinch at anchor rods, shear on wedge packs, and falls at slab edges while plumbing.",
      "Early removal of temporary guys or premature loading of lines before final torque can destabilize the bay.",
      "Dropped tools and small hardware from elevation threaten crews on lower decks during plumbing activities.",
    ],
    requiredSafetyControls: [
      "Follow documented pick points, orientation marks, and connection sequence; double-check anchor engagement before releasing the crane hook from primary support.",
      "Install temporary bracing, guy cables, or tierods per detail before removing erection tackle that restrains drift.",
      "Use controlled tag line angles and prevent hands-on guided landings that place bodies inside pinch cylinders.",
      "Coordinate parallel welders or bolting crews so simultaneous heat or hammer blows cannot spring the member off seating.",
    ],
    accessRestrictions: [
      "Keep the column line inside an established swing boundary until plumbing is complete and braced; exclude other trades from inside the radius.",
      "Prevent walking across unsecured deck openings created for column pass-throughs.",
      "Restrict access below the column while it is suspended; maintain spotters for blind lifts.",
      "Limit simultaneous crane activity overhead unless the lift director approves temporal separation.",
    ],
    requiredPpe: [
      "Full-body harness and shock-absorbing lanyards or positioning where connectors are exposed to fall hazards without guardrails.",
      "Face shields when swinging leads or performing hammer alignment, if site assessment requires.",
      "Metatarsal protection on feet when landing heavy bases; cut-resistant gloves for hardware and template work.",
      "Climbing helmets with chin straps where bump hazards from rotating steel exist.",
    ],
    permitsHoldPoints: [
      "Column release often ties to anchor notification, base-grout readiness, and survey sign-off; hold setting until each gate clears.",
      "Welding or torque procedures that affect temporary stability may require engineer review as a hold.",
      "Night lighting plan approval may apply when columns are set in low visibility.",
      "Two-crane picks require dual-crane lift documentation before hooks engage.",
    ],
    stopWorkTriggers: [
      "Stop if anchors do not align, threads are damaged, or nuts cannot be started without cross-threading force.",
      "Stop if wind or binding causes uncontrollable swing, or if radios fail mid-hold.",
      "Stop if temporary bracing or shims loosen during set or if soil under shims crushes.",
      "Stop if unauthorized personnel enter beneath the suspended column or inside the controlled decking boundary below.",
    ],
    verificationHandoff: [
      "Document as-built plumb, torque map completions, and brace installation photos before releasing connectors to beam progression.",
      "Transmit anchor tension, grout slot condition, and any field rework to the survey and concrete trades.",
      "Verify housekeeping of bolts, pins, and scrap from the column line prior to deck crews entering.",
      "Record crane release conditions (environmental limits) for the next pick in sequence.",
    ],
  },

  steel_erecting_beams_and_girders_initial_connections: {
    safetyExposure: [
      "Suspended beams share pinch points with seat connections, drifting drift pins, and unpredicted rotation if center-of-gravity is misunderstood.",
      "Connectors working leading edges while aligning bolt holes remain in fall exposure until decking closes the bay.",
      "Multiple workers on the same member during initial drift pin insertion increase struck-by risk from hammers and wrenches.",
      "Deck and joist sequencing gaps can expose connectors to unprotected openings below foot placement.",
    ],
    requiredSafetyControls: [
      "Install initial drift pins and release bolts per detail before releasing primary rigging unless engineered alternative sequences are approved.",
      "Maintain sequential bolting patterns and partial joint packs to preserve frame stability as beams are landed.",
      "Use engineered falsework, bull pins, or tag line tethers so connectors are never under the hook load path.",
      "Protect below with barricades or netting when work fronts overlap occupied lower levels.",
    ],
    accessRestrictions: [
      "Control ladder or float access so connectors cannot bypass controlled decking lines to reach seats early.",
      "Keep deck bundles and welding leads off connector walk paths until the truss or beam line is landed and restrained.",
      "Restrict concurrent crane picks over an active connection crew unless a dedicated lift director sequences time slots.",
      "Prevent material hoists from entering the same bay as active ironwork without positive lockout of motion.",
    ],
    requiredPpe: [
      "Connector-specific fall protection per site connector policy; inspect dorsal D-rings and connector belts daily.",
      "Eye protection rated for impacts from drifting pins; gloves that still allow tactile bolt alignment.",
      "Heat-resistant sleeves when working adjacent to tack welds cooling on the same joint.",
      "Respiratory baseline per fume monitoring when oxy-cut preps occur at the seat edge before landing the next piece.",
    ],
    permitsHoldPoints: [
      "Controlled decking zone authorizations may gate removal of temporary cables or horizontal lifelines at leading edges.",
      "Engineering notifications for temporary connections, shims, or modified holes are hold points before full bolting torque.",
      "Hot-work permits if tack welding is used during initial connection stabilization.",
      "Owner inspection hold for architecturally exposed steel may block paint or fireproofing follow-on until signed.",
    ],
    stopWorkTriggers: [
      "Stop if drift pins walk out, bolts cannot be started square, or seats visibly deform during landing.",
      "Stop if connectors report fall protection anchorage movement or if deck openings appear unmarked underfoot.",
      "Stop if crane operator loses line of sight or if wind causes uncontrollable rotation of long-radius picks.",
      "Stop if simultaneous welding and hoisting create smoke or glare blocking critical signals.",
    ],
    verificationHandoff: [
      "Bolt map or check-off list with torque or snug-tight status, plus marked exceptions for field holes needing rework.",
      "Record temporary bracing removal authorizations tied to adjacent bay stability calculations.",
      "Communicate remaining pinch hazards and projection schedules to decking and MEP trades before access release.",
      "Photo-log leading-edge protection restoration after connector crew vacates the bay.",
    ],
  },

  steel_hoisting_and_rigging_multiple_lift: {
    safetyExposure: [
      "Standard single-member picks expose workers under swing, at landing pinch, and along tag-line routes.",
      "Multiple-lift procedures add exposure from unequal center of gravity, dynamic load sharing, and simultaneous disconnection risks.",
      "Rigging failure, miscalculation of sling angles, or degraded hardware may cause sudden load transfer or shock loading.",
      "Miscommunication of voice or hand signals elevates potential for unintended crane motion during critical inches of travel.",
    ],
    requiredSafetyControls: [
      "Apply qualified rigger designation for every configuration; document calculated sling angles, capacities, and D/d ratios before the first movement.",
      "Use a dedicated lift director for complex picks; rehearse emergency lowering paths and stop signals with operators and signal persons.",
      "For multiple-member picks, verify engineered procedures, de-rate factors, and tag line staffing before lifting more than one element unless explicitly permitted by code and plan.",
      "Inspect hooks, latches, sheaves, and anti-two-block devices at shift start; replace any questionable hardware before picks resume.",
    ],
    accessRestrictions: [
      "Clearly barricade swing circle, lay-down transition, and pin release zones; no personnel under bridles or spreader bars.",
      "Limit walkway crossings of the load path to scheduled windows with radio clearance.",
      "Prevent vehicles from parking inside crane radius charts without spotter-controlled entry.",
      "Control crane walkway access so lubrication or maintenance cannot occur during active picks unless power is isolated and tagged.",
    ],
    requiredPpe: [
      "Signal persons wear identifiable gloves and vests; riggers wear cut-resistant gloves rated for wire rope handling.",
      "Hearing protection when multiple cranes operate or when exposure exceeds baseline monitoring results.",
      "Impact-resistant head protection with integrated eye protection for personnel assisting landing near steel edges.",
      "Leather or welding-grade protection only when brief thermal exposure occurs during rigging near hot members.",
    ],
    permitsHoldPoints: [
      "Lift/pick plans, critical lift approvals, and multi-crane lift checks are mandatory hold points matched to radius and gross load.",
      "Street/ROW and railroad flagging attach when part of the swing path crosses regulated boundaries.",
      "Owner holds may apply when picks traverse occupied facilities or sensitive equipment.",
      "Restart after near-miss or stop requires documented competent-person and lift-director concurrence.",
    ],
    stopWorkTriggers: [
      "Stop if rigging hardware grades mismatch the chart, or if tag lines or rigging tails become fouled.",
      "Stop if wind or out-of-level crane indicators exceed plan thresholds or if ground settlement is observed near outriggers.",
      "Stop immediately when any worker is under load, when latch malfunction is suspected, or when anti-two-block triggers.",
      "Stop multiple-lift if any member rotates unexpectedly or separation distances between pieces cannot be maintained per procedure.",
    ],
    verificationHandoff: [
      "Rigging inspection log, lift director sign-off, and crane worksheet copies archived with time-stamped pick completion.",
      "Communicate residual rigging inventory placement that might affect next trades (e.g., slings staged at columns).",
      "Record weather snapshots when near operational limits for audit trail continuity.",
      "Confirm that barricades and warning lines are re-established after moving swing-limit stakes.",
    ],
  },

  steel_installing_open_web_steel_joists_and_bridging: {
    safetyExposure: [
      "Instability during initial joist placement and bridging sequence creates roll-over exposure and line-of-fire from sliding chord seats.",
      "Workers installing bridging across unguarded bays face falls and seesaw effects when mid-span anchors are incomplete.",
      "Bundle banding snap-back and toppling bundles threaten feet and shins near laydown.",
      "Instability during erection when bridging rows called out on drawings are skipped to accelerate decking.",
    ],
    requiredSafetyControls: [
      "Follow manufacturer and erector-specific bridging diagrams; never delete intermediate lateral restraint to accelerate decking.",
      "Use mechanical picks sized for combined weight and center of gravity; avoid free-standing joists without minimum bridging rows installed.",
      "Capture both chords when stabilizing with cables; verify seat bearing length and weldable tags before releasing hook.",
      "Coordinate crane rate-of-travel with connectors to avoid oscillation resonance.",
    ],
    accessRestrictions: [
      "Exclude personnel from the bay below until bridging rows designated for that stage are installed or alternate fall protection is engineered.",
      "Maintain controlled access on plank walkways; prohibit shortcuts across unguarded joist tops except via lifeline systems where permitted.",
      "Keep material bundles outside the crane swing when bridging workers occupy the line.",
      "Limit concurrent torch cutting or grinding above until bridging stabilizes the line.",
    ],
    requiredPpe: [
      "Connectors maintain integral 100% fall protection unless on an approved CDZ with extra controls per site program.",
      "Gloves with abrasion resistance for sharp joist corners; metatarsal guards when toe-kicking joists into seats.",
      "Face shields when removing bands at elevation to protect from spring energy.",
      "Respiratory protection when galv fumes are present during welding at seat connections.",
    ],
    permitsHoldPoints: [
      "Controlled decking zone release and connector rescue plans are frequent hold points for joist-dominated scopes.",
      "Manufacturer variance or substitution triggers engineered review before altering bridging count.",
      "Hot-work permits for seat welding or field repair touchpoints.",
      "Night-shift lighting assessment before placing first joist.",
    ],
    stopWorkTriggers: [
      "Stop if joists roll or shift prior to securing first mechanical fasteners at both ends per plan.",
      "Stop if weather or wind introduces visible lateral sway before additional bridging is complete.",
      "Stop if improvised attachments replace missing bridging clips; engineered substitutions only.",
      "Stop if tag lines become entangled in bridging struts or deck bundles below.",
    ],
    verificationHandoff: [
      "Bridging installation checklist signed by competent person; photo evidence of clip engagement patterns where QA requires.",
      "Communicate remaining temporary restraint removal windows to decking crews.",
      "Record any variances between shipped camber versus field measurement for engineer awareness.",
      "Housekeeping confirmation that banding, wedges, and loose hardware are secured or removed.",
    ],
  },

  steel_installing_metal_decking_and_controlling_openings: {
    safetyExposure: [
      "Installing metal decking creates leading-edge and sheet-slide exposures, especially during bundle spreads and initial fastening cycles.",
      "Controlling floor and roof openings demands continuous guarding; premature removal of covers invites falls through.",
      "Shear studs and tripping on weld slag add puncture and slip exposures on partially decked bays.",
      "Wind lift on unsecured sheets can push workers toward edges or snag lifelines.",
    ],
    requiredSafetyControls: [
      "Install deck in bundles only per engineered edge-protection scheme; secure each sheet or bundle immediately per fastening patterns.",
      "Use pre-cut opening covers, guardrail kits, or engineered nets before creating new penetrations during layout.",
      "Sequence welding or button punching so workers are never downslope of unsecured leading edges without alternate fall protection.",
      "Label controlled decking zones, maximum uncovered widths, and access-only stairs at each deck elevation.",
    ],
    accessRestrictions: [
      "Restrict access across partially decked bays to crew installing that zone; separate material flights from worker access stairs.",
      "Maintain clear rescue pathways for connectors and welders; avoid parking bundles on stair landings.",
      "Prevent MEP rough-in from opening holes without coordinated cover replacement same shift.",
      "Escort inspections along planks tied to structural members only after those members appear on walk-path approval.",
    ],
    requiredPpe: [
      "100% fall protection or approved CDZ program elements including designated connectors where applicable.",
      "Puncture-resistant footwear on stud-rich surfaces; leather sleeves when performing burn-through inspections.",
      "Welding PPE layered appropriately when seam or button welding progresses behind decking crews.",
      "Eye protection resistant to grinding sparks when dressing sheet edges.",
    ],
    permitsHoldPoints: [
      "Controlled decking zone authorization and release documentation per Subpart R site policy.",
      "Hot-work or fire-watch triggers if cutting or welding openings through deck or attachments.",
      "Engineering holds for staggered panel layout that affects diaphragm nailing or shear transfer.",
      "Owner holds for noise or dust affecting occupied floors below.",
    ],
    stopWorkTriggers: [
      "Stop if sheets billow, fasteners are missing on two or more consecutive corrugations along an edge line, or wind speed exceeds plan.",
      "Stop if covers are removed without immediate replacement or if warning lines are out of tension.",
      "Stop if workers cannot maintain positive connection to anchorage while spreading bundles.",
      "Stop if deck welding quality issues require grinding that destroys edge warning paint until lines are repainted.",
    ],
    verificationHandoff: [
      "Deck completion logs noting shear-tab weld map, fastener type counts, and field modification sketches.",
      "Opening inventory with photo closure for each cover, including who removed and who replaced.",
      "Record of restored perimeter cables or guardrails before turning bays over to concrete pour or MEP.",
      "Handoff to safety for updated roof access maps if edge protection style changed mid-building.",
    ],
  },

  steel_plumbing_temporary_bracing_and_final_bolting: {
    safetyExposure: [
      "Adjusting brace tension while partially loaded frames may elastically release and strike workers in rebound corridors.",
      "Final bolting can require leaning past protected lines to reach connections at hips and skewbacks.",
      "Hydraulic jacks and come-alongs can fail explosively if overrated or side-loaded during alignment pushes.",
      "Removing temporary kicker braces before final torque maps are satisfied risks progressive collapse of a tier.",
    ],
    requiredSafetyControls: [
      "Follow engineered sequence maps for installing, adjusting, and removing temporary bracing; require sign-off before removal lists.",
      "Use engineered falsework or threaded rods for incremental pulls; prohibit random clip angles that overload seats.",
      "Torque or tension-control procedures per ASTM F3125 class and project QA sampling plan.",
      "Tag each brace with intended removal stage and responsible foreman so partial removals are auditable.",
    ],
    accessRestrictions: [
      "Exclude trades from bays beneath active re-leveling unless overhead protection or shift timing isolates exposures.",
      "Limit simultaneous crane activity above realignment zones.",
      "Provide stable working platforms; do not use stacked deck bundles as work benches for torque guns.",
      "Prevent compressed-air hoses from crossing emergency egress when using impact wrenches along lines.",
    ],
    requiredPpe: [
      "Impact gloves and anti-vibration wraps when using high-torque guns for extended cycles.",
      "Hearing protection rated for impulse noise from pneumatic tools.",
      "Face shields when spring-loaded shim packs could eject during drift correction.",
      "Full fall protection when leaning outside vertical lifelines created before final CDZ release.",
    ],
    permitsHoldPoints: [
      "Engineering hold for any substitute bolt classes, washer omission, or reuse of previously tensioned bolts where prohibited.",
      "Heat and weather holds that change friction coefficients must be logged before final passes.",
      "Owner inspection for architecturally critical alignment tolerances.",
      "Night work permits and lighting verification for precision optics alignment jobs.",
    ],
    stopWorkTriggers: [
      "Stop if drift adjustments exceed tolerance twice without engineered remediation.",
      "Stop if hydraulic lines leak, jacks creep, or pressure relief valves chirp continuously.",
      "Stop if audible pops or visible movement occurs in adjacent untreated members during pull operations.",
      "Stop if workers cannot maintain three points of contact during the alignment maneuver without violating fall rules.",
    ],
    verificationHandoff: [
      "Torque or DT log bundles with bolt map overlays and weather notes for each pass.",
      "Brace removal log cross-referenced to engineer-approved sequence step numbers.",
      "Survey sign-off comparison to as-built grid before decking follow-on loads increase.",
      "Issue formal stability release memos to crane and deck crews when a tier attains full permanent connection state.",
    ],
  },

  steel_field_welding_cutting_and_shear_connectors: {
    safetyExposure: [
      "Ignition sources from welding and cutting introduce fire, explosion, and smoke travel into occupied lower floors.",
      "Slag fall and metal drop create thermal burn and strike injuries to personnel under or adjacent to the joint.",
      "Electric shock or arc flash can occur from damaged leads, wet gloves, or improper grounding paths on coated steel.",
      "Pinched cables across sharp deck edges create intermittent arcing that may not trip upstream protection instantly.",
    ],
    requiredSafetyControls: [
      "Fire watch duration and extinguisher counts per hot-work permit; extend watches if smoldering insulation is plausible.",
      "Barricade vertical drop zones when cutting or gouging above active lower levels; use fire blankets or shields horizontally.",
      "Ground-return design ensures current path does not flow through worker touch points or crane hook bearings.",
      "Housekeeping cadence for slag, stubs, and rods to prevent deck punctures and trip hazards.",
    ],
    accessRestrictions: [
      "Limit access under the joint until slag cool-down interval is complete and inspection confirms no cherry-red areas.",
      "Segregate oxygen/fuel cylinder storage from ignition sources and keep carts off traveled crane paths.",
      "Keep non-welders outside the arc flash boundary posted for each process unless shielded.",
      "Route leads overhead or along protected edges so they cannot be run over by deck carts.",
    ],
    requiredPpe: [
      "FR clothing layer appropriate to calculated incident energy whenever open-root or high-amperage procedures apply.",
      "Face shields with correct shade numbers plus side shields; leather capes when vertical welding overhead.",
      "Respiratory protection per exposure assessment for zinc-rich primers, galvanizing, or smoke accumulation.",
      "Insulated lineman gloves when intentional or incidental energized equipment proximity exists per LOTO interface.",
    ],
    permitsHoldPoints: [
      "Hot-work permit with designated fire watch roster and extension rules after breaks.",
      "Confined-space or permit-required space rules when welding inside boxed members or tight penetrations.",
      "Smoke or odor intrusion holds for occupied hospital, lab, or food production adjacencies.",
      "Structural deformation monitoring holds when thermal input is restricted due to camber recovery windows.",
    ],
    stopWorkTriggers: [
      "Stop if extinguishers are missing, fire watch leaves station, or wind shifts blow sparks toward unprotected combustibles.",
      "Stop if leads show exposed copper, ground clamp is loose, or GFCIs trip repeatedly.",
      "Stop if fumes exceed monitoring thresholds or ventilation failure is reported.",
      "Stop if deck coatings bubble indicating trapped volatiles at risk of flash.",
    ],
    verificationHandoff: [
      "Hot-work tag closure with time-out visual inspection signatures and thermal imaging optional spot checks.",
      "NDT map handoff if UT/MT follow shear studs welded same shift.",
      "Notify housekeeping and paints of residual flux corrosivity zones before moisture introduction.",
      "Record any cracked welds or rejected VT findings into rework tracker before releasing decking access underneath.",
    ],
  },

  steel_embeds_setting_and_verification: {
    safetyExposure: [
      "Working at slab edges and deck openings while aligning plates or sleeves creates leading-edge fall exposure.",
      "Heavy embeds handled manually or with come-alongs can pinch feet or crush fingers against forms or steel.",
      "Burning or drilling to adjust embeds can ignite form oil, spray foam, or debris in edge forms.",
      "Electrical shock when verifying conduits tied to embedded junction boxes before full LOTO verification.",
    ],
    requiredSafetyControls: [
      "Engineered pick points or small hoist paragraphs when embed mass exceeds two-person manual lift threshold established by site ergonomics program.",
      "Template alignment checks so embed verticality does not rely on body weighting or pry leverage beyond neutral balance.",
      "Shield combustibles whenever grinding or burning within 35 feet horizontally of class A plastic sheathing unless permit upgrades control exist.",
      "Verify LOTO boundaries before touching sleeved conduits labeled as potentially energized.",
    ],
    accessRestrictions: [
      "Coordinate with rebar so ironworkers do not stand inside crane-pick cones for mat picks occurring above embed bay.",
      "Install temporary guardrails or warning lines at every opening created for embed inspection windows.",
      "Keep flight paths clear for survey drones only if aviation plan exists; otherwise restrict overhead drones over open edges concurrently with embed work.",
      "Separate embed crews working above from concrete pour headers below with signed time window.",
    ],
    requiredPpe: [
      "Fall protection anytime the worker cannot maintain continuous inside-the-rail contact during lean-out verification.",
      "Cut-resistant and impact gloves when handling threaded assemblies; eye protection whenever spring pins are driven.",
      "Dust masks if silica-generating drilling occurs without LEV at deck level.",
      "Voltage-rated gloves only when justified by qualified electrical worker assessment.",
    ],
    permitsHoldPoints: [
      "Concrete pre-pour embed inspection sign-offs; hot-work when adjusting with torch.",
      "Owner architect hold for exposed architectural embed finish exposure limits.",
      "Radiography hold windows if RT is specified adjacent to active flame cutting.",
      "Crane spotter holds when pick paths cross embed layout lines.",
    ],
    stopWorkTriggers: [
      "Stop if embed movement jams in formwork indicating potential form blow risk when pour pressure applies.",
      "Stop if edge protection is removed to reach an embed without engineered alternate.",
      "Stop if storm lightning approaches defined radius across open steel deck.",
      "Stop if drone or helicopter operation unpredictably lowers visibility on edge verification.",
    ],
    verificationHandoff: [
      "Embed checklist with GPS or grid photos, torque or weld map references, and sign-off by competent layout person.",
      "RFI log for clashes forwarded to concrete pour coordinator same day.",
      "Restore debris control and padding before turning the deck bay to fireproofing.",
      "Stamp date on embed paint witness marks so future trades understand verification age.",
    ],
  },

  steel_punch_list_and_closeout_remediation: {
    safetyExposure: [
      "Return trips often mix incomplete guardrails, removed nets, and altered access ladders—reopening fall exposure.",
      "Small welding or grinding on occupied lower floors can reintroduce fire or fume paths through penetrations.",
      "Isolated crane picks to replace members may occur with tighter site constraints than original erection.",
      "Loose hardware left from torque checks can fall when vibration resumes from adjacent trades.",
    ],
    requiredSafetyControls: [
      "Re-baseline JHA for each punch cluster; verify that fall protection has been re-established to current building occupancy rules.",
      "Re-inspect rigging and operator cards before one-off picks; mini-picks still follow full Subpart CC discipline scaled to load.",
      "Control housekeeping each shift; tag and bag removed fasteners instead of loose buckets at parapet.",
      "Coordinate with GC for building smoke and HVAC modes before reopening penetrations.",
    ],
    accessRestrictions: [
      "Use controlled roof hatches or interior hoists when exterior swing is no longer available; prohibit improvised rope pulls over parapet guards.",
      "Escort owner personnel; do not allow unchecked cell-phone photography drones around open edges.",
      "Separate public tours from work fronts or time-shift punch activity.",
      "Verify elevator or lift max capacity tags before using them to shuttle small steel sections.",
    ],
    requiredPpe: [
      "Reissue site orientation PPE updates when punch work moves inside finished spaces requiring boot covers or FR daily wear.",
      "Tyvek or suits when working above clean rooms subject to owner rules.",
      "Respirators if abrading intumescent fireproofing patches.",
      "Standard connector heights kit if any brief connector-level exposure returns.",
    ],
    permitsHoldPoints: [
      "Owner after-hours hot-work permits when punch welding must occur while building partially occupied.",
      "Structural engineer sign-off if replacing members affects diaphragm continuity.",
      "Façade access equipment annual inspections before boom lifts return to curtain wall plane.",
      "Insurance notification for extended crane on-site stay.",
    ],
    stopWorkTriggers: [
      "Stop if anchor tenant operations below cannot be notified within required lead time before drop hazard resumes.",
      "Stop if weather sealing or window proximity invalidates slag control assumptions.",
      "Stop if discovered corrosion pack rust suggests original material never met spec — escalate before patching.",
      "Stop if cell modem outages prevent lone-worker check-ins when site policy mandates them.",
    ],
    verificationHandoff: [
      "Punch log closure matrix with photo evidence, NDT reopen results if any, and updated as-built drawing revision numbers.",
      "Final housekeeping walk with owner rep signature acknowledging debris-free condition.",
      "Return borrowed temporary power permits and crane path staking to survey control baseline.",
      "Archive lessons learned for lifecycle program database per corporate quality policy if applicable.",
    ],
  },

  steel_touch_up_painting_on_structural_steel: {
    safetyExposure: [
      "Solvent vapors and overspray may accumulate near HVAC intakes or scissor lifts staged inside atrium voids.",
      "Manual reach from ladders or short stilts to touch field welds or row ends introduces fall and overreach exposure.",
      "Rags soaked in thinners create spontaneous combustion if discarded in ordinary trash.",
      "Skin sensitization from isocyanate or epoxy touch kits without proper barrier creams or gloves.",
    ],
    requiredSafetyControls: [
      "Ventilation or respiratory program tied to SDS and manufacturer maximum recoat windows; calculate air changes when working in enclosed steel bays.",
      "Ground and bond conductive lift platforms when spraying flammable coatings near energized temp power.",
      "Ignition source control list posted; no grinding or cutting within defined radius unless separate hot-work permit exists.",
      "Spill kits sized to largest container staged at each elevation before opening cans.",
    ],
    accessRestrictions: [
      "Coordinate shutdowns of intakes; post signage at elevator lobbies warning of odor migration windows.",
      "Restrict elevator use for paint carts to service elevators with drip trays.",
      "Limit simultaneous welding above paint touch zones unless fire watch overlap is engineered.",
      "Night-shift noise ordinances may restrict compressor starts; schedule accordingly.",
    ],
    requiredPpe: [
      "Organic vapor cartridge selection validated by industrial hygienist assumption table; change schedule posted.",
      "Coveralls or disposable suits with taped cuffs when high-build edge painting overhead drip is plausible.",
      "Nitrile inner glove under solvent-resistant outer glove when wiping spatters.",
      "Safety glasses with side shields even under face shield for splash directionality.",
    ],
    permitsHoldPoints: [
      "Environmental VOC night variance permits in some air-quality non-attainment jurisdictions.",
      "Owner color mock-up sign-off before field batch tinting variance.",
      "Fire alarm monitoring bypass notification if heat detectors present in zone.",
      "Hazmat shipping papers if moving catalyzed kits offsite as waste.",
    ],
    stopWorkTriggers: [
      "Stop if solvent odor thresholds trigger site GasAlert alarms or owner complaint hotline activation.",
      "Stop if flash point temperature windows approach sunset with insufficient cure prior to dew formation.",
      "Stop if ventilation fans fail or filters load beyond manufacturer pressure drop spec.",
      "Stop if worker reports dizziness — initiate medical evaluation before return-to-work decision.",
    ],
    verificationHandoff: [
      "Batch numbers, mix tickets, and environmental readings (temp/RH) stapled to daily QA cover sheet.",
      "DFT spot readings with correction maps filed under steel QC turnover binder.",
      "Notify downstream trades of cure times before allowing gasket compression or insulation placement against fresh coat.",
      "Waste drum labeled and sealed same shift thinners consolidated.",
    ],
  },
};

export function getSteelTaskModuleSafetyPlanPack(moduleKey: string): SteelTaskModuleSafetyPlanPack {
  return STEEL_TASK_MODULE_SAFETY_LIBRARY[moduleKey] ?? GENERIC_STEEL_TASK_PACK;
}
