"use client";

import { useMemo, useState } from "react";

type RiskLevel = "Low" | "Medium" | "High";

type CSEPRiskItem = {
  activity: string;
  hazard: string;
  risk: RiskLevel;
  controls: string[];
  permit: string;
};

type CSEPTradeLibraryItem = {
  trade: string;
  sectionTitle: string;
  summary: string;
  oshaRefs: string[];
  defaultPPE: string[];
  items: CSEPRiskItem[];
};

type CSEPForm = {
  project_name: string;
  project_number: string;
  project_address: string;
  owner_client: string;
  gc_cm: string;

  contractor_company: string;
  contractor_contact: string;
  contractor_phone: string;
  contractor_email: string;

  trade: string;
  scope_of_work: string;
  site_specific_notes: string;
  emergency_procedures: string;

  required_ppe: string[];
  additional_permits: string[];
};

const tradeOptions = [
  "Survey / Layout",
  "Demolition",
  "Earthwork",
  "Excavation / Utilities",
  "Concrete",
  "Roofing",
  "Electrical",
  "Mechanical / HVAC",
  "Plumbing",
  "Low Voltage",
  "Elevator",
  "Fire Protection",
  "Landscaping",
  "Asphalt / Paving",
  "Traffic Control",
];

const ppeOptions = [
  "Hard Hat",
  "Safety Glasses",
  "High Visibility Vest",
  "Gloves",
  "Steel Toe Boots",
  "Hearing Protection",
  "Face Shield",
  "Respiratory Protection",
  "Fall Protection Harness",
];

const permitOptions = [
  "Hot Work Permit",
  "Confined Space Permit",
  "LOTO Permit",
  "Ladder Permit",
  "AWP/MEWP Permit",
  "Trench Inspection Permit",
  "Chemical Permit",
  "Motion Permit",
  "Temperature Permit",
  "Gravity Permit",
];

const initialForm: CSEPForm = {
  project_name: "",
  project_number: "",
  project_address: "",
  owner_client: "",
  gc_cm: "",

  contractor_company: "",
  contractor_contact: "",
  contractor_phone: "",
  contractor_email: "",

  trade: "",
  scope_of_work: "",
  site_specific_notes: "",
  emergency_procedures: "",

  required_ppe: [],
  additional_permits: [],
};

