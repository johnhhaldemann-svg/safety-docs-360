import type {
  SafePredictTrainingCellState,
  SafePredictTrainingMatrix,
  SafePredictTrainingMatrixRow,
  SafePredictTrainingRequirement,
} from "@/lib/safePredictData";
import type { SafePredictDemoEmployeeStatus } from "@/lib/safePredictMockData";

export type SafePredictTrainingWorkerSummary = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: SafePredictDemoEmployeeStatus;
  detail: string;
};

export type SafePredictTrainingRequirementGroup = {
  id: string;
  title: string;
  trades: string[];
  positions: string[];
  subTrades: string[];
  taskCodes: string[];
  workers: number;
  overdueCount: number;
  expiringCount: number;
  compliantCount: number;
  overdueWorkers: SafePredictTrainingWorkerSummary[];
  expiringWorkers: SafePredictTrainingWorkerSummary[];
  compliantWorkers: SafePredictTrainingWorkerSummary[];
  overallStatus: SafePredictDemoEmployeeStatus;
};

export type SafePredictTrainingTradeGroup = {
  trade: string;
  workers: number;
  requirements: SafePredictTrainingRequirementGroup[];
  overdueCount: number;
  expiringCount: number;
  compliantCount: number;
  overallStatus: "Compliant" | "Expiring" | "Overdue";
};

export type SafePredictTrainingPersonStatus = "gap" | "expiring" | "compliant" | "not_applicable";

export type SafePredictTrainingPersonSummary = {
  id: string;
  name: string;
  email: string;
  trade: string;
  position: string;
  portalType: "licensed_user" | "tracked_employee";
  portalLabel: string;
  status: SafePredictTrainingPersonStatus;
  statusLabel: string;
  gapCount: number;
  expiringCount: number;
  compliantCount: number;
  notApplicableCount: number;
};

export type SafePredictTrainingRosterTotals = {
  people: number;
  licensedUsers: number;
  trackedWorkers: number;
  peopleWithGaps: number;
  peopleExpiring: number;
};

