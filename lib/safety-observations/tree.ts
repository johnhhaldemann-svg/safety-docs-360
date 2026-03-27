export const SAFETY_OBSERVATION_TREE = {
  Hazard: {
    Behavioral_Safety: [
      "PPE_Compliance",
      "Unsafe_Acts",
      "Distraction_Awareness",
      "Improper_Tool_Use",
      "Bypassing_Controls",
      "Fatigue_Human_Factors",
      "Communication_Issues",
    ],
    Work_Environment: [
      "Housekeeping",
      "Slip_Trip_Hazards",
      "Lighting_Conditions",
      "Weather_Impact",
      "Noise_Exposure",
      "Air_Quality_Dust",
      "Congestion_Access",
    ],
    Equipment_Tools: [
      "Damaged_Equipment",
      "Improper_Use",
      "Missing_Guards",
      "Inspection_Not_Completed",
      "Maintenance_Issues",
      "Power_Tools",
      "Heavy_Equipment",
    ],
    Working_at_Heights: [
      "No_Fall_Protection",
      "Improper_Tie_Off",
      "Ladder_Safety",
      "Scaffold_Safety",
      "Leading_Edge",
      "Access_Egress",
      "Unprotected_Edges",
    ],
    Electrical_Safety: [
      "Exposed_Wiring",
      "Temporary_Power",
      "LOTO",
      "Panel_Clearance",
      "Damaged_Cords",
      "Improper_Grounding",
    ],
    Material_Handling_Rigging: [
      "Improper_Lifting",
      "Crane_Operations",
      "Rigging_Issues",
      "Dropped_Object",
      "Load_Securing",
      "Forklift_Operation",
      "Overhead_Work",
    ],
    High_Risk_Work: [
      "Hot_Work",
      "Confined_Space",
      "Chemical_Exposure",
      "Pressure_Systems",
      "Stored_Energy",
      "Line_Breaking",
    ],
    Permits_Compliance: [
      "Missing_Permit",
      "Incorrect_Permit",
      "Expired_Permit",
      "Missing_Signatures",
      "Not_Following_Permit",
    ],
  },
  Positive: {
    Safe_Behavior: [
      "Proper_PPE",
      "Good_Housekeeping",
      "Safe_Work_Practices",
      "Strong_Communication",
      "Following_Plan",
      "Hazard_Corrected",
      "Leadership_Involvement",
    ],
  },
  Near_Miss: {
    Indicators: [
      "Near_Miss_Event",
      "First_Aid",
      "Property_Damage",
      "High_Potential",
      "Unsafe_Condition",
    ],
  },
} as const;

export type ObservationTypeKey = keyof typeof SAFETY_OBSERVATION_TREE;

export function getCategoriesForType(type: string): string[] {
  const branch = SAFETY_OBSERVATION_TREE[type as ObservationTypeKey];
  if (!branch) return [];
  return Object.keys(branch);
}

export function getSubcategoriesFor(type: string, category: string): string[] {
  const branch = SAFETY_OBSERVATION_TREE[type as ObservationTypeKey];
  if (!branch) return [];
  const subs = (branch as Record<string, readonly string[]>)[category];
  return subs ? [...subs] : [];
}

export function isValidObservationCombo(type: string, category: string, subcategory: string): boolean {
  const subs = getSubcategoriesFor(type, category);
  return subs.includes(subcategory);
}