const CSEP_TRADE_LIBRARY: CSEPTradeLibraryItem[] = [
  {
    trade: "Survey / Layout",
    sectionTitle: "Site-Specific Safety Requirements – Survey / Layout",
    summary:
      "Survey and layout activities expose workers to changing site conditions, uneven terrain, nearby equipment movement, overhead hazards, and utility-related hazards.",
    oshaRefs: [
      "OSHA 1926 Subpart E – PPE",
      "OSHA 1926 Subpart K – Electrical",
      "OSHA 1926 Subpart M – Fall Protection",
    ],
    defaultPPE: [
      "Hard Hat",
      "Safety Glasses",
      "High Visibility Vest",
      "Gloves",
      "Steel Toe Boots",
    ],
    items: [
      {
        activity: "Boundary survey",
        hazard: "Slips trips falls",
        risk: "High",
        controls: ["Housekeeping", "Anti-slip footwear"],
        permit: "None",
      },
      {
        activity: "Construction staking",
        hazard: "Struck by equipment",
        risk: "High",
        controls: ["Spotters", "Equipment alarms"],
        permit: "Motion Permit",
      },
      {
        activity: "Utility locating",
        hazard: "Falls from height",
        risk: "High",
        controls: ["Guardrails", "PFAS"],
        permit: "Ladder Permit",
      },
      {
        activity: "Elevation verification",
        hazard: "Electrical shock",
        risk: "High",
        controls: ["LOTO", "GFCI protection"],
        permit: "LOTO Permit",
      },
      {
        activity: "As-built survey",
        hazard: "Hot work / fire",
        risk: "Medium",
        controls: ["Fire watch", "Extinguishers"],
        permit: "Hot Work Permit",
      },
      {
        activity: "General survey support",
        hazard: "Falling objects",
        risk: "High",
        controls: ["Toe boards", "Overhead protection"],
        permit: "Gravity Permit",
      },
      {
        activity: "General survey support",
        hazard: "Crane lift hazards",
        risk: "Medium",
        controls: ["Lift plans", "Signal persons"],
        permit: "Motion Permit",
      },
      {
        activity: "General survey support",
        hazard: "Ladder misuse",
        risk: "Medium",
        controls: ["Ladder inspections"],
        permit: "Ladder Permit",
      },
      {
        activity: "General survey support",
        hazard: "Confined spaces",
        risk: "Medium",
        controls: ["Air monitoring"],
        permit: "Confined Space Permit",
      },
      {
        activity: "General survey support",
        hazard: "Chemical exposure",
        risk: "Medium",
        controls: ["PPE", "SDS review"],
        permit: "Chemical Permit",
      },
    ],
  },
  {
    trade: "Demolition",
    sectionTitle: "Site-Specific Safety Requirements – Demolition",
    summary:
      "Demolition activities expose workers to unstable materials, debris handling, heavy equipment interaction, electrical energy, dust generation, and falling object hazards.",
    oshaRefs: [
      "OSHA 1926 Subpart E – PPE",
      "OSHA 1926 Subpart K – Electrical",
      "OSHA 1926 Subpart M – Fall Protection",
    ],
    defaultPPE: [
      "Hard Hat",
      "Safety Glasses",
      "High Visibility Vest",
      "Gloves",
      "Steel Toe Boots",
      "Hearing Protection",
      "Respiratory Protection",
    ],
    items: [
      {
        activity: "Structural demolition",
        hazard: "Slips trips falls",
        risk: "High",
        controls: ["Housekeeping", "Anti-slip footwear"],
        permit: "None",
      },
      {
        activity: "Interior demolition",
        hazard: "Struck by equipment",
        risk: "High",
        controls: ["Spotters", "Equipment alarms"],
        permit: "Motion Permit",
      },
      {
        activity: "Concrete cutting",
        hazard: "Falls from height",
        risk: "High",
        controls: ["Guardrails", "PFAS"],
        permit: "Ladder Permit",
      },
      {
        activity: "Debris removal",
        hazard: "Electrical shock",
        risk: "High",
        controls: ["LOTO", "GFCI protection"],
        permit: "LOTO Permit",
      },
      {
        activity: "Selective demolition",
        hazard: "Hot work / fire",
        risk: "Medium",
        controls: ["Fire watch", "Extinguishers"],
        permit: "Hot Work Permit",
      },
      {
        activity: "General demolition support",
        hazard: "Falling objects",
        risk: "High",
        controls: ["Toe boards", "Overhead protection"],
        permit: "Gravity Permit",
      },
      {
        activity: "General demolition support",
        hazard: "Crane lift hazards",
        risk: "Medium",
        controls: ["Lift plans", "Signal persons"],
        permit: "Motion Permit",
      },
      {
        activity: "General demolition support",
        hazard: "Ladder misuse",
        risk: "Medium",
        controls: ["Ladder inspections"],
        permit: "Ladder Permit",
      },
      {
        activity: "General demolition support",
        hazard: "Confined spaces",
        risk: "Medium",
        controls: ["Air monitoring"],
        permit: "Confined Space Permit",
      },
      {
        activity: "General demolition support",
        hazard: "Chemical exposure",
        risk: "Medium",
        controls: ["PPE", "SDS review"],
        permit: "Chemical Permit",
      },
    ],
  },
  {
    trade: "Earthwork",
    sectionTitle: "Site-Specific Safety Requirements – Earthwork",
    summary:
      "Earthwork operations involve active equipment movement, unstable terrain, grading, compaction, hauling, and changing site conditions with frequent struck-by and slip hazards.",
    oshaRefs: [
      "OSHA 1926 Subpart E – PPE",
      "OSHA 1926 Subpart P – Excavations",
      "OSHA 1926 Subpart M – Fall Protection",
    ],
    defaultPPE: [
      "Hard Hat",
      "Safety Glasses",
      "High Visibility Vest",
      "Gloves",
      "Steel Toe Boots",
    ],
    items: [
      {
        activity: "Clearing and grubbing",
        hazard: "Slips trips falls",
        risk: "High",
        controls: ["Housekeeping", "Anti-slip footwear"],
        permit: "None",
      },
      {
        activity: "Rough grading",
        hazard: "Struck by equipment",
        risk: "High",
        controls: ["Spotters", "Equipment alarms"],
        permit: "Motion Permit",
      },
      {
        activity: "Site leveling",
        hazard: "Falls from height",
        risk: "High",
        controls: ["Guardrails", "PFAS"],
        permit: "Ladder Permit",
      },
      {
        activity: "Compaction",
        hazard: "Electrical shock",
        risk: "High",
        controls: ["LOTO", "GFCI protection"],
        permit: "LOTO Permit",
      },
      {
        activity: "Soil hauling",
        hazard: "Hot work / fire",
        risk: "Medium",
        controls: ["Fire watch", "Extinguishers"],
        permit: "Hot Work Permit",
      },
      {
        activity: "General earthwork support",
        hazard: "Falling objects",
        risk: "High",
        controls: ["Toe boards", "Overhead protection"],
        permit: "Gravity Permit",
      },
      {
        activity: "General earthwork support",
        hazard: "Crane lift hazards",
        risk: "Medium",
        controls: ["Lift plans", "Signal persons"],
        permit: "Motion Permit",
      },
      {
        activity: "General earthwork support",
        hazard: "Ladder misuse",
        risk: "Medium",
        controls: ["Ladder inspections"],
        permit: "Ladder Permit",
      },
      {
        activity: "General earthwork support",
        hazard: "Confined spaces",
        risk: "Medium",
        controls: ["Air monitoring"],
        permit: "Confined Space Permit",
      },
      {
        activity: "General earthwork support",
        hazard: "Chemical exposure",
        risk: "Medium",
        controls: ["PPE", "SDS review"],
        permit: "Chemical Permit",
      },
    ],
  },
  {
    trade: "Excavation / Utilities",
    sectionTitle: "Site-Specific Safety Requirements – Excavation / Utilities",
    summary:
      "Excavation and utility work exposes workers to trench hazards, underground utility strikes, equipment interaction, changing soil conditions, and confined-space related hazards.",
    oshaRefs: [
      "OSHA 1926 Subpart P – Excavations",
      "OSHA 1926 Subpart K – Electrical",
      "OSHA 1926 Subpart E – PPE",
    ],
    defaultPPE: [
      "Hard Hat",
      "Safety Glasses",
      "High Visibility Vest",
      "Gloves",
      "Steel Toe Boots",
    ],
    items: [
      {
        activity: "Trenching",
        hazard: "Slips trips falls",
        risk: "High",
        controls: ["Housekeeping", "Anti-slip footwear"],
        permit: "Trench Inspection Permit",
      },
      {
        activity: "Pipe installation",
        hazard: "Struck by equipment",
        risk: "High",
        controls: ["Spotters", "Equipment alarms"],
        permit: "Motion Permit",
      },
      {
        activity: "Manhole install",
        hazard: "Falls from height",
        risk: "High",
        controls: ["Guardrails", "PFAS"],
        permit: "Ladder Permit",
      },
      {
        activity: "Utility tie-ins",
        hazard: "Electrical shock",
        risk: "High",
        controls: ["LOTO", "GFCI protection"],
        permit: "LOTO Permit",
      },
      {
        activity: "Backfill and restoration",
        hazard: "Hot work / fire",
        risk: "Medium",
        controls: ["Fire watch", "Extinguishers"],
        permit: "Hot Work Permit",
      },
      {
        activity: "General excavation support",
        hazard: "Falling objects",
        risk: "High",
        controls: ["Toe boards", "Overhead protection"],
        permit: "Gravity Permit",
      },
      {
        activity: "General excavation support",
        hazard: "Crane lift hazards",
        risk: "Medium",
        controls: ["Lift plans", "Signal persons"],
        permit: "Motion Permit",
      },
      {
        activity: "General excavation support",
        hazard: "Ladder misuse",
        risk: "Medium",
        controls: ["Ladder inspections"],
        permit: "Ladder Permit",
      },
      {
        activity: "General excavation support",
        hazard: "Confined spaces",
        risk: "Medium",
        controls: ["Air monitoring"],
        permit: "Confined Space Permit",
      },
      {
        activity: "General excavation support",
        hazard: "Chemical exposure",
        risk: "Medium",
        controls: ["PPE", "SDS review"],
        permit: "Chemical Permit",
      },
    ],
  },
  {
    trade: "Concrete",
    sectionTitle: "Site-Specific Safety Requirements – Concrete",
    summary:
      "Concrete work involves formwork, placement, finishing, equipment interaction, wet surfaces, manual handling, and elevated work exposures.",
    oshaRefs: [
      "OSHA 1926 Subpart E – PPE",
      "OSHA 1926 Subpart M – Fall Protection",
      "OSHA 1926 Subpart L – Scaffolding",
    ],
    defaultPPE: [
      "Hard Hat",
      "Safety Glasses",
      "High Visibility Vest",
      "Gloves",
      "Steel Toe Boots",
      "Face Shield",
    ],
    items: [
      {
        activity: "Formwork installation",
        hazard: "Slips trips falls",
        risk: "High",
        controls: ["Housekeeping", "Anti-slip footwear"],
        permit: "None",
      },
      {
        activity: "Concrete placement",
        hazard: "Struck by equipment",
        risk: "High",
        controls: ["Spotters", "Equipment alarms"],
        permit: "Motion Permit",
      },
      {
        activity: "Slab edge work",
        hazard: "Falls from height",
        risk: "High",
        controls: ["Guardrails", "PFAS"],
        permit: "Ladder Permit",
      },
      {
        activity: "Power tools and cords",
        hazard: "Electrical shock",
        risk: "High",
        controls: ["LOTO", "GFCI protection"],
        permit: "LOTO Permit",
      },
      {
        activity: "Saw cutting / repairs",
        hazard: "Hot work / fire",
        risk: "Medium",
        controls: ["Fire watch", "Extinguishers"],
        permit: "Hot Work Permit",
      },
      {
        activity: "General concrete support",
        hazard: "Falling objects",
        risk: "High",
        controls: ["Toe boards", "Overhead protection"],
        permit: "Gravity Permit",
      },
      {
        activity: "General concrete support",
        hazard: "Crane lift hazards",
        risk: "Medium",
        controls: ["Lift plans", "Signal persons"],
        permit: "Motion Permit",
      },
      {
        activity: "General concrete support",
        hazard: "Ladder misuse",
        risk: "Medium",
        controls: ["Ladder inspections"],
        permit: "Ladder Permit",
      },
      {
        activity: "General concrete support",
        hazard: "Confined spaces",
        risk: "Medium",
        controls: ["Air monitoring"],
        permit: "Confined Space Permit",
      },
      {
        activity: "General concrete support",
        hazard: "Chemical exposure",
        risk: "Medium",
        controls: ["PPE", "SDS review"],
        permit: "Chemical Permit",
      },
    ],
  },
  {
    trade: "Roofing",
    sectionTitle: "Site-Specific Safety Requirements – Roofing",
    summary:
      "Roofing operations involve leading-edge work, falls from height, material handling, weather exposure, hot work, and falling object hazards.",
    oshaRefs: [
      "OSHA 1926 Subpart M – Fall Protection",
      "OSHA 1926 Subpart E – PPE",
      "OSHA 1926 Subpart L – Scaffolding",
    ],
    defaultPPE: [
      "Hard Hat",
      "Safety Glasses",
      "Gloves",
      "Steel Toe Boots",
      "Fall Protection Harness",
    ],
    items: [
      {
        activity: "Roof tear-off",
        hazard: "Slips trips falls",
        risk: "High",
        controls: ["Housekeeping", "Anti-slip footwear"],
        permit: "None",
      },
      {
        activity: "Material loading",
        hazard: "Struck by equipment",
        risk: "High",
        controls: ["Spotters", "Equipment alarms"],
        permit: "Motion Permit",
      },
      {
        activity: "Roof installation",
        hazard: "Falls from height",
        risk: "High",
        controls: ["Guardrails", "PFAS"],
        permit: "Ladder Permit",
      },
      {
        activity: "Temporary power use",
        hazard: "Electrical shock",
        risk: "High",
        controls: ["LOTO", "GFCI protection"],
        permit: "LOTO Permit",
      },
      {
        activity: "Torch/applied repairs",
        hazard: "Hot work / fire",
        risk: "Medium",
        controls: ["Fire watch", "Extinguishers"],
        permit: "Hot Work Permit",
      },
      {
        activity: "General roofing support",
        hazard: "Falling objects",
        risk: "High",
        controls: ["Toe boards", "Overhead protection"],
        permit: "Gravity Permit",
      },
      {
        activity: "General roofing support",
        hazard: "Crane lift hazards",
        risk: "Medium",
        controls: ["Lift plans", "Signal persons"],
        permit: "Motion Permit",
      },
      {
        activity: "General roofing support",
        hazard: "Ladder misuse",
        risk: "Medium",
        controls: ["Ladder inspections"],
        permit: "Ladder Permit",
      },
      {
        activity: "General roofing support",
        hazard: "Confined spaces",
        risk: "Medium",
        controls: ["Air monitoring"],
        permit: "Confined Space Permit",
      },
      {
        activity: "General roofing support",
        hazard: "Chemical exposure",
        risk: "Medium",
        controls: ["PPE", "SDS review"],
        permit: "Chemical Permit",
      },
    ],
  },
  {
    trade: "Electrical",
    sectionTitle: "Site-Specific Safety Requirements – Electrical",
    summary:
      "Electrical work exposes workers to energized systems, temporary power, overhead work, tool use, access equipment, and coordination with other active trades.",
    oshaRefs: [
      "OSHA 1926 Subpart K – Electrical",
      "OSHA 1926 Subpart E – PPE",
      "OSHA 1926 Subpart M – Fall Protection",
    ],
    defaultPPE: [
      "Hard Hat",
      "Safety Glasses",
      "Gloves",
      "Steel Toe Boots",
      "Face Shield",
    ],
    items: [
      {
        activity: "Conduit installation",
        hazard: "Slips trips falls",
        risk: "High",
        controls: ["Housekeeping", "Anti-slip footwear"],
        permit: "None",
      },
      {
        activity: "Material handling",
        hazard: "Struck by equipment",
        risk: "High",
        controls: ["Spotters", "Equipment alarms"],
        permit: "Motion Permit",
      },
      {
        activity: "Light fixture installation",
        hazard: "Falls from height",
        risk: "High",
        controls: ["Guardrails", "PFAS"],
        permit: "Ladder Permit",
      },
      {
        activity: "Panel work",
        hazard: "Electrical shock",
        risk: "High",
        controls: ["LOTO", "GFCI protection"],
        permit: "LOTO Permit",
      },
      {
        activity: "Equipment tie-ins",
        hazard: "Hot work / fire",
        risk: "Medium",
        controls: ["Fire watch", "Extinguishers"],
        permit: "Hot Work Permit",
      },
      {
        activity: "General electrical support",
        hazard: "Falling objects",
        risk: "High",
        controls: ["Toe boards", "Overhead protection"],
        permit: "Gravity Permit",
      },
      {
        activity: "General electrical support",
        hazard: "Crane lift hazards",
        risk: "Medium",
        controls: ["Lift plans", "Signal persons"],
        permit: "Motion Permit",
      },
      {
        activity: "General electrical support",
        hazard: "Ladder misuse",
        risk: "Medium",
        controls: ["Ladder inspections"],
        permit: "Ladder Permit",
      },
      {
        activity: "General electrical support",
        hazard: "Confined spaces",
        risk: "Medium",
        controls: ["Air monitoring"],
        permit: "Confined Space Permit",
      },
      {
        activity: "General electrical support",
        hazard: "Chemical exposure",
        risk: "Medium",
        controls: ["PPE", "SDS review"],
        permit: "Chemical Permit",
      },
    ],
  },
  {
    trade: "Mechanical / HVAC",
    sectionTitle: "Site-Specific Safety Requirements – Mechanical / HVAC",
    summary:
      "Mechanical and HVAC work involves material handling, duct and equipment installation, energized systems, elevated work, and coordination in active construction areas.",
    oshaRefs: [
      "OSHA 1926 Subpart E – PPE",
      "OSHA 1926 Subpart K – Electrical",
      "OSHA 1926 Subpart M – Fall Protection",
    ],
    defaultPPE: [
      "Hard Hat",
      "Safety Glasses",
      "High Visibility Vest",
      "Gloves",
      "Steel Toe Boots",
      "Hearing Protection",
    ],
    items: [
      {
        activity: "Duct installation",
        hazard: "Slips trips falls",
        risk: "High",
        controls: ["Housekeeping", "Anti-slip footwear"],
        permit: "None",
      },
      {
        activity: "Equipment setting",
        hazard: "Struck by equipment",
        risk: "High",
        controls: ["Spotters", "Equipment alarms"],
        permit: "Motion Permit",
      },
      {
        activity: "Overhead mechanical work",
        hazard: "Falls from height",
        risk: "High",
        controls: ["Guardrails", "PFAS"],
        permit: "Ladder Permit",
      },
      {
        activity: "Equipment connections",
        hazard: "Electrical shock",
        risk: "High",
        controls: ["LOTO", "GFCI protection"],
        permit: "LOTO Permit",
      },
      {
        activity: "Welding / brazing",
        hazard: "Hot work / fire",
        risk: "Medium",
        controls: ["Fire watch", "Extinguishers"],
        permit: "Hot Work Permit",
      },
      {
        activity: "General mechanical support",
        hazard: "Falling objects",
        risk: "High",
        controls: ["Toe boards", "Overhead protection"],
        permit: "Gravity Permit",
      },
      {
        activity: "General mechanical support",
        hazard: "Crane lift hazards",
        risk: "Medium",
        controls: ["Lift plans", "Signal persons"],
        permit: "Motion Permit",
      },
      {
        activity: "General mechanical support",
        hazard: "Ladder misuse",
        risk: "Medium",
        controls: ["Ladder inspections"],
        permit: "Ladder Permit",
      },
      {
        activity: "General mechanical support",
        hazard: "Confined spaces",
        risk: "Medium",
        controls: ["Air monitoring"],
        permit: "Confined Space Permit",
      },
      {
        activity: "General mechanical support",
        hazard: "Chemical exposure",
        risk: "Medium",
        controls: ["PPE", "SDS review"],
        permit: "Chemical Permit",
      },
    ],
  },
  {
    trade: "Plumbing",
    sectionTitle: "Site-Specific Safety Requirements – Plumbing",
    summary:
      "Plumbing work involves piping installation, overhead work, equipment interaction, energized systems, confined areas, and hot work exposure.",
    oshaRefs: [
      "OSHA 1926 Subpart E – PPE",
      "OSHA 1926 Subpart K – Electrical",
      "OSHA 1926 Subpart M – Fall Protection",
    ],
    defaultPPE: [
      "Hard Hat",
      "Safety Glasses",
      "Gloves",
      "Steel Toe Boots",
    ],
    items: [
      {
        activity: "Pipe rough-in",
        hazard: "Slips trips falls",
        risk: "High",
        controls: ["Housekeeping", "Anti-slip footwear"],
        permit: "None",
      },
      {
        activity: "Material delivery and staging",
        hazard: "Struck by equipment",
        risk: "High",
        controls: ["Spotters", "Equipment alarms"],
        permit: "Motion Permit",
      },
      {
        activity: "Overhead piping",
        hazard: "Falls from height",
        risk: "High",
        controls: ["Guardrails", "PFAS"],
        permit: "Ladder Permit",
      },
      {
        activity: "Pump or equipment connections",
        hazard: "Electrical shock",
        risk: "High",
        controls: ["LOTO", "GFCI protection"],
        permit: "LOTO Permit",
      },
      {
        activity: "Torch work / soldering",
        hazard: "Hot work / fire",
        risk: "Medium",
        controls: ["Fire watch", "Extinguishers"],
        permit: "Hot Work Permit",
      },
      {
        activity: "General plumbing support",
        hazard: "Falling objects",
        risk: "High",
        controls: ["Toe boards", "Overhead protection"],
        permit: "Gravity Permit",
      },
      {
        activity: "General plumbing support",
        hazard: "Crane lift hazards",
        risk: "Medium",
        controls: ["Lift plans", "Signal persons"],
        permit: "Motion Permit",
      },
      {
        activity: "General plumbing support",
        hazard: "Ladder misuse",
        risk: "Medium",
        controls: ["Ladder inspections"],
        permit: "Ladder Permit",
      },
      {
        activity: "General plumbing support",
        hazard: "Confined spaces",
        risk: "Medium",
        controls: ["Air monitoring"],
        permit: "Confined Space Permit",
      },
      {
        activity: "General plumbing support",
        hazard: "Chemical exposure",
        risk: "Medium",
        controls: ["PPE", "SDS review"],
        permit: "Chemical Permit",
      },
    ],
  },
  {
    trade: "Low Voltage",
    sectionTitle: "Site-Specific Safety Requirements – Low Voltage",
    summary:
      "Low voltage work includes data and security system installation, access equipment use, energized tie-ins, overhead work, and coordination in occupied or active spaces.",
    oshaRefs: [
      "OSHA 1926 Subpart K – Electrical",
      "OSHA 1926 Subpart E – PPE",
      "OSHA 1926 Subpart M – Fall Protection",
    ],
    defaultPPE: [
      "Hard Hat",
      "Safety Glasses",
      "Gloves",
      "Steel Toe Boots",
    ],
    items: [
      {
        activity: "Data cabling",
        hazard: "Slips trips falls",
        risk: "High",
        controls: ["Housekeeping", "Anti-slip footwear"],
        permit: "None",
      },
      {
        activity: "Camera install",
        hazard: "Struck by equipment",
        risk: "High",
        controls: ["Spotters", "Equipment alarms"],
        permit: "Motion Permit",
      },
      {
        activity: "Access control",
        hazard: "Falls from height",
        risk: "High",
        controls: ["Guardrails", "PFAS"],
        permit: "Ladder Permit",
      },
      {
        activity: "Security panels",
        hazard: "Electrical shock",
        risk: "High",
        controls: ["LOTO", "GFCI protection"],
        permit: "LOTO Permit",
      },
      {
        activity: "Network racks",
        hazard: "Hot work / fire",
        risk: "Medium",
        controls: ["Fire watch", "Extinguishers"],
        permit: "Hot Work Permit",
      },
      {
        activity: "General low voltage support",
        hazard: "Falling objects",
        risk: "High",
        controls: ["Toe boards", "Overhead protection"],
        permit: "Gravity Permit",
      },
      {
        activity: "General low voltage support",
        hazard: "Crane lift hazards",
        risk: "Medium",
        controls: ["Lift plans", "Signal persons"],
        permit: "Motion Permit",
      },
      {
        activity: "General low voltage support",
        hazard: "Ladder misuse",
        risk: "Medium",
        controls: ["Ladder inspections"],
        permit: "Ladder Permit",
      },
      {
        activity: "General low voltage support",
        hazard: "Confined spaces",
        risk: "Medium",
        controls: ["Air monitoring"],
        permit: "Confined Space Permit",
      },
      {
        activity: "General low voltage support",
        hazard: "Chemical exposure",
        risk: "Medium",
        controls: ["PPE", "SDS review"],
        permit: "Chemical Permit",
      },
    ],
  },
  {
    trade: "Elevator",
    sectionTitle: "Site-Specific Safety Requirements – Elevator",
    summary:
      "Elevator work involves shaft access, heavy material movement, energized systems, overhead installation, and falling object hazards in vertical construction areas.",
    oshaRefs: [
      "OSHA 1926 Subpart M – Fall Protection",
      "OSHA 1926 Subpart K – Electrical",
      "OSHA 1926 Subpart E – PPE",
    ],
    defaultPPE: [
      "Hard Hat",
      "Safety Glasses",
      "Gloves",
      "Steel Toe Boots",
      "Fall Protection Harness",
    ],
    items: [
      {
        activity: "Guide rail install",
        hazard: "Slips trips falls",
        risk: "High",
        controls: ["Housekeeping", "Anti-slip footwear"],
        permit: "None",
      },
      {
        activity: "Car install",
        hazard: "Struck by equipment",
        risk: "High",
        controls: ["Spotters", "Equipment alarms"],
        permit: "Motion Permit",
      },
      {
        activity: "Motor install",
        hazard: "Falls from height",
        risk: "High",
        controls: ["Guardrails", "PFAS"],
        permit: "Ladder Permit",
      },
      {
        activity: "Cable install",
        hazard: "Electrical shock",
        risk: "High",
        controls: ["LOTO", "GFCI protection"],
        permit: "LOTO Permit",
      },
      {
        activity: "Testing",
        hazard: "Hot work / fire",
        risk: "Medium",
        controls: ["Fire watch", "Extinguishers"],
        permit: "Hot Work Permit",
      },
      {
        activity: "General elevator support",
        hazard: "Falling objects",
        risk: "High",
        controls: ["Toe boards", "Overhead protection"],
        permit: "Gravity Permit",
      },
      {
        activity: "General elevator support",
        hazard: "Crane lift hazards",
        risk: "Medium",
        controls: ["Lift plans", "Signal persons"],
        permit: "Motion Permit",
      },
      {
        activity: "General elevator support",
        hazard: "Ladder misuse",
        risk: "Medium",
        controls: ["Ladder inspections"],
        permit: "Ladder Permit",
      },
      {
        activity: "General elevator support",
        hazard: "Confined spaces",
        risk: "Medium",
        controls: ["Air monitoring"],
        permit: "Confined Space Permit",
      },
      {
        activity: "General elevator support",
        hazard: "Chemical exposure",
        risk: "Medium",
        controls: ["PPE", "SDS review"],
        permit: "Chemical Permit",
      },
    ],
  },
  {
    trade: "Fire Protection",
    sectionTitle: "Site-Specific Safety Requirements – Fire Protection",
    summary:
      "Fire protection work includes sprinkler and standpipe installation, system tie-ins, testing, elevated work, and coordination with electrical and mechanical systems.",
    oshaRefs: [
      "OSHA 1926 Subpart E – PPE",
      "OSHA 1926 Subpart K – Electrical",
      "OSHA 1926 Subpart M – Fall Protection",
    ],
    defaultPPE: [
      "Hard Hat",
      "Safety Glasses",
      "Gloves",
      "Steel Toe Boots",
    ],
    items: [
      {
        activity: "Sprinkler install",
        hazard: "Slips trips falls",
        risk: "High",
        controls: ["Housekeeping", "Anti-slip footwear"],
        permit: "None",
      },
      {
        activity: "Standpipe install",
        hazard: "Struck by equipment",
        risk: "High",
        controls: ["Spotters", "Equipment alarms"],
        permit: "Motion Permit",
      },
      {
        activity: "System pressure testing",
        hazard: "Falls from height",
        risk: "High",
        controls: ["Guardrails", "PFAS"],
        permit: "Ladder Permit",
      },
      {
        activity: "Valve install",
        hazard: "Electrical shock",
        risk: "High",
        controls: ["LOTO", "GFCI protection"],
        permit: "LOTO Permit",
      },
      {
        activity: "Alarm tie-ins",
        hazard: "Hot work / fire",
        risk: "Medium",
        controls: ["Fire watch", "Extinguishers"],
        permit: "Hot Work Permit",
      },
      {
        activity: "General fire protection support",
        hazard: "Falling objects",
        risk: "High",
        controls: ["Toe boards", "Overhead protection"],
        permit: "Gravity Permit",
      },
      {
        activity: "General fire protection support",
        hazard: "Crane lift hazards",
        risk: "Medium",
        controls: ["Lift plans", "Signal persons"],
        permit: "Motion Permit",
      },
      {
        activity: "General fire protection support",
        hazard: "Ladder misuse",
        risk: "Medium",
        controls: ["Ladder inspections"],
        permit: "Ladder Permit",
      },
      {
        activity: "General fire protection support",
        hazard: "Confined spaces",
        risk: "Medium",
        controls: ["Air monitoring"],
        permit: "Confined Space Permit",
      },
      {
        activity: "General fire protection support",
        hazard: "Chemical exposure",
        risk: "Medium",
        controls: ["PPE", "SDS review"],
        permit: "Chemical Permit",
      },
    ],
  },
  {
    trade: "Landscaping",
    sectionTitle: "Site-Specific Safety Requirements – Landscaping",
    summary:
      "Landscaping work includes grading, irrigation, planting, hardscape work, equipment use, and frequent exposure to changing weather and site traffic.",
    oshaRefs: [
      "OSHA 1926 Subpart E – PPE",
      "OSHA 1926 Subpart K – Electrical",
      "OSHA 1926 Subpart M – Fall Protection",
    ],
    defaultPPE: [
      "Hard Hat",
      "Safety Glasses",
      "High Visibility Vest",
      "Gloves",
      "Steel Toe Boots",
    ],
    items: [
      {
        activity: "Planting",
        hazard: "Slips trips falls",
        risk: "High",
        controls: ["Housekeeping", "Anti-slip footwear"],
        permit: "None",
      },
      {
        activity: "Sod install",
        hazard: "Struck by equipment",
        risk: "High",
        controls: ["Spotters", "Equipment alarms"],
        permit: "Motion Permit",
      },
      {
        activity: "Irrigation install",
        hazard: "Falls from height",
        risk: "High",
        controls: ["Guardrails", "PFAS"],
        permit: "Ladder Permit",
      },
      {
        activity: "Grading",
        hazard: "Electrical shock",
        risk: "High",
        controls: ["LOTO", "GFCI protection"],
        permit: "LOTO Permit",
      },
      {
        activity: "Hardscape",
        hazard: "Hot work / fire",
        risk: "Medium",
        controls: ["Fire watch", "Extinguishers"],
        permit: "Hot Work Permit",
      },
      {
        activity: "General landscaping support",
        hazard: "Falling objects",
        risk: "High",
        controls: ["Toe boards", "Overhead protection"],
        permit: "Gravity Permit",
      },
      {
        activity: "General landscaping support",
        hazard: "Crane lift hazards",
        risk: "Medium",
        controls: ["Lift plans", "Signal persons"],
        permit: "Motion Permit",
      },
      {
        activity: "General landscaping support",
        hazard: "Ladder misuse",
        risk: "Medium",
        controls: ["Ladder inspections"],
        permit: "Ladder Permit",
      },
      {
        activity: "General landscaping support",
        hazard: "Confined spaces",
        risk: "Medium",
        controls: ["Air monitoring"],
        permit: "Confined Space Permit",
      },
      {
        activity: "General landscaping support",
        hazard: "Chemical exposure",
        risk: "Medium",
        controls: ["PPE", "SDS review"],
        permit: "Chemical Permit",
      },
    ],
  },
  {
    trade: "Asphalt / Paving",
    sectionTitle: "Site-Specific Safety Requirements – Asphalt / Paving",
    summary:
      "Asphalt and paving work involves heavy equipment, haul routes, compaction, hot materials, live traffic interface, and manual handling exposure.",
    oshaRefs: [
      "OSHA 1926 Subpart E – PPE",
      "OSHA 1926 Subpart M – Fall Protection",
      "OSHA 1926 Subpart K – Electrical",
    ],
    defaultPPE: [
      "Hard Hat",
      "Safety Glasses",
      "High Visibility Vest",
      "Gloves",
      "Steel Toe Boots",
    ],
    items: [
      {
        activity: "Subgrade prep",
        hazard: "Slips trips falls",
        risk: "High",
        controls: ["Housekeeping", "Anti-slip footwear"],
        permit: "None",
      },
      {
        activity: "Asphalt placement",
        hazard: "Struck by equipment",
        risk: "High",
        controls: ["Spotters", "Equipment alarms"],
        permit: "Motion Permit",
      },
      {
        activity: "Compaction",
        hazard: "Falls from height",
        risk: "High",
        controls: ["Guardrails", "PFAS"],
        permit: "Ladder Permit",
      },
      {
        activity: "Striping",
        hazard: "Electrical shock",
        risk: "High",
        controls: ["LOTO", "GFCI protection"],
        permit: "LOTO Permit",
      },
      {
        activity: "Parking lot paving",
        hazard: "Hot work / fire",
        risk: "Medium",
        controls: ["Fire watch", "Extinguishers"],
        permit: "Hot Work Permit",
      },
      {
        activity: "General paving support",
        hazard: "Falling objects",
        risk: "High",
        controls: ["Toe boards", "Overhead protection"],
        permit: "Gravity Permit",
      },
      {
        activity: "General paving support",
        hazard: "Crane lift hazards",
        risk: "Medium",
        controls: ["Lift plans", "Signal persons"],
        permit: "Motion Permit",
      },
      {
        activity: "General paving support",
        hazard: "Ladder misuse",
        risk: "Medium",
        controls: ["Ladder inspections"],
        permit: "Ladder Permit",
      },
      {
        activity: "General paving support",
        hazard: "Confined spaces",
        risk: "Medium",
        controls: ["Air monitoring"],
        permit: "Confined Space Permit",
      },
      {
        activity: "General paving support",
        hazard: "Chemical exposure",
        risk: "Medium",
        controls: ["PPE", "SDS review"],
        permit: "Chemical Permit",
      },
    ],
  },
  {
    trade: "Traffic Control",
    sectionTitle: "Site-Specific Safety Requirements – Traffic Control",
    summary:
      "Traffic control work involves active vehicle exposure, barricade installation, lane closures, signage work, and constant struck-by risk around public and site traffic.",
    oshaRefs: [
      "OSHA 1926 Subpart E – PPE",
      "OSHA 1926 Subpart M – Fall Protection",
      "OSHA 1926 Subpart K – Electrical",
    ],
    defaultPPE: [
      "Hard Hat",
      "Safety Glasses",
      "High Visibility Vest",
      "Gloves",
      "Steel Toe Boots",
    ],
    items: [
      {
        activity: "Flagging",
        hazard: "Slips trips falls",
        risk: "High",
        controls: ["Housekeeping", "Anti-slip footwear"],
        permit: "None",
      },
      {
        activity: "Barricade setup",
        hazard: "Struck by equipment",
        risk: "High",
        controls: ["Spotters", "Equipment alarms"],
        permit: "Motion Permit",
      },
      {
        activity: "Lane closures",
        hazard: "Falls from height",
        risk: "High",
        controls: ["Guardrails", "PFAS"],
        permit: "Ladder Permit",
      },
      {
        activity: "Traffic signage",
        hazard: "Electrical shock",
        risk: "High",
        controls: ["LOTO", "GFCI protection"],
        permit: "LOTO Permit",
      },
      {
        activity: "Detour routing",
        hazard: "Hot work / fire",
        risk: "Medium",
        controls: ["Fire watch", "Extinguishers"],
        permit: "Hot Work Permit",
      },
      {
        activity: "General traffic control support",
        hazard: "Falling objects",
        risk: "High",
        controls: ["Toe boards", "Overhead protection"],
        permit: "Gravity Permit",
      },
      {
        activity: "General traffic control support",
        hazard: "Crane lift hazards",
        risk: "Medium",
        controls: ["Lift plans", "Signal persons"],
        permit: "Motion Permit",
      },
      {
        activity: "General traffic control support",
        hazard: "Ladder misuse",
        risk: "Medium",
        controls: ["Ladder inspections"],
        permit: "Ladder Permit",
      },
      {
        activity: "General traffic control support",
        hazard: "Confined spaces",
        risk: "Medium",
        controls: ["Air monitoring"],
        permit: "Confined Space Permit",
      },
      {
        activity: "General traffic control support",
        hazard: "Chemical exposure",
        risk: "Medium",
        controls: ["PPE", "SDS review"],
        permit: "Chemical Permit",
      },
    ],
  },
];

