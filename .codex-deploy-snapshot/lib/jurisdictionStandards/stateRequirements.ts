import { US_STATE_OPTIONS } from "@/lib/injuryWeather/locationWeather";
import requirementsDataset from "@/lib/jurisdictionStandards/us-state-requirements.json";

type StateRequirementEntry = {
  abbreviation: string;
  building_code?: {
    authority?: string;
    residential?: string;
    commercial?: string;
    energy?: string;
    enforcement?: string;
  };
  stormwater?: {
    threshold?: string;
    agency?: string;
    permit?: string;
    notes?: string;
  };
  wetlands?: {
    agency?: string;
    notes?: string;
  };
  other_key_permits?: string[];
  official_resources?: string[];
  notes?: string;
};

type StateRequirementsDataset = {
  metadata?: {
    last_updated?: string;
    usage_note?: string;
  };
  national_defaults?: {
    enforcement_note?: string;
  };
  states?: Record<string, StateRequirementEntry>;
};

const dataset = requirementsDataset as StateRequirementsDataset;

const STATE_NAME_BY_CODE = new Map(US_STATE_OPTIONS.map((item) => [item.code, item.name]));
const STATE_REQUIREMENT_BY_CODE = new Map(
  Object.entries(dataset.states ?? {}).flatMap(([stateName, entry]) => {
    const code = entry.abbreviation?.trim().toUpperCase();
    if (!code) {
      return [];
    }

    return [[code, { stateName, entry }] as const];
  })
);

function sentence(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function joinSentences(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => sentence(part))
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

function normalizeStateCode(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized && STATE_NAME_BY_CODE.has(normalized) ? normalized : null;
}

export function getStateRequirementSupplement(stateCode: string | null | undefined) {
  const normalized = normalizeStateCode(stateCode);
  if (!normalized) {
    return null;
  }

  const state = STATE_REQUIREMENT_BY_CODE.get(normalized);
  if (!state) {
    return null;
  }

  const stateName = state.stateName;
  const { building_code, stormwater, wetlands, other_key_permits } = state.entry;
  const body = joinSentences([
    `${stateName} state-specific building, environmental, and permit requirements may apply to this project`,
  ]);

  const bullets = [
    joinSentences([
      `Building code authority: ${building_code?.authority ?? "Verify with the authority having jurisdiction"}`,
      building_code?.residential ? `Residential: ${building_code.residential}` : null,
      building_code?.commercial ? `Commercial: ${building_code.commercial}` : null,
      building_code?.energy ? `Energy: ${building_code.energy}` : null,
      building_code?.enforcement ? `Enforcement: ${building_code.enforcement}` : null,
    ]),
    joinSentences([
      stormwater?.threshold ? `Stormwater threshold: ${stormwater.threshold}` : null,
      stormwater?.agency ? `Agency: ${stormwater.agency}` : null,
      stormwater?.permit ? `Permit: ${stormwater.permit}` : null,
      stormwater?.notes,
    ]),
    joinSentences([
      wetlands?.agency ? `Wetlands and water coordination: ${wetlands.agency}` : null,
      wetlands?.notes,
    ]),
    other_key_permits?.length
      ? `Other key permits: ${other_key_permits.map((item) => item.trim()).filter(Boolean).join("; ")}.`
      : null,
  ].filter((item): item is string => Boolean(item));

  return {
    stateName,
    stateCode: normalized,
    body,
    bullets,
  };
}
