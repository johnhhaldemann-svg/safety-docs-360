/**
 * Certification catalog for construction profiles and training requirements.
 * Keep in sync with what users can select on the profile page.
 */
export type ProfileCertificationGroup = {
  title: string;
  items: readonly string[];
};

export const PROFILE_CERTIFICATION_GROUPS: ProfileCertificationGroup[] = [
  {
    title: "Core Safety Certifications",
    items: [
      "CSP - Certified Safety Professional",
      "ASP - Associate Safety Professional",
      "GSP - Graduate Safety Practitioner",
      "SMS - Safety Management Specialist",
      "STS - Safety Trained Supervisor",
      "STSC - Safety Trained Supervisor Construction",
      "CHST - Construction Health & Safety Technician",
      "OHST - Occupational Health & Safety Technician",
    ],
  },
  {
    title: "OSHA & General Safety Training",
    items: [
      "OSHA 10-Hour (Construction / General Industry)",
      "OSHA 30-Hour (Construction / General Industry)",
      "OSHA 500 - Construction Trainer",
      "OSHA 501 - General Industry Trainer",
      "OSHA 510 - Construction Standards",
      "OSHA 511 - General Industry Standards",
    ],
  },
  {
    title: "Environmental / Health / Industrial Hygiene",
    items: [
      "CIH - Certified Industrial Hygienist",
      "CHMM - Certified Hazardous Materials Manager",
      "REM - Registered Environmental Manager",
      "HAZWOPER 40-Hour",
      "HAZWOPER 24-Hour",
      "HAZWOPER Refresher",
    ],
  },
  {
    title: "Fire / Emergency Response",
    items: [
      "CFPS - Certified Fire Protection Specialist",
      "Fire Inspector I / II",
      "Fire Instructor I / II",
      "Emergency Medical Responder (EMR)",
      "EMT / Paramedic",
      "CPR / AED / First Aid",
    ],
  },
  {
    title: "Construction-Specific / Field Safety",
    items: [
      "NCCER Safety Certification",
      "Competent Person (Trenching & Excavation)",
      "Competent Person (Fall Protection)",
      "Competent Person (Scaffolding)",
      "Competent Person (Confined Space)",
      "Site Safety Health Officer (SSHO - USACE)",
      "Site Safety Manager (NYC DOB)",
      "Crane Signal Person",
      "Rigger Level I / II",
    ],
  },
  {
    title: "Equipment & Operator Certifications",
    items: [
      "Forklift Certification",
      "Aerial Lift / MEWP Certification",
      "Crane Operator Certification (NCCCO)",
      "Heavy Equipment Operator Certifications",
      "Telehandler Certification",
    ],
  },
  {
    title: "Specialized Safety Programs",
    items: [
      "LOTO Authorized Employee",
      "Confined Space Entry Supervisor",
      "Confined Space Entrant / Attendant",
      "Fall Protection Competent Person",
      "Electrical Qualified Person (NFPA 70E)",
      "Arc Flash Training",
      "Hot Work / Fire Watch Training",
    ],
  },
  {
    title: "Transportation / DOT",
    items: [
      "CDL (Class A / B)",
      "DOT Trainer Certification",
      "Smith System Driver Trainer",
      "Defensive Driving Instructor",
      "FMCSA Compliance Certification",
    ],
  },
  {
    title: "Management / Systems / Auditing",
    items: [
      "ISO 45001 Lead Auditor",
      "ISO 14001 Lead Auditor",
      "ISO 9001 Lead Auditor",
      "Six Sigma (Yellow / Green / Black Belt)",
      "Lean Certification",
      "Risk Management Professional (PMI-RMP)",
    ],
  },
  {
    title: "Additional Training",
    items: [
      "First Aid Instructor",
      "OSHA Outreach Instructor",
      "Safety Committee Certification",
      "Human Performance / HOP Training",
      "Behavior-Based Safety (BBS) Training",
    ],
  },
];

export const PROFILE_CERTIFICATION_SET = new Set(
  PROFILE_CERTIFICATION_GROUPS.flatMap((g) => [...g.items])
);