function inputClassName() {
  return "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500";
}

function textareaClassName() {
  return "min-h-[120px] w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500";
}

export default function CSEPPage() {
  const [form, setForm] = useState<CSEPForm>(initialForm);
  const [loading, setLoading] = useState(false);

  const selectedTrade = useMemo(() => {
    return CSEP_TRADE_LIBRARY.find((item) => item.trade === form.trade) ?? null;
  }, [form.trade]);

  const derivedPermits = useMemo(() => {
    if (!selectedTrade) return [];
    return Array.from(
      new Set(
        selectedTrade.items
          .map((item) => item.permit)
          .filter((permit) => permit && permit !== "None")
      )
    );
  }, [selectedTrade]);

  const derivedHazards = useMemo(() => {
    if (!selectedTrade) return [];
    return Array.from(new Set(selectedTrade.items.map((item) => item.hazard)));
  }, [selectedTrade]);

  function updateField<K extends keyof CSEPForm>(field: K, value: CSEPForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleArrayValue(
    field: "required_ppe" | "additional_permits",
    value: string
  ) {
    setForm((prev) => {
      const current = prev[field];
      const exists = current.includes(value);

      return {
        ...prev,
        [field]: exists
          ? current.filter((item) => item !== value)
          : [...current, value],
      };
    });
  }

  function applyTradeDefaults() {
    if (!selectedTrade) return;

    setForm((prev) => ({
      ...prev,
      required_ppe: Array.from(
        new Set([...prev.required_ppe, ...selectedTrade.defaultPPE])
      ),
      additional_permits: Array.from(
        new Set([...prev.additional_permits, ...derivedPermits])
      ),
    }));
  }

  async function handleExport() {
    try {
      setLoading(true);

      const res = await fetch("/api/csep/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          tradeSummary: selectedTrade?.summary ?? "",
          oshaRefs: selectedTrade?.oshaRefs ?? [],
          tradeItems: selectedTrade?.items ?? [],
          derivedHazards,
          derivedPermits,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to generate CSEP.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = `${form.project_name || "Project"}_${form.trade || "CSEP"}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Failed to generate CSEP document.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-3xl bg-white p-6 shadow-lg md:p-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Contractor Site Specific Safety Plan (CSEP)
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Build a trade-specific CSEP with project data, contractor data,
            selected PPE, selected permits, and automatic activity / hazard /
            control content tied to the selected trade.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">
                Project Information
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <input
                  className={inputClassName()}
                  placeholder="Project Name"
                  value={form.project_name}
                  onChange={(e) => updateField("project_name", e.target.value)}
                />
                <input
                  className={inputClassName()}
                  placeholder="Project Number"
                  value={form.project_number}
                  onChange={(e) => updateField("project_number", e.target.value)}
                />
                <input
                  className={`${inputClassName()} md:col-span-2`}
                  placeholder="Project Address"
                  value={form.project_address}
                  onChange={(e) => updateField("project_address", e.target.value)}
                />
                <input
                  className={inputClassName()}
                  placeholder="Owner / Client"
                  value={form.owner_client}
                  onChange={(e) => updateField("owner_client", e.target.value)}
                />
                <input
                  className={inputClassName()}
                  placeholder="GC / CM"
                  value={form.gc_cm}
                  onChange={(e) => updateField("gc_cm", e.target.value)}
                />
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">
                Contractor Information
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <input
                  className={inputClassName()}
                  placeholder="Contractor Company"
                  value={form.contractor_company}
                  onChange={(e) =>
                    updateField("contractor_company", e.target.value)
                  }
                />
                <input
                  className={inputClassName()}
                  placeholder="Contractor Contact"
                  value={form.contractor_contact}
                  onChange={(e) =>
                    updateField("contractor_contact", e.target.value)
                  }
                />
                <input
                  className={inputClassName()}
                  placeholder="Contractor Phone"
                  value={form.contractor_phone}
                  onChange={(e) =>
                    updateField("contractor_phone", e.target.value)
                  }
                />
                <input
                  className={inputClassName()}
                  placeholder="Contractor Email"
                  value={form.contractor_email}
                  onChange={(e) =>
                    updateField("contractor_email", e.target.value)
                  }
                />
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Trade Selection
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Selecting a trade loads that trade’s default hazards,
                    activities, controls, and permit triggers.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={applyTradeDefaults}
                  disabled={!selectedTrade}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Apply Trade PPE / Permits
                </button>
              </div>

              <select
                className={inputClassName()}
                value={form.trade}
                onChange={(e) => updateField("trade", e.target.value)}
              >
                <option value="">Select Trade</option>
                {tradeOptions.map((trade) => (
                  <option key={trade} value={trade}>
                    {trade}
                  </option>
                ))}
              </select>

              {selectedTrade && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Auto-loaded Trade Summary
                  </h3>
                  <p className="mt-2 text-sm text-slate-700">
                    {selectedTrade.summary}
                  </p>
                </div>
              )}
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">
                Scope and Site Content
              </h2>

              <div className="grid gap-4">
                <textarea
                  className={textareaClassName()}
                  placeholder="Scope of Work"
                  value={form.scope_of_work}
                  onChange={(e) => updateField("scope_of_work", e.target.value)}
                />
                <textarea
                  className={textareaClassName()}
                  placeholder="Site Specific Notes"
                  value={form.site_specific_notes}
                  onChange={(e) =>
                    updateField("site_specific_notes", e.target.value)
                  }
                />
                <textarea
                  className={textareaClassName()}
                  placeholder="Emergency Procedures"
                  value={form.emergency_procedures}
                  onChange={(e) =>
                    updateField("emergency_procedures", e.target.value)
                  }
                />
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">
                Required PPE
              </h2>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {ppeOptions.map((item) => (
                  <label
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={form.required_ppe.includes(item)}
                      onChange={() => toggleArrayValue("required_ppe", item)}
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">
                Additional Permits
              </h2>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {permitOptions.map((item) => (
                  <label
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={form.additional_permits.includes(item)}
                      onChange={() =>
                        toggleArrayValue("additional_permits", item)
                      }
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </section>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleExport}
                disabled={loading}
                className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {loading ? "Generating..." : "Generate CSEP"}
              </button>

              <button
                type="button"
                onClick={() => setForm(initialForm)}
                className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset Form
              </button>
            </div>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-900">
                Live CSEP Preview
              </h2>

              <div className="mt-4 space-y-4 text-sm text-slate-700">
                <div>
                  <div className="font-semibold text-slate-900">Project</div>
                  <div>{form.project_name || "N/A"}</div>
                  <div>{form.project_number || "N/A"}</div>
                  <div>{form.project_address || "N/A"}</div>
                </div>

                <div>
                  <div className="font-semibold text-slate-900">Contractor</div>
                  <div>{form.contractor_company || "N/A"}</div>
                  <div>{form.contractor_contact || "N/A"}</div>
                  <div>{form.contractor_phone || "N/A"}</div>
                  <div>{form.contractor_email || "N/A"}</div>
                </div>

                <div>
                  <div className="font-semibold text-slate-900">Trade</div>
                  <div>{form.trade || "No trade selected"}</div>
                </div>

                <div>
                  <div className="font-semibold text-slate-900">Scope</div>
                  <div className="whitespace-pre-wrap">
                    {form.scope_of_work || "No scope entered."}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-900">
                OSHA References
              </h2>

              <div className="mt-4 space-y-2">
                {selectedTrade ? (
                  selectedTrade.oshaRefs.map((ref) => (
                    <div
                      key={ref}
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                    >
                      {ref}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    Select a trade to load OSHA references.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-900">
                Auto-Detected Hazards
              </h2>

              <div className="mt-4 flex flex-wrap gap-2">
                {derivedHazards.length ? (
                  derivedHazards.map((hazard) => (
                    <span
                      key={hazard}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {hazard}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    Select a trade to load hazards.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-900">
                Auto-Detected Permits
              </h2>

              <div className="mt-4 flex flex-wrap gap-2">
                {derivedPermits.length ? (
                  derivedPermits.map((permit) => (
                    <span
                      key={permit}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {permit}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    Select a trade to load permits.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-900">
                Trade Activity / Hazard Matrix
              </h2>

              <div className="mt-4 space-y-3">
                {selectedTrade ? (
                  selectedTrade.items.map((item, index) => (
                    <div
                      key={`${item.activity}-${item.hazard}-${index}`}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="text-sm font-semibold text-slate-900">
                        {item.activity}
                      </div>
                      <div className="mt-2 text-sm text-slate-700">
                        <span className="font-semibold">Hazard:</span>{" "}
                        {item.hazard}
                      </div>
                      <div className="text-sm text-slate-700">
                        <span className="font-semibold">Risk:</span> {item.risk}
                      </div>
                      <div className="text-sm text-slate-700">
                        <span className="font-semibold">Controls:</span>{" "}
                        {item.controls.join(", ")}
                      </div>
                      <div className="text-sm text-slate-700">
                        <span className="font-semibold">Permit:</span>{" "}
                        {item.permit}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    Select a trade to load the activity / hazard matrix.
                  </p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}