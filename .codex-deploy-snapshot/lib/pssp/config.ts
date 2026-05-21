// lib/pssp/config.ts

export type YesNo = "Yes" | "No";

export type PSSPForm = {
  // Basics
  projectName: string;
  projectNumber: string;
  projectAddress: string;

  // Example toggles (Yes/No)
  excavation: YesNo;
  hotWork: YesNo;
  workAtHeights: YesNo;

  // Example custom answers
  maxExcavDepthFt?: string;
  hotWorkPermitAuthority?: string;
};

export type Block = {
  id: string;
  title: string;
  body: string;
};

export type Rule = {
  id: string;
  when: (f: PSSPForm) => boolean;
  blocks: (f: PSSPForm) => Block[];
};

export const rules: Rule[] = [
  {
    id: "excavation",
    when: (f) => f.excavation === "Yes",
    blocks: (f) => [
      {
        id: "excavation.overview",
        title: "Excavation and Trenching",
        body:
          `All excavation and trenching activities will comply with OSHA 29 CFR 1926 Subpart P. ` +
          `A competent person will inspect excavations daily and as conditions change. ` +
          `Estimated maximum depth: ${f.maxExcavDepthFt?.trim() ? f.maxExcavDepthFt.trim() : "____"} ft. ` +
          `Protective systems (sloping, shoring, shielding) will be used as required based on soil classification and depth.`,
      },
    ],
  },
  {
    id: "hotWork",
    when: (f) => f.hotWork === "Yes",
    blocks: (f) => [
      {
        id: "hotwork.overview",
        title: "Hot Work",
        body:
          `Hot work (cutting, welding, grinding, torch use) is permitted only with an approved Hot Work Permit. ` +
          `Permit authority: ${f.hotWorkPermitAuthority?.trim() ? f.hotWorkPermitAuthority.trim() : "________________"}. ` +
          `Fire watch will be provided when required by permit conditions and site rules. Combustibles will be protected or removed.`,
      },
    ],
  },
  {
    id: "wah",
    when: (f) => f.workAtHeights === "Yes",
    blocks: () => [
      {
        id: "wah.overview",
        title: "Work at Heights / Fall Protection",
        body:
          `Fall protection will be used whenever workers are exposed to falls of 6 feet or greater unless a more stringent site rule applies. ` +
          `Approved systems include guardrails, personal fall arrest, and safety netting as applicable. ` +
          `Equipment will be inspected prior to use and removed from service if damaged.`,
      },
    ],
  },
];