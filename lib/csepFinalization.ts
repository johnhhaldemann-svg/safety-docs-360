import type { GeneratedSafetyPlanSection } from "@/types/safety-intelligence";

const CONTROLLED_TBD = "TBD by contractor before issue";

const INTERNAL_PHRASE_PATTERNS = [
  /keep this section concise, customer-facing[^.]*\.?/gi,
  /use the front matter to orient field teams quickly[^.]*\.?/gi,
  /project-specific content will be completed with ai drafting and builder inputs where the platform has supporting data\.?/gi,
  /project-specific content will be completed during final contractor review\.?/gi,
  /the format package identified content that should stay visible in this section based on the current builder inputs\.?/gi,
  /ai final decision:\s*/gi,
  /platform-defined rule text/gi,
];

const INVALID_EXACT_TOKENS = new Set([
  "test",
  "pending approval",
  "null",
  "undefined",
  "[platform fill field]",
  "[fill]",
  "safetydocs360 ai draft builder",
  "safetydocs360 draft builder",
]);

const PERMIT_DEFINITIONS = [
  { id: "hot_work_permit", label: "Hot Work Permit", aliases: ["hot work", "hot work permit"] },
  {
    id: "elevated_work_notice",
    label: "Elevated Work Notice",
    aliases: ["elevated work notice", "ladder permit", "ladder permits", "elevated work", "work at height notice"],
  },
  { id: "lift_plan", label: "Lift Plan", aliases: ["lift plan", "critical lift plan", "crane lift plan"] },
  {
    id: "energized_electrical_permit",
    label: "Energized Electrical Permit",
    aliases: ["energized electrical permit", "electrical permit", "energized work permit"],
  },
  {
    id: "excavation_permit",
    label: "Ground Disturbance Permit",
    aliases: ["excavation permit", "ground disturbance permit", "groundbreaking/excavation"],
  },
  {
    id: "confined_space_permit",
    label: "Confined Space Permit",
    aliases: ["confined space permit", "confined space entry permit"],
  },
] as const;

const HAZARD_ALIASES: Record<string, string> = {
  "fall": "Fall Exposure",
  "falls": "Fall Exposure",
  "falls from height": "Fall Exposure",
  "fall exposure": "Fall Exposure",
  "fire": "Fire",
  "hot work": "Hot Work",
  "struck by": "Struck-By",
  "struck by equipment": "Struck-By",
  "line of fire": "Line of Fire",
  "falling object hazards": "Falling Objects",
  "falling objects": "Falling Objects",
  "rigging and lifting hazards": "Rigging and Lifting Hazards",
  "crane lift hazards": "Crane Lift Hazards",
};

const PPE_ALIASES: Record<string, string> = {
  "hard hat": "Hard Hat",
  "safety glasses": "Safety Glasses",
  "gloves": "Gloves",
  "high visibility vest": "High-Visibility Vest",
  "high visibility vests": "High-Visibility Vest",
  "hi vis vest": "High-Visibility Vest",
  "steel toe boots": "Steel-Toe Boots",
  "fall protection harness": "Fall Protection Harness",
  "harness": "Fall Protection Harness",
  "hearing protection": "Hearing Protection",
};

const INTERFACE_TRADE_TOKENS = [
  "fire protection",
  "hvac",
  "mechanical",
  "painting",
  "coatings",
  "electrical rough-in",
  "plumbing",
  "sprinkler",
];