function clean(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function normalizeCellState(value: unknown): SafePredictTrainingCellState {
  return value === "match" || value === "na" ? value : "gap";
}

function normalizePersonType(row: SafePredictTrainingMatrixRow): "licensed_user" | "tracked_employee" {
  if (row.personType === "tracked_employee" || row.trackedEmployeeId) return "tracked_employee";
  return "licensed_user";
}

export function safePredictTrainingPortalLabel(row: SafePredictTrainingMatrixRow) {
  return normalizePersonType(row) === "tracked_employee" ? "Tracked worker / no portal access" : "Licensed user";
}

function workerId(row: SafePredictTrainingMatrixRow) {
  return clean(row.trackedEmployeeId, clean(row.userId, clean(row.email, row.name ?? "worker")));
}

function workerSummary(
  row: SafePredictTrainingMatrixRow,
  status: SafePredictDemoEmployeeStatus,
  detail: string
): SafePredictTrainingWorkerSummary {
  return {
    id: workerId(row),
    name: clean(row.name, "Unnamed worker"),
    email: clean(row.email, ""),
    role: clean(row.profileFields?.jobTitle, clean(row.role, "Worker")),
    status,
    detail,
  };
}

function workerStatusForRequirement(
  row: SafePredictTrainingMatrixRow,
  requirement: SafePredictTrainingRequirement
): SafePredictTrainingWorkerSummary | null {
  const cellState = normalizeCellState(row.cells?.[requirement.id]);
  if (cellState === "na") return null;

  const detail = row.cellDetails?.[requirement.id];
  if (cellState === "gap" || detail?.expiryStatus === "expired") {
    const missing = detail?.gapKeywords?.filter(Boolean).join(", ");
    return workerSummary(row, "overdue", missing ? `Needs ${missing}` : "Missing required training");
  }

  if (detail?.expiryStatus === "soon") {
    const matched = detail.matchedLabel?.trim() || requirement.title;
    const suffix = detail.expiresOn ? ` expires ${detail.expiresOn}` : " expires soon";
    return workerSummary(row, "expiring", `${matched}${suffix}`);
  }

  const matched = detail?.matchedLabel?.trim();
  return workerSummary(row, "compliant", matched ? `Met by ${matched}` : "Requirement met");
}

function requirementStatus(params: { overdueCount: number; expiringCount: number }): SafePredictDemoEmployeeStatus {
  if (params.overdueCount > 0) return "overdue";
  if (params.expiringCount > 0) return "expiring";
  return "compliant";
}

function overallLabel(status: SafePredictDemoEmployeeStatus): SafePredictTrainingTradeGroup["overallStatus"] {
  if (status === "overdue") return "Overdue";
  if (status === "expiring") return "Expiring";
  return "Compliant";
}

function sortRequirements(
  left: SafePredictTrainingRequirementGroup,
  right: SafePredictTrainingRequirementGroup
) {
  return (
    right.overdueCount - left.overdueCount ||
    right.expiringCount - left.expiringCount ||
    left.title.localeCompare(right.title)
  );
}

function sortTrades(left: SafePredictTrainingTradeGroup, right: SafePredictTrainingTradeGroup) {
  return (
    right.overdueCount - left.overdueCount ||
    right.expiringCount - left.expiringCount ||
    left.trade.localeCompare(right.trade)
  );
}

function personStatusRank(status: SafePredictTrainingPersonStatus) {
  if (status === "gap") return 0;
  if (status === "expiring") return 1;
  if (status === "compliant") return 2;
  return 3;
}

export function summarizeSafePredictTrainingPerson(
  row: SafePredictTrainingMatrixRow,
  requirements: SafePredictTrainingRequirement[]
): SafePredictTrainingPersonSummary {
  let gapCount = 0;
  let expiringCount = 0;
  let compliantCount = 0;
  let notApplicableCount = 0;

  for (const requirement of requirements) {
    const state = normalizeCellState(row.cells?.[requirement.id]);
    const detail = row.cellDetails?.[requirement.id];
    if (state === "na") {
      notApplicableCount += 1;
    } else if (state === "gap" || detail?.expiryStatus === "expired") {
      gapCount += 1;
    } else if (detail?.expiryStatus === "soon") {
      expiringCount += 1;
    } else {
      compliantCount += 1;
    }
  }

  const status: SafePredictTrainingPersonStatus =
    gapCount > 0
      ? "gap"
      : expiringCount > 0
        ? "expiring"
        : compliantCount > 0
          ? "compliant"
          : "not_applicable";
  const portalType = normalizePersonType(row);

  return {
    id: workerId(row),
    name: clean(row.name, "Unnamed worker"),
    email: clean(row.email, "No email"),
    trade: clean(row.profileFields?.tradeSpecialty, "Unspecified trade"),
    position: clean(row.profileFields?.jobTitle, clean(row.role, "Worker")),
    portalType,
    portalLabel: portalType === "tracked_employee" ? "Tracked worker / no portal access" : "Licensed user",
    status,
    statusLabel:
      status === "gap"
        ? "Overdue / missing"
        : status === "expiring"
          ? "Expiring"
          : status === "compliant"
            ? "Compliant"
            : "Not applicable",
    gapCount,
    expiringCount,
    compliantCount,
    notApplicableCount,
  };
}

export function buildSafePredictTrainingPeopleRoster(
  trainingMatrix: SafePredictTrainingMatrix
): SafePredictTrainingPersonSummary[] {
  return trainingMatrix.rows
    .map((row) => summarizeSafePredictTrainingPerson(row, trainingMatrix.requirements))
    .sort(
      (left, right) =>
        personStatusRank(left.status) - personStatusRank(right.status) ||
        left.name.localeCompare(right.name)
    );
}

export function summarizeSafePredictTrainingRoster(
  people: SafePredictTrainingPersonSummary[]
): SafePredictTrainingRosterTotals {
  return {
    people: people.length,
    licensedUsers: people.filter((person) => person.portalType === "licensed_user").length,
    trackedWorkers: people.filter((person) => person.portalType === "tracked_employee").length,
    peopleWithGaps: people.filter((person) => person.gapCount > 0).length,
    peopleExpiring: people.filter((person) => person.expiringCount > 0).length,
  };
}

export function buildSafePredictTrainingTradeGroups(
  trainingMatrix: SafePredictTrainingMatrix
): SafePredictTrainingTradeGroup[] {
  if (trainingMatrix.requirements.length === 0 || trainingMatrix.rows.length === 0) return [];

  const rowsByTrade = new Map<string, SafePredictTrainingMatrixRow[]>();
  for (const row of trainingMatrix.rows) {
    const trade = clean(row.profileFields?.tradeSpecialty, "Unspecified trade");
    rowsByTrade.set(trade, [...(rowsByTrade.get(trade) ?? []), row]);
  }

  const groups: SafePredictTrainingTradeGroup[] = [];
  for (const [trade, rows] of rowsByTrade.entries()) {
    const requirements = trainingMatrix.requirements.flatMap((requirement) => {
      const workers = rows
        .map((row) => workerStatusForRequirement(row, requirement))
        .filter((worker): worker is SafePredictTrainingWorkerSummary => Boolean(worker));

      if (workers.length === 0) return [];

      const overdueWorkers = workers.filter((worker) => worker.status === "overdue");
      const expiringWorkers = workers.filter((worker) => worker.status === "expiring");
      const compliantWorkers = workers.filter((worker) => worker.status === "compliant");
      const overallStatus = requirementStatus({
        overdueCount: overdueWorkers.length,
        expiringCount: expiringWorkers.length,
      });

      return [
        {
          id: requirement.id,
          title: requirement.title,
          trades: requirement.applyTrades ?? [],
          positions: requirement.applyPositions ?? [],
          subTrades: requirement.applySubTrades ?? [],
          taskCodes: requirement.applyTaskCodes ?? [],
          workers: workers.length,
          overdueCount: overdueWorkers.length,
          expiringCount: expiringWorkers.length,
          compliantCount: compliantWorkers.length,
          overdueWorkers,
          expiringWorkers,
          compliantWorkers,
          overallStatus,
        },
      ];
    });

    if (requirements.length === 0) continue;

    const overdueCount = requirements.reduce((total, requirement) => total + requirement.overdueCount, 0);
    const expiringCount = requirements.reduce((total, requirement) => total + requirement.expiringCount, 0);
    const compliantCount = requirements.reduce((total, requirement) => total + requirement.compliantCount, 0);
    const status = requirementStatus({ overdueCount, expiringCount });

    groups.push({
      trade,
      workers: rows.length,
      requirements: requirements.sort(sortRequirements),
      overdueCount,
      expiringCount,
      compliantCount,
      overallStatus: overallLabel(status),
    });
  }

  return groups.sort(sortTrades);
}
