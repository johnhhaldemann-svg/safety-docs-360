import type { ProjectDeliveryType } from "@/types/safety-intelligence";

export type TradeConflictCatalogRow = {
  phaseTitle: string;
  tradeFunctionLabel: string;
  conflictSummary: string;
  mitigationFocus: string;
  canonicalTradeLabel?: string | null;
};

export type TradeConflictProfile = {
  projectDeliveryType: ProjectDeliveryType;
  title: string;
  subtitle: string;
  appendixAssetPath: string;
  rows: readonly TradeConflictCatalogRow[];
};

export const DEFAULT_PROJECT_DELIVERY_TYPE: ProjectDeliveryType = "ground_up";

function rows(
  values: readonly TradeConflictCatalogRow[]
): readonly TradeConflictCatalogRow[] {
  return values;
}

export function normalizeProjectDeliveryType(value: unknown): ProjectDeliveryType {
  if (typeof value !== "string") return DEFAULT_PROJECT_DELIVERY_TYPE;
  const token = value.trim().toLowerCase();
  if (token === "renovation" || token === "refurbishment") return "renovation";
  if (
    token === "ground_up" ||
    token === "ground-up" ||
    token === "ground up" ||
    token === "new_build" ||
    token === "new build"
  ) {
    return "ground_up";
  }
  return DEFAULT_PROJECT_DELIVERY_TYPE;
}

export function projectDeliveryTypeLabel(projectDeliveryType: ProjectDeliveryType) {
  return projectDeliveryType === "renovation"
    ? "Building Refurbishment / Renovation"
    : "Ground-Up New Build";
}

