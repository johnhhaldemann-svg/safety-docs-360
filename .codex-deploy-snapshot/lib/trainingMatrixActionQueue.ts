export type TrainingMatrixQueueCellState = "match" | "gap" | "na";

export type TrainingMatrixQueueActionType =
  | "expired"
  | "gap"
  | "expiring_soon"
  | "missing_expiry";

export type TrainingMatrixQueueRequirement = {
  id: string;
  title: string;
};

export type TrainingMatrixQueueCellDetail = {
  state?: TrainingMatrixQueueCellState;
  matchSource?: string;
  matchedLabel?: string;
  expiresOn?: string | null;
  daysUntilExpiry?: number | null;
  expiryStatus?: "none" | "ok" | "soon" | "expired";
  gapKeywords?: string[];
};

export type TrainingMatrixQueueCredential = {
  name: string;
  expiresOn: string | null;
  daysUntilExpiry: number | null;
  expiryStatus: "none" | "ok" | "soon" | "expired";
};

export type TrainingMatrixQueueRow = {
  userId: string;
  name: string;
  email: string;
  cells: Record<string, TrainingMatrixQueueCellState | string>;
  cellDetails?: Record<string, TrainingMatrixQueueCellDetail>;
  certificationInventory?: TrainingMatrixQueueCredential[];
  profileFields: {
    tradeSpecialty: string;
    jobTitle: string;
  };
};

export type TrainingMatrixActionQueueItem = {
  id: string;
  userId: string;
  person: string;
  email: string;
  trade: string;
  position: string;
  actionType: TrainingMatrixQueueActionType;
  requirementId: string | null;
  requirementTitle: string | null;
  certification: string;
  status: string;
  expiresOn: string | null;
  daysUntilExpiry: number | null;
  suggestedNextStep: string;
  priority: number;
};

export type TrainingMatrixActionQueueFilters = {
  actionType?: TrainingMatrixQueueActionType | "all" | "";
  trade?: string;
  requirementId?: string;
  search?: string;
};

const ACTION_PRIORITY: Record<TrainingMatrixQueueActionType, number> = {
  expired: 1,
  gap: 2,
  expiring_soon: 3,
  missing_expiry: 4,
};

function cellState(row: TrainingMatrixQueueRow, reqId: string): TrainingMatrixQueueCellState {
  const s = row.cells[reqId] ?? "gap";
  if (s === "match" || s === "gap" || s === "na") return s;
  return "gap";
}

function clean(value: string | null | undefined, fallback = ""): string {
  return value?.trim() || fallback;
}

function queueSort(
  left: TrainingMatrixActionQueueItem,
  right: TrainingMatrixActionQueueItem
): number {
  return (
    left.priority - right.priority ||
    (left.daysUntilExpiry ?? Number.POSITIVE_INFINITY) -
      (right.daysUntilExpiry ?? Number.POSITIVE_INFINITY) ||
    left.person.localeCompare(right.person) ||
    left.certification.localeCompare(right.certification)
  );
}