function normalizeToken(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function cleanFinalText(value: string | null | undefined, options?: { allowTbd?: boolean }) {
  if (!value?.trim()) return null;

  let cleaned = value.trim();
  for (const pattern of INTERNAL_PHRASE_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }

  cleaned = cleaned
    .replace(/\[(platform fill field|fill)\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return options?.allowTbd ? CONTROLLED_TBD : null;

  if (INVALID_EXACT_TOKENS.has(cleaned.toLowerCase())) {
    return options?.allowTbd ? CONTROLLED_TBD : null;
  }

  return cleaned;
}

export function isMeaningfulFinalText(value: string | null | undefined) {
  const cleaned = cleanFinalText(value);
  return Boolean(cleaned && cleaned !== CONTROLLED_TBD);
}

function normalizeDisplayList(
  values: Array<string | null | undefined>,
  aliasMap: Record<string, string>
) {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of values) {
    const cleaned = cleanFinalText(raw);
    if (!cleaned) continue;
    const normalized = normalizeToken(cleaned);
    const display = aliasMap[normalized] ?? cleaned;
    const key = normalizeToken(display);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(display);
  }

  return out;
}

export function normalizeHazardList(values: Array<string | null | undefined>) {
  return normalizeDisplayList(values, HAZARD_ALIASES);
}

export function normalizePpeList(values: Array<string | null | undefined>) {
  return normalizeDisplayList(values, PPE_ALIASES);
}

export function normalizePermitList(values: Array<string | null | undefined>) {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of values) {
    const cleaned = cleanFinalText(raw);
    if (!cleaned) continue;
    const normalized = normalizeToken(cleaned);
    const permit =
      PERMIT_DEFINITIONS.find((item) => item.id === normalized) ??
      PERMIT_DEFINITIONS.find((item) =>
        item.aliases.some((alias) => normalizeToken(alias) === normalized)
      );
    const display = permit?.label ?? cleaned;
    const key = normalizeToken(display);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(display);
  }

  return out;
}

export function normalizeTaskList(values: Array<string | null | undefined>) {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of values) {
    const cleaned = cleanFinalText(raw);
    if (!cleaned) continue;
    const key = normalizeToken(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }

  return out;
}

export function splitScopeTasksAndInterfaces(values: Array<string | null | undefined>) {
  const activeTasks: string[] = [];
  const interfaceTrades: string[] = [];
  const seenActive = new Set<string>();
  const seenInterface = new Set<string>();

  for (const raw of values) {
    const cleaned = cleanFinalText(raw);
    if (!cleaned) continue;
    const normalized = normalizeToken(cleaned);
    const isInterface = INTERFACE_TRADE_TOKENS.some((token) => normalized.includes(token));

    if (isInterface) {
      if (!seenInterface.has(normalized)) {
        seenInterface.add(normalized);
        interfaceTrades.push(cleaned);
      }
      continue;
    }

    if (!seenActive.has(normalized)) {
      seenActive.add(normalized);
      activeTasks.push(cleaned);
    }
  }

  return { activeTasks, interfaceTrades };
}

export function cleanSectionForFinalIssue(
  section: GeneratedSafetyPlanSection
): GeneratedSafetyPlanSection | null {
  const title = cleanFinalText(section.title);
  if (!title) return null;

  const summary = cleanFinalText(section.summary);
  const body = cleanFinalText(section.body);
  const bullets = (section.bullets ?? [])
    .map((item) => cleanFinalText(item))
    .filter((item): item is string => Boolean(item));
  const subsections = (section.subsections ?? [])
    .map((subsection) => {
      const subsectionTitle = cleanFinalText(subsection.title);
      const subsectionBody = cleanFinalText(subsection.body);
      const subsectionBullets = subsection.bullets
        .map((item) => cleanFinalText(item))
        .filter((item): item is string => Boolean(item));

      if (!subsectionTitle && !subsectionBody && !subsectionBullets.length) {
        return null;
      }

      const cleanedSubsection: NonNullable<GeneratedSafetyPlanSection["subsections"]>[number] = {
        title: subsectionTitle ?? "Details",
        bullets: subsectionBullets,
      };

      if (subsectionBody) {
        cleanedSubsection.body = subsectionBody;
      }

      return cleanedSubsection;
    })
    .filter(
      (
        subsection
      ): subsection is NonNullable<GeneratedSafetyPlanSection["subsections"]>[number] =>
        Boolean(subsection)
    );
  const table = section.table
    ? {
        columns: section.table.columns
          .map((column) => cleanFinalText(column))
          .filter((column): column is string => Boolean(column)),
        rows: section.table.rows
          .map((row) =>
            row
              .map((cell) => cleanFinalText(cell, { allowTbd: true }))
              .filter((cell): cell is string => Boolean(cell))
          )
          .filter((row) => row.length > 0),
      }
    : null;

  if (!summary && !body && bullets.length === 0 && subsections.length === 0 && !table?.rows.length) {
    return null;
  }

  return {
    ...section,
    title,
    summary: summary ?? undefined,
    body: body ?? undefined,
    bullets: bullets.length ? bullets : undefined,
    subsections: subsections.length ? subsections : undefined,
    table:
      table && table.columns.length && table.rows.length
        ? table
        : null,
  };
}

export function controlledTbd() {
  return CONTROLLED_TBD;
}