const GROUND_UP_ROWS = rows([
  {
    phaseTitle: "1. Preconstruction / Controls",
    tradeFunctionLabel: "Project Management / Superintendent",
    conflictSummary:
      "Conflicts with all trades when schedule, laydown, access, and sequencing are not controlled.",
    mitigationFocus:
      "Lock the master sequence, area ownership, and delivery windows before field execution starts.",
    canonicalTradeLabel: "General Conditions / Site Management",
  },
  {
    phaseTitle: "1. Preconstruction / Controls",
    tradeFunctionLabel: "Safety / Site Logistics",
    conflictSummary:
      "Conflicts with all trades when work zones, access routes, crane picks, deliveries, and pedestrian paths overlap.",
    mitigationFocus:
      "Define haul routes, exclusion zones, and pedestrian separation for all shared access points.",
  },
  {
    phaseTitle: "1. Preconstruction / Controls",
    tradeFunctionLabel: "Survey / Layout",
    conflictSummary:
      "Conflicts with earthwork, concrete, steel, masonry, and utilities when layout changes or areas are disturbed.",
    mitigationFocus:
      "Protect layout control points and require re-verification after disturbance or redesign.",
  },
  {
    phaseTitle: "1. Preconstruction / Controls",
    tradeFunctionLabel: "Testing / Inspection",
    conflictSummary:
      "Conflicts with concrete, steel, fireproofing, MEP, and drywall when work is covered before inspection.",
    mitigationFocus:
      "Build inspection hold points into the schedule and stop close-in until signoff is complete.",
  },
  {
    phaseTitle: "2. Sitework / Civil",
    tradeFunctionLabel: "Clearing / Grubbing",
    conflictSummary: "Conflicts with survey, erosion control, and underground utilities.",
    mitigationFocus:
      "Verify disturbance limits, utility locates, and erosion controls before clearing starts.",
    canonicalTradeLabel: "Excavation / Civil",
  },
  {
    phaseTitle: "2. Sitework / Civil",
    tradeFunctionLabel: "Erosion Control",
    conflictSummary:
      "Conflicts with grading, excavation, access roads, and landscaping.",
    mitigationFocus:
      "Sequence temporary controls with grading phases and protect stormwater devices during access changes.",
  },
  {
    phaseTitle: "2. Sitework / Civil",
    tradeFunctionLabel: "Earthwork / Grading",
    conflictSummary:
      "Conflicts with survey, utilities, excavation, concrete, and paving.",
    mitigationFocus:
      "Use phased grading releases and separate rough grading from follow-on underground work.",
  },
  {
    phaseTitle: "2. Sitework / Civil",
    tradeFunctionLabel: "Excavation / Shoring / Dewatering",
    conflictSummary:
      "Conflicts with underground utilities, foundations, site access, and crane setup.",
    mitigationFocus:
      "Coordinate excavation support, access restrictions, and crane pad requirements before opening work fronts.",
    canonicalTradeLabel: "Excavation / Civil",
  },
  {
    phaseTitle: "2. Sitework / Civil",
    tradeFunctionLabel: "Underground Utilities",
    conflictSummary:
      "Conflicts with excavation, foundations, paving, landscaping, and site concrete.",
    mitigationFocus:
      "Release utility corridors early and require as-built confirmation before backfill and restoration.",
  },
  {
    phaseTitle: "2. Sitework / Civil",
    tradeFunctionLabel: "Site Concrete / Curb / Walks",
    conflictSummary:
      "Conflicts with utilities, paving, landscaping, and facade access.",
    mitigationFocus:
      "Sequence pours after underground completion and preserve access for facade and final deliveries.",
  },
  {
    phaseTitle: "2. Sitework / Civil",
    tradeFunctionLabel: "Paving",
    conflictSummary: "Conflicts with utilities, landscaping, and final deliveries.",
    mitigationFocus:
      "Protect final grades, freeze underground work, and keep heavy traffic off finished paving.",
  },
  {
    phaseTitle: "2. Sitework / Civil",
    tradeFunctionLabel: "Landscaping / Irrigation",
    conflictSummary:
      "Conflicts with utilities, paving, fencing, and final grading.",
    mitigationFocus:
      "Delay finish landscaping until underground punch, grading, and fence alignments are verified.",
  },
  {
    phaseTitle: "3. Structure / Building Shell",
    tradeFunctionLabel: "Foundations / Footings",
    conflictSummary:
      "Conflicts with excavation, rebar, embeds, and underground utilities.",
    mitigationFocus:
      "Confirm excavation limits, embeds, and utility clearances before concrete placement.",
    canonicalTradeLabel: "Concrete / Masonry",
  },
  {
    phaseTitle: "3. Structure / Building Shell",
    tradeFunctionLabel: "Rebar / PT / Embeds",
    conflictSummary:
      "Conflicts with concrete, steel, MEP sleeves, and anchor bolt locations.",
    mitigationFocus:
      "Use pre-pour coordination drawings to verify embeds, sleeves, and anchor alignment.",
  },
  {
    phaseTitle: "3. Structure / Building Shell",
    tradeFunctionLabel: "Cast-in-Place Concrete",
    conflictSummary:
      "Conflicts with rebar, embeds, formwork, crane access, cure time, and masonry start.",
    mitigationFocus:
      "Protect cure windows, maintain logistics access, and control handoff timing to follow-on trades.",
    canonicalTradeLabel: "Concrete / Masonry",
  },
  {
    phaseTitle: "3. Structure / Building Shell",
    tradeFunctionLabel: "Precast",
    conflictSummary:
      "Conflicts with steel erection, crane access, facade installation, and site logistics.",
    mitigationFocus:
      "Reserve lift zones, pick paths, and erection windows before overlapping steel and enclosure work.",
  },
  {
    phaseTitle: "3. Structure / Building Shell",
    tradeFunctionLabel: "Structural Steel",
    conflictSummary:
      "Conflicts with concrete, decking, welding, fireproofing, crane picks, and MEP penetrations.",
    mitigationFocus:
      "Sequence erection, deck closure, fireproofing release, and penetration coordination before interior rough-in.",
    canonicalTradeLabel: "Steel Erection",
  },
  {
    phaseTitle: "3. Structure / Building Shell",
    tradeFunctionLabel: "Metal Deck",
    conflictSummary:
      "Conflicts with steel, embeds, mechanical openings, and concrete topping.",
    mitigationFocus:
      "Lock deck opening locations and topping sequence before closing overhead access paths.",
  },
  {
    phaseTitle: "3. Structure / Building Shell",
    tradeFunctionLabel: "Masonry",
    conflictSummary:
      "Conflicts with steel, scaffolding, facade, window openings, and MEP wall penetrations.",
    mitigationFocus:
      "Coordinate scaffold access, opening dimensions, and wall penetration sleeves before wall closure.",
    canonicalTradeLabel: "Concrete / Masonry",
  },
  {
    phaseTitle: "3. Structure / Building Shell",
    tradeFunctionLabel: "Rough Carpentry / Wood Framing",
    conflictSummary:
      "Conflicts with MEP rough-in, sheathing, waterproofing, and drywall.",
    mitigationFocus:
      "Use framing release checks to confirm rough-in and envelope prep before concealment.",
  },
  {
    phaseTitle: "3. Structure / Building Shell",
    tradeFunctionLabel: "Roofing",
    conflictSummary:
      "Conflicts with steel completion, rooftop HVAC, curbs, electrical gear, and weather exposure.",
    mitigationFocus:
      "Reserve rooftop work windows and equipment turnover milestones before drying in the roof.",
    canonicalTradeLabel: "Roofing",
  },
  {
    phaseTitle: "3. Structure / Building Shell",
    tradeFunctionLabel: "Waterproofing / Dampproofing",
    conflictSummary:
      "Conflicts with concrete cure, excavation backfill, facade anchors, and roofing transitions.",
    mitigationFocus:
      "Hold backfill until membrane approval and coordinate transition details across envelope trades.",
  },
  {
    phaseTitle: "3. Structure / Building Shell",
    tradeFunctionLabel: "Facade / Cladding / Panels",
    conflictSummary:
      "Conflicts with scaffold access, glazing, waterproofing, and site logistics.",
    mitigationFocus:
      "Plan facade zones, scaffold ownership, and delivery staging with glazing and waterproofing handoffs.",
  },
  {
    phaseTitle: "3. Structure / Building Shell",
    tradeFunctionLabel: "Glazing / Windows / Curtainwall",
    conflictSummary:
      "Conflicts with facade, waterproofing, drywall closure, and interior climate control.",
    mitigationFocus:
      "Sequence dry-in milestones with enclosure testing and interior closure readiness.",
    canonicalTradeLabel: "Glazing / Envelope",
  },
  {
    phaseTitle: "3. Structure / Building Shell",
    tradeFunctionLabel: "Fireproofing",
    conflictSummary:
      "Conflicts with steel, hangers, MEP supports, inspections, and ceiling closure.",
    mitigationFocus:
      "Release steel only after hangers and supports are complete and inspected to avoid rework.",
  },
  {
    phaseTitle: "4. Interior Framing and Core Rough-In",
    tradeFunctionLabel: "Interior Metal Stud Framing",
    conflictSummary:
      "Conflicts with plumbing, HVAC, electrical, fire alarm, doors/frames, and soffits.",
    mitigationFocus:
      "Confirm rough-in pathways, head-of-wall conditions, and frame coordination before framing closure.",
    canonicalTradeLabel: "Drywall / Framing",
  },
  {
    phaseTitle: "4. Interior Framing and Core Rough-In",
    tradeFunctionLabel: "Doors / Frames / Hardware",
    conflictSummary:
      "Conflicts with framing, drywall, access control, and flooring elevations.",
    mitigationFocus:
      "Verify opening tolerances, device prep, and finish-floor elevations before permanent hardware install.",
  },
  {
    phaseTitle: "4. Interior Framing and Core Rough-In",
    tradeFunctionLabel: "Stairs / Railings / Misc. Metals",
    conflictSummary:
      "Conflicts with concrete dimensions, framing, finishes, and final access routes.",
    mitigationFocus:
      "Confirm field dimensions and protect final access paths during installation and punch.",
  },
  {
    phaseTitle: "4. Interior Framing and Core Rough-In",
    tradeFunctionLabel: "Elevators",
    conflictSummary:
      "Conflicts with structural openings, electrical feeds, fire alarm, finishes, and turnover sequence.",
    mitigationFocus:
      "Coordinate opening readiness, permanent power, testing, and cab protection before closeout.",
  },
  {
    phaseTitle: "5. MEP / Life Safety Rough-In",
    tradeFunctionLabel: "Plumbing",
    conflictSummary:
      "Conflicts with framing, structural penetrations, HVAC duct routes, electrical rooms, and ceiling space.",
    mitigationFocus:
      "Use coordinated overhead zoning and penetration management before walls and ceilings are closed.",
    canonicalTradeLabel: "Plumbing",
  },
  {
    phaseTitle: "5. MEP / Life Safety Rough-In",
    tradeFunctionLabel: "HVAC / Mechanical",
    conflictSummary:
      "Conflicts with structure, plumbing, electrical, sprinkler, ceiling heights, and rooftop access.",
    mitigationFocus:
      "Resolve duct and equipment routing first where ceiling or shaft space is limited.",
    canonicalTradeLabel: "Mechanical / HVAC",
  },
  {
    phaseTitle: "5. MEP / Life Safety Rough-In",
    tradeFunctionLabel: "Sheet Metal / Ductwork",
    conflictSummary:
      "Conflicts with piping, cable tray, sprinkler mains, framing, and above-ceiling congestion.",
    mitigationFocus:
      "Run above-ceiling coordination by priority zones and hold framing and ceiling closure until resolved.",
  },
  {
    phaseTitle: "5. MEP / Life Safety Rough-In",
    tradeFunctionLabel: "Piping / Hydronic / Process",
    conflictSummary:
      "Conflicts with ductwork, sprinkler mains, steel, access panels, and insulation.",
    mitigationFocus:
      "Sequence large-bore piping with support ownership, valve access, and insulation clearances in mind.",
  },
  {
    phaseTitle: "5. MEP / Life Safety Rough-In",
    tradeFunctionLabel: "Fire Sprinkler / Fire Protection",
    conflictSummary:
      "Conflicts with ductwork, lights, cable tray, ceiling grids, and structural members.",
    mitigationFocus:
      "Reserve sprinkler mains and head locations early so ceiling trades do not force late relocations.",
  },
  {
    phaseTitle: "5. MEP / Life Safety Rough-In",
    tradeFunctionLabel: "Electrical Power",
    conflictSummary:
      "Conflicts with framing, ducts, plumbing, sprinkler, equipment pads, and shutdown sequencing.",
    mitigationFocus:
      "Coordinate feeder paths, equipment clearances, and shutdown windows with all affected crews.",
    canonicalTradeLabel: "Electrical",
  },
  {
    phaseTitle: "5. MEP / Life Safety Rough-In",
    tradeFunctionLabel: "Low Voltage / Data",
    conflictSummary:
      "Conflicts with electrical, access control, ceilings, IT room turnover, and pathway ownership.",
    mitigationFocus:
      "Assign pathway ownership and turnover milestones for telecom and security spaces before trim-out.",
  },
  {
    phaseTitle: "5. MEP / Life Safety Rough-In",
    tradeFunctionLabel: "Fire Alarm",
    conflictSummary:
      "Conflicts with electrical, low voltage, ceilings, device locations, and wall finishes.",
    mitigationFocus:
      "Freeze device locations before wall and ceiling finishes to reduce relocation rework.",
  },
  {
    phaseTitle: "5. MEP / Life Safety Rough-In",
    tradeFunctionLabel: "Security / Access Control / Cameras",
    conflictSummary:
      "Conflicts with doors/hardware, electrical, low voltage, glazing, and final finishes.",
    mitigationFocus:
      "Coordinate device backing, door hardware prep, and final placement before turnover.",
  },
  {
    phaseTitle: "5. MEP / Life Safety Rough-In",
    tradeFunctionLabel: "Controls / BAS / Commissioning Devices",
    conflictSummary:
      "Conflicts with HVAC, electrical, low voltage, ceiling closure, and startup timing.",
    mitigationFocus:
      "Tie controls installation to equipment startup readiness and protect device access through closure.",
  },
  {
    phaseTitle: "6. Close-In / Finish Trades",
    tradeFunctionLabel: "Insulation",
    conflictSummary:
      "Conflicts with unfinished MEP rough-in, inspections, firestopping, and drywall closure.",
    mitigationFocus:
      "Do not release insulation until rough-in and inspection signoffs are complete.",
  },
  {
    phaseTitle: "6. Close-In / Finish Trades",
    tradeFunctionLabel: "Firestopping / Smoke Seal",
    conflictSummary:
      "Conflicts with MEP penetrations, inspections, drywall, and ceiling close-in.",
    mitigationFocus:
      "Hold final wall and ceiling close-in until penetrations are complete and firestopped.",
  },
  {
    phaseTitle: "6. Close-In / Finish Trades",
    tradeFunctionLabel: "Drywall / Shaft Wall",
    conflictSummary:
      "Conflicts with incomplete MEP, doors/frames, inspections, and humidity control.",
    mitigationFocus:
      "Use closure checklists so framing, rough-in, and environmental readiness are confirmed before board install.",
    canonicalTradeLabel: "Drywall / Framing",
  },
  {
    phaseTitle: "6. Close-In / Finish Trades",
    tradeFunctionLabel: "Acoustical Ceilings",
    conflictSummary:
      "Conflicts with sprinkler heads, diffusers, lights, speakers, devices, and access panels.",
    mitigationFocus:
      "Lock device layout and access-panel ownership before grid closure and tile placement.",
  },
  {
    phaseTitle: "6. Close-In / Finish Trades",
    tradeFunctionLabel: "Flooring",
    conflictSummary:
      "Conflicts with moisture, painting, millwork, lift traffic, and final punch work.",
    mitigationFocus:
      "Protect substrate conditions and keep heavy traffic off finish floors until punch is controlled.",
  },
  {
    phaseTitle: "6. Close-In / Finish Trades",
    tradeFunctionLabel: "Tile",
    conflictSummary:
      "Conflicts with wet areas, plumbing fixture timing, waterproofing, and finish protection.",
    mitigationFocus:
      "Sequence waterproofing, fixture rough-in, and finish protection before tile turnover.",
  },
  {
    phaseTitle: "6. Close-In / Finish Trades",
    tradeFunctionLabel: "Painting / Coatings",
    conflictSummary:
      "Conflicts with drywall finish, flooring, hardware installation, and dust-producing trades.",
    mitigationFocus:
      "Use dust-control and finish-zone restrictions so coatings are not damaged by late work.",
  },
  {
    phaseTitle: "6. Close-In / Finish Trades",
    tradeFunctionLabel: "Millwork / Casework / Specialties",
    conflictSummary:
      "Conflicts with wall backing, electrical, plumbing, final dimensions, and flooring heights.",
    mitigationFocus:
      "Verify backing, rough-ins, and final dimensions before casework fabrication and install.",
  },
  {
    phaseTitle: "6. Close-In / Finish Trades",
    tradeFunctionLabel: "Toilet Partitions / Accessories",
    conflictSummary:
      "Conflicts with tile, plumbing fixtures, layout, and finish completion.",
    mitigationFocus:
      "Release partitions only after finished surfaces, fixture centers, and ADA layout are confirmed.",
  },
  {
    phaseTitle: "6. Close-In / Finish Trades",
    tradeFunctionLabel: "Final Electrical Trim",
    conflictSummary:
      "Conflicts with ceilings, paint, millwork, and equipment startup.",
    mitigationFocus:
      "Coordinate final trim with finish completion and staged startup windows.",
  },
  {
    phaseTitle: "6. Close-In / Finish Trades",
    tradeFunctionLabel: "Final Plumbing Trim",
    conflictSummary:
      "Conflicts with flooring, tile, countertops, and fixture access.",
    mitigationFocus:
      "Sequence trim after adjacent finish protection and fixture access are ready.",
  },
  {
    phaseTitle: "6. Close-In / Finish Trades",
    tradeFunctionLabel: "Final HVAC / TAB",
    conflictSummary:
      "Conflicts with ceiling completion, controls, electrical startup, and balancing access.",
    mitigationFocus:
      "Protect balancing access and complete startup/control integration before TAB signoff.",
  },
  {
    phaseTitle: "6. Close-In / Finish Trades",
    tradeFunctionLabel: "Final Fire Alarm / Testing",
    conflictSummary:
      "Conflicts with energized systems, ceilings, occupancy readiness, and other testing activities.",
    mitigationFocus:
      "Consolidate test windows and occupancy prerequisites to avoid partial acceptance failures.",
  },
  {
    phaseTitle: "7. Exterior / Final Completion",
    tradeFunctionLabel: "Site Fencing / Gates",
    conflictSummary:
      "Conflicts with deliveries, emergency access, paving, and landscaping.",
    mitigationFocus:
      "Maintain emergency and delivery routing while transitioning from construction access to final access control.",
  },
  {
    phaseTitle: "7. Exterior / Final Completion",
    tradeFunctionLabel: "Signage",
    conflictSummary:
      "Conflicts with electrical, facade, and final owner requirements.",
    mitigationFocus:
      "Coordinate owner branding, power, and final facade details before sign installation.",
  },
  {
    phaseTitle: "7. Exterior / Final Completion",
    tradeFunctionLabel: "Cleaning / Punch",
    conflictSummary:
      "Conflicts with remaining finish work, owner walkthroughs, and rework.",
    mitigationFocus:
      "Separate final clean zones from active rework and manage punch ownership by area.",
  },
  {
    phaseTitle: "7. Exterior / Final Completion",
    tradeFunctionLabel: "Commissioning / Startup",
    conflictSummary:
      "Conflicts with incomplete systems, final power, controls integration, and occupancy deadlines.",
    mitigationFocus:
      "Use system-ready checklists and startup sequencing tied to permanent power and controls completion.",
    canonicalTradeLabel: "Commissioning / Startup",
  },
  {
    phaseTitle: "7. Exterior / Final Completion",
    tradeFunctionLabel: "Owner Move-In / Turnover",
    conflictSummary:
      "Conflicts with punch list work, testing, training, access control, and final life safety approval.",
    mitigationFocus:
      "Gate turnover on life-safety approval, owner training, and controlled punch access by area.",
  },
]);