export function buildTrainingMatrixActionQueue(
  rows: TrainingMatrixQueueRow[],
  requirements: TrainingMatrixQueueRequirement[]
): TrainingMatrixActionQueueItem[] {
  const out: TrainingMatrixActionQueueItem[] = [];

  for (const row of rows) {
    const person = clean(row.name, "Unknown person");
    const trade = clean(row.profileFields.tradeSpecialty, "Unspecified trade");
    const position = clean(row.profileFields.jobTitle, "Unspecified position");

    for (const cert of row.certificationInventory ?? []) {
      if (cert.expiryStatus !== "expired") continue;
      out.push({
        id: `${row.userId}:expired:${cert.name}`,
        userId: row.userId,
        person,
        email: row.email,
        trade,
        position,
        actionType: "expired",
        requirementId: null,
        requirementTitle: null,
        certification: cert.name,
        status: cert.expiresOn ? `Expired ${cert.expiresOn}` : "Expired",
        expiresOn: cert.expiresOn,
        daysUntilExpiry: cert.daysUntilExpiry,
        suggestedNextStep: "Renew the credential or update the profile with a current record.",
        priority: ACTION_PRIORITY.expired,
      });
    }

    for (const req of requirements) {
      const state = cellState(row, req.id);
      if (state === "na") continue;

      const detail = row.cellDetails?.[req.id];
      if (state === "gap") {
        const keywords = detail?.gapKeywords?.filter(Boolean).join(", ");
        out.push({
          id: `${row.userId}:gap:${req.id}`,
          userId: row.userId,
          person,
          email: row.email,
          trade,
          position,
          actionType: "gap",
          requirementId: req.id,
          requirementTitle: req.title,
          certification: keywords || req.title,
          status: "Missing in-scope requirement",
          expiresOn: null,
          daysUntilExpiry: null,
          suggestedNextStep: "Add matching training to the worker profile or update the requirement scope.",
          priority: ACTION_PRIORITY.gap,
        });
      } else if (detail?.matchSource === "certifications" && detail.expiryStatus === "soon") {
        out.push({
          id: `${row.userId}:soon:${req.id}`,
          userId: row.userId,
          person,
          email: row.email,
          trade,
          position,
          actionType: "expiring_soon",
          requirementId: req.id,
          requirementTitle: req.title,
          certification: clean(detail.matchedLabel, req.title),
          status: "Expiring soon",
          expiresOn: detail.expiresOn ?? null,
          daysUntilExpiry: detail.daysUntilExpiry ?? null,
          suggestedNextStep: "Schedule renewal and update the profile before the expiration date.",
          priority: ACTION_PRIORITY.expiring_soon,
        });
      } else if (detail?.matchSource === "certifications" && detail.expiryStatus === "none") {
        out.push({
          id: `${row.userId}:missing-expiry:${req.id}`,
          userId: row.userId,
          person,
          email: row.email,
          trade,
          position,
          actionType: "missing_expiry",
          requirementId: req.id,
          requirementTitle: req.title,
          certification: clean(detail.matchedLabel, req.title),
          status: "No expiration date on file",
          expiresOn: null,
          daysUntilExpiry: null,
          suggestedNextStep: "Add the credential expiration date so renewal risk can be tracked.",
          priority: ACTION_PRIORITY.missing_expiry,
        });
      }
    }
  }

  return out.sort(queueSort);
}

export function filterTrainingMatrixActionQueue(
  queue: TrainingMatrixActionQueueItem[],
  filters: TrainingMatrixActionQueueFilters
): TrainingMatrixActionQueueItem[] {
  const actionType = filters.actionType && filters.actionType !== "all" ? filters.actionType : "";
  const trade = clean(filters.trade).toLowerCase();
  const requirementId = clean(filters.requirementId);
  const search = clean(filters.search).toLowerCase();

  return queue.filter((item) => {
    if (actionType && item.actionType !== actionType) return false;
    if (trade && item.trade.toLowerCase() !== trade) return false;
    if (requirementId && item.requirementId !== requirementId) return false;
    if (search) {
      const haystack = [
        item.person,
        item.email,
        item.trade,
        item.position,
        item.certification,
        item.requirementTitle ?? "",
        item.status,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (!/[",\r\n]/.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function trainingMatrixActionQueueToCsv(
  queue: TrainingMatrixActionQueueItem[]
): string {
  const headers = [
    "person",
    "email",
    "trade",
    "position",
    "action type",
    "requirement/certification",
    "status",
    "expiration",
    "days until expiry",
    "suggested next step",
  ];
  const rows = queue.map((item) => [
    item.person,
    item.email,
    item.trade,
    item.position,
    item.actionType,
    item.requirementTitle
      ? `${item.requirementTitle} / ${item.certification}`
      : item.certification,
    item.status,
    item.expiresOn,
    item.daysUntilExpiry,
    item.suggestedNextStep,
  ]);
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
}