const RENOVATION_ROWS = rows([
  {
    phaseTitle: "1. Existing Conditions / Controls",
    tradeFunctionLabel: "Project Management / Superintendent",
    conflictSummary:
      "Conflicts with all trades when shutdowns, phased access, tenant coordination, and sequencing are not controlled.",
    mitigationFocus:
      "Tie the master sequence to shutdown windows, occupied-area constraints, and phased handoff milestones.",
    canonicalTradeLabel: "General Conditions / Site Management",
  },
  {
    phaseTitle: "1. Existing Conditions / Controls",
    tradeFunctionLabel: "Safety / Infection Control / Logistics",
    conflictSummary:
      "Conflicts with all trades when dust control, barriers, egress, occupied areas, and deliveries overlap.",
    mitigationFocus:
      "Maintain barrier ownership, dust control, occupied egress, and delivery routing before work fronts shift.",
  },
  {
    phaseTitle: "1. Existing Conditions / Controls",
    tradeFunctionLabel: "Survey / Existing Conditions Verification",
    conflictSummary:
      "Conflicts with demo, framing, MEP reroutes, field dimensions, and hidden conditions.",
    mitigationFocus:
      "Verify field conditions before demolition or fabrication and revalidate when concealed conditions are exposed.",
  },
  {
    phaseTitle: "1. Existing Conditions / Controls",
    tradeFunctionLabel: "Temporary Protection",
    conflictSummary:
      "Conflicts with demolition, access routes, material movement, and finish protection.",
    mitigationFocus:
      "Define protection zones and restore them as access routes or material flow changes.",
  },
  {
    phaseTitle: "1. Existing Conditions / Controls",
    tradeFunctionLabel: "Temporary Power / Lighting",
    conflictSummary:
      "Conflicts with demolition, electrical shutdowns, occupied space, and inspections.",
    mitigationFocus:
      "Plan temporary power continuity around shutdowns and keep occupied-space lighting and safety systems active.",
  },
  {
    phaseTitle: "1. Existing Conditions / Controls",
    tradeFunctionLabel: "Temporary HVAC / Negative Air",
    conflictSummary:
      "Conflicts with abatement, demo, ceiling work, occupant comfort, and dust migration.",
    mitigationFocus:
      "Coordinate pressure control and temporary HVAC with containment boundaries and occupant requirements.",
  },
  {
    phaseTitle: "2. Selective Demolition / Hazard Removal",
    tradeFunctionLabel: "Selective Demolition",
    conflictSummary:
      "Conflicts with occupied areas, active utilities, containment, salvage items, and access paths.",
    mitigationFocus:
      "Use utility verification, salvage tagging, and barrier controls before demo begins in shared or occupied zones.",
    canonicalTradeLabel: "Demolition",
  },
  {
    phaseTitle: "2. Selective Demolition / Hazard Removal",
    tradeFunctionLabel: "Structural Demo / Sawcutting",
    conflictSummary:
      "Conflicts with shoring, concrete, steel, vibration-sensitive areas, and nearby finished work.",
    mitigationFocus:
      "Require structural sequencing, vibration review, and protection of adjacent finishes before cutting.",
  },
  {
    phaseTitle: "2. Selective Demolition / Hazard Removal",
    tradeFunctionLabel: "Abatement (Asbestos / Lead / Mold)",
    conflictSummary:
      "Conflicts with access, HVAC shutdowns, containment, schedule, and adjacent trades.",
    mitigationFocus:
      "Control containment ownership, shutdown timing, and adjacent-trade exclusions until clearance is achieved.",
  },
  {
    phaseTitle: "2. Selective Demolition / Hazard Removal",
    tradeFunctionLabel: "Debris Removal",
    conflictSummary:
      "Conflicts with deliveries, elevators, egress routes, and active tenant circulation.",
    mitigationFocus:
      "Reserve haul routes and elevator windows so debris movement does not disrupt occupants or logistics.",
  },
  {
    phaseTitle: "2. Selective Demolition / Hazard Removal",
    tradeFunctionLabel: "Existing Utility Shutoff / Lockout",
    conflictSummary:
      "Conflicts with plumbing, electrical, HVAC, fire alarm, and occupied operations.",
    mitigationFocus:
      "Use approved shutdown plans, lockout ownership, and occupant notifications before isolating services.",
  },
  {
    phaseTitle: "3. Structural / Envelope Modifications",
    tradeFunctionLabel: "Shoring / Temporary Support",
    conflictSummary:
      "Conflicts with demolition, concrete repairs, framing, and access routes.",
    mitigationFocus:
      "Verify shoring loads and protected access before demolition or repair work opens the area.",
  },
  {
    phaseTitle: "3. Structural / Envelope Modifications",
    tradeFunctionLabel: "Concrete Repair / Patching",
    conflictSummary:
      "Conflicts with cure time, flooring, coatings, structural steel, and access.",
    mitigationFocus:
      "Protect cure windows and separate repair access from follow-on finishes.",
    canonicalTradeLabel: "Concrete / Masonry",
  },
  {
    phaseTitle: "3. Structural / Envelope Modifications",
    tradeFunctionLabel: "Structural Steel Reinforcement",
    conflictSummary:
      "Conflicts with demo, fireproofing, MEP reroutes, and limited lifting access.",
    mitigationFocus:
      "Coordinate reinforcement scope with lifting constraints and downstream fireproofing and MEP access.",
    canonicalTradeLabel: "Steel Erection",
  },
  {
    phaseTitle: "3. Structural / Envelope Modifications",
    tradeFunctionLabel: "Masonry Repair",
    conflictSummary:
      "Conflicts with facade access, waterproofing, windows, and interior finishes.",
    mitigationFocus:
      "Synchronize facade access and weather protection before repair work affects occupied interiors.",
  },
  {
    phaseTitle: "3. Structural / Envelope Modifications",
    tradeFunctionLabel: "Roofing Repair / Replacement",
    conflictSummary:
      "Conflicts with occupied spaces below, HVAC shutdowns, weather, and crane access.",
    mitigationFocus:
      "Plan weather backup, shutdown windows, and protection of occupied areas below the roof work.",
    canonicalTradeLabel: "Roofing",
  },
  {
    phaseTitle: "3. Structural / Envelope Modifications",
    tradeFunctionLabel: "Waterproofing / Sealants",
    conflictSummary:
      "Conflicts with facade repair, glazing, painting, and access equipment.",
    mitigationFocus:
      "Coordinate sealant completion with adjacent facade access and finish trades.",
  },
  {
    phaseTitle: "3. Structural / Envelope Modifications",
    tradeFunctionLabel: "Glazing / Window Replacement",
    conflictSummary:
      "Conflicts with facade access, interior protection, HVAC balance, and tenant areas.",
    mitigationFocus:
      "Sequence removals with interior protection and temporary environmental control for occupied spaces.",
    canonicalTradeLabel: "Glazing / Envelope",
  },
  {
    phaseTitle: "4. Interior Rebuild / Reconfiguration",
    tradeFunctionLabel: "Layout / Field Verification",
    conflictSummary:
      "Conflicts with hidden existing conditions, misaligned walls, ceiling grids, and existing columns.",
    mitigationFocus:
      "Reconfirm field layout after demo and before fabrication or partition framing starts.",
  },
  {
    phaseTitle: "4. Interior Rebuild / Reconfiguration",
    tradeFunctionLabel: "Interior Metal Stud Framing",
    conflictSummary:
      "Conflicts with existing utilities, new MEP rough-in, doors, and low ceilings.",
    mitigationFocus:
      "Resolve existing-condition clashes and low-clearance routing before framing closure.",
    canonicalTradeLabel: "Drywall / Framing",
  },
  {
    phaseTitle: "4. Interior Rebuild / Reconfiguration",
    tradeFunctionLabel: "Carpentry / Blocking",
    conflictSummary:
      "Conflicts with wall closures, MEP supports, and millwork dimensions.",
    mitigationFocus:
      "Verify backing and support locations before walls are closed and casework is released.",
  },
  {
    phaseTitle: "4. Interior Rebuild / Reconfiguration",
    tradeFunctionLabel: "Doors / Frames / Hardware",
    conflictSummary:
      "Conflicts with existing openings, framing tolerances, access control, and flooring elevations.",
    mitigationFocus:
      "Field-verify openings and finish elevations before permanent frame and hardware installation.",
  },
  {
    phaseTitle: "4. Interior Rebuild / Reconfiguration",
    tradeFunctionLabel: "Misc. Metals / Railings",
    conflictSummary: "Conflicts with structure and finished surfaces.",
    mitigationFocus:
      "Confirm anchor conditions and protect finished surfaces during installation.",
  },
  {
    phaseTitle: "4. Interior Rebuild / Reconfiguration",
    tradeFunctionLabel: "Ceiling Grid Rework",
    conflictSummary:
      "Conflicts with MEP reroutes, fire alarm devices, diffusers, lighting, and existing elevations.",
    mitigationFocus:
      "Freeze ceiling coordination against existing elevations and relocated devices before grid reset.",
  },
  {
    phaseTitle: "5. MEP / System Replacement and Upgrades",
    tradeFunctionLabel: "Plumbing",
    conflictSummary:
      "Conflicts with existing piping, shutdown windows, framing, floor cores, and occupied restrooms.",
    mitigationFocus:
      "Align shutdowns, existing-utility discovery, and restroom turnover with phased occupant needs.",
    canonicalTradeLabel: "Plumbing",
  },
  {
    phaseTitle: "5. MEP / System Replacement and Upgrades",
    tradeFunctionLabel: "HVAC",
    conflictSummary:
      "Conflicts with demo dust, occupied comfort, ceiling congestion, shutdowns, and balancing.",
    mitigationFocus:
      "Protect occupied-space comfort and coordinate shutdowns with reroute windows and final balancing.",
    canonicalTradeLabel: "Mechanical / HVAC",
  },
  {
    phaseTitle: "5. MEP / System Replacement and Upgrades",
    tradeFunctionLabel: "Sheet Metal / Ductwork",
    conflictSummary:
      "Conflicts with existing structure, sprinkler, electrical, low clearances, and access.",
    mitigationFocus:
      "Use above-ceiling clash reviews for low-clearance areas before prefabrication or install.",
  },
  {
    phaseTitle: "5. MEP / System Replacement and Upgrades",
    tradeFunctionLabel: "Fire Sprinkler",
    conflictSummary:
      "Conflicts with ceiling work, shutdowns, existing mains, ductwork, and life safety phasing.",
    mitigationFocus:
      "Coordinate sprinkler shutdown and impairment plans with ceiling phases and life-safety coverage.",
  },
  {
    phaseTitle: "5. MEP / System Replacement and Upgrades",
    tradeFunctionLabel: "Electrical Power",
    conflictSummary:
      "Conflicts with shutdown windows, active panels, temporary power, occupied areas, and wall close-in.",
    mitigationFocus:
      "Stage shutdowns, temporary power, and active-panel work to maintain safe occupied operations.",
    canonicalTradeLabel: "Electrical",
  },
  {
    phaseTitle: "5. MEP / System Replacement and Upgrades",
    tradeFunctionLabel: "Low Voltage / Data",
    conflictSummary:
      "Conflicts with occupied systems, IT cutovers, ceiling access, and electrical ownership.",
    mitigationFocus:
      "Coordinate cutovers and pathway ownership before removing active systems or closing ceilings.",
  },
  {
    phaseTitle: "5. MEP / System Replacement and Upgrades",
    tradeFunctionLabel: "Fire Alarm",
    conflictSummary:
      "Conflicts with occupied building testing, device relocation, ceiling closure, and shutdown coordination.",
    mitigationFocus:
      "Tie device relocation and testing to phased occupancy and impairment approval workflows.",
  },
  {
    phaseTitle: "5. MEP / System Replacement and Upgrades",
    tradeFunctionLabel: "Security / Access Control",
    conflictSummary:
      "Conflicts with doors/hardware, existing operations, power, data, and tenant turnover.",
    mitigationFocus:
      "Plan access-control changes around live operations and turnover timing to avoid lockout issues.",
  },
  {
    phaseTitle: "5. MEP / System Replacement and Upgrades",
    tradeFunctionLabel: "BAS / Controls",
    conflictSummary:
      "Conflicts with HVAC replacement, electrical startup, and commissioning windows.",
    mitigationFocus:
      "Stage controls work with equipment replacement and startup so systems can be commissioned once.",
  },
  {
    phaseTitle: "5. MEP / System Replacement and Upgrades",
    tradeFunctionLabel: "Elevator / Lift Modernization",
    conflictSummary:
      "Conflicts with occupied circulation, shutdowns, electrical, fire alarm, and finishes.",
    mitigationFocus:
      "Coordinate circulation impacts, shutdown notices, and finish protection during modernization.",
  },
  {
    phaseTitle: "6. Close-In / Finish Restoration",
    tradeFunctionLabel: "Insulation",
    conflictSummary:
      "Conflicts with incomplete MEP, inspections, firestopping, and drywall.",
    mitigationFocus:
      "Do not release insulation until reroutes, penetrations, and inspections are complete.",
  },
  {
    phaseTitle: "6. Close-In / Finish Restoration",
    tradeFunctionLabel: "Firestopping",
    conflictSummary:
      "Conflicts with continuing penetrations, inspections, and wall closure.",
    mitigationFocus:
      "Track late penetrations and require firestop closure before concealment.",
  },
  {
    phaseTitle: "6. Close-In / Finish Restoration",
    tradeFunctionLabel: "Drywall / Patching",
    conflictSummary:
      "Conflicts with unfinished rough-in, dust-sensitive areas, painting, and trim.",
    mitigationFocus:
      "Confirm reroutes are complete and isolate dust-sensitive occupied areas before patching starts.",
    canonicalTradeLabel: "Drywall / Framing",
  },
  {
    phaseTitle: "6. Close-In / Finish Restoration",
    tradeFunctionLabel: "Acoustical Ceilings",
    conflictSummary:
      "Conflicts with device relocation, sprinkler heads, HVAC diffusers, lighting, and access panels.",
    mitigationFocus:
      "Freeze relocated device layout and access-panel requirements before closing the ceiling.",
  },
  {
    phaseTitle: "6. Close-In / Finish Restoration",
    tradeFunctionLabel: "Flooring",
    conflictSummary:
      "Conflicts with moisture, occupied traffic, paint, furniture moves, and punch work.",
    mitigationFocus:
      "Protect substrate conditions and phase flooring around occupied traffic and furniture moves.",
  },
  {
    phaseTitle: "6. Close-In / Finish Restoration",
    tradeFunctionLabel: "Tile",
    conflictSummary:
      "Conflicts with plumbing fixture resets, waterproofing, and access limitations.",
    mitigationFocus:
      "Coordinate waterproofing cure, fixture reset timing, and limited room access before tile turnover.",
  },
  {
    phaseTitle: "6. Close-In / Finish Restoration",
    tradeFunctionLabel: "Painting / Wallcovering",
    conflictSummary:
      "Conflicts with dust from nearby work, hardware install, and occupied areas.",
    mitigationFocus:
      "Use dust control and occupied-area protection so finish coats are not compromised by nearby work.",
  },
  {
    phaseTitle: "6. Close-In / Finish Restoration",
    tradeFunctionLabel: "Millwork / Casework",
    conflictSummary:
      "Conflicts with existing dimensions, out-of-square walls, plumbing, and electrical.",
    mitigationFocus:
      "Field-verify dimensions and rough-ins before fabrication release and install.",
  },
  {
    phaseTitle: "6. Close-In / Finish Restoration",
    tradeFunctionLabel: "Specialties / Accessories",
    conflictSummary:
      "Conflicts with final layouts, ADA clearances, and owner changes.",
    mitigationFocus:
      "Confirm final layout and owner approvals before installing accessories in completed areas.",
  },
  {
    phaseTitle: "6. Close-In / Finish Restoration",
    tradeFunctionLabel: "Final Electrical Trim",
    conflictSummary:
      "Conflicts with paint completion, ceiling closure, and active system cutovers.",
    mitigationFocus:
      "Coordinate trim release with finish completion and live-system cutover sequencing.",
  },
  {
    phaseTitle: "6. Close-In / Finish Restoration",
    tradeFunctionLabel: "Final Plumbing Trim",
    conflictSummary:
      "Conflicts with flooring, casework, and water shutdown timing.",
    mitigationFocus:
      "Hold trim until finish surfaces are protected and shutdown timing is approved.",
  },
  {
    phaseTitle: "6. Close-In / Finish Restoration",
    tradeFunctionLabel: "Final HVAC / TAB",
    conflictSummary:
      "Conflicts with occupied conditions, controls, access above ceilings, and late ceiling work.",
    mitigationFocus:
      "Protect TAB windows and above-ceiling access while balancing around occupied conditions.",
  },
  {
    phaseTitle: "6. Close-In / Finish Restoration",
    tradeFunctionLabel: "Final Fire Alarm / Acceptance",
    conflictSummary:
      "Conflicts with active occupants, phased turnover, incomplete devices, and system dependencies.",
    mitigationFocus:
      "Sequence acceptance testing by occupied phase and confirm all dependent devices are online first.",
  },
  {
    phaseTitle: "7. Occupied Building / Final Turnover",
    tradeFunctionLabel: "Infection Control / Dust Barriers",
    conflictSummary:
      "Conflicts with demo, drywall sanding, ceiling access, deliveries, and emergency egress.",
    mitigationFocus:
      "Maintain barrier integrity and emergency egress while late work continues in occupied buildings.",
  },
  {
    phaseTitle: "7. Occupied Building / Final Turnover",
    tradeFunctionLabel: "Tenant / Owner Coordination",
    conflictSummary:
      "Conflicts with shutdowns, noise windows, access restrictions, and after-hours work.",
    mitigationFocus:
      "Use written notices and phased access plans tied to shutdown, noise, and after-hours commitments.",
  },
  {
    phaseTitle: "7. Occupied Building / Final Turnover",
    tradeFunctionLabel: "Cleaning / Punch",
    conflictSummary:
      "Conflicts with ongoing finish work, phased occupancy, and furniture install.",
    mitigationFocus:
      "Separate punch, clean, and occupancy zones so turnover can happen without damaging completed work.",
  },
  {
    phaseTitle: "7. Occupied Building / Final Turnover",
    tradeFunctionLabel: "Testing / Commissioning / Training",
    conflictSummary:
      "Conflicts with incomplete systems, active occupants, phased turnover, and access to rooms.",
    mitigationFocus:
      "Reserve room access and sequence training with system readiness and phased occupancy.",
    canonicalTradeLabel: "Commissioning / Startup",
  },
  {
    phaseTitle: "7. Occupied Building / Final Turnover",
    tradeFunctionLabel: "Reoccupancy / Handover",
    conflictSummary:
      "Conflicts with unresolved punch items, documentation gaps, and final life safety approvals.",
    mitigationFocus:
      "Gate reoccupancy on closeout documentation, life-safety signoff, and controlled punch access.",
  },
]);

const TRADE_CONFLICT_PROFILES: Record<ProjectDeliveryType, TradeConflictProfile> = {
  ground_up: {
    projectDeliveryType: "ground_up",
    title: "GROUND-UP NEW BUILD",
    subtitle: "Project Start to Final Turnover",
    appendixAssetPath: "public/trade-conflicts/ground-up-trade-conflict-tree.svg",
    rows: GROUND_UP_ROWS,
  },
  renovation: {
    projectDeliveryType: "renovation",
    title: "BUILDING REFURBISHMENT / RENOVATION",
    subtitle: "Existing Building Work from Selective Demo to Final Reoccupancy",
    appendixAssetPath: "public/trade-conflicts/renovation-trade-conflict-tree.svg",
    rows: RENOVATION_ROWS,
  },
};

export function getTradeConflictProfile(projectDeliveryType: ProjectDeliveryType) {
  return TRADE_CONFLICT_PROFILES[projectDeliveryType];
}
