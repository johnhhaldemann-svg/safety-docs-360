import { OBSERVATION_TYPES, SEVERITY_OPTIONS, STATUS_OPTIONS } from "./constants";
import { isValidObservationCombo } from "./tree";

export function parseSafetyObservationBody(body: Record<string, unknown> | null) {
  if (!body || typeof body !== "object") return { error: "Invalid JSON body." as const };

  const title = String(body.title ?? "").trim();
  if (!title) return { error: "title is required." as const };

  const observation_type = String(body.observation_type ?? "").trim();
  if (!OBSERVATION_TYPES.includes(observation_type as (typeof OBSERVATION_TYPES)[number])) {
    return { error: "Invalid observation_type." as const };
  }

  const category = String(body.category ?? "").trim();
  const subcategory = String(body.subcategory ?? "").trim();
  if (!isValidObservationCombo(observation_type, category, subcategory)) {
    return { error: "category and subcategory do not match observation_type." as const };
  }

  const severity = String(body.severity ?? "Low").trim();
  if (!SEVERITY_OPTIONS.includes(severity as (typeof SEVERITY_OPTIONS)[number])) {
    return { error: "Invalid severity." as const };
  }

  const status = String(body.status ?? "Open").trim();
  if (!STATUS_OPTIONS.includes(status as (typeof STATUS_OPTIONS)[number])) {
    return { error: "Invalid status." as const };
  }

  const jobsiteIdRaw = body.jobsite_id ?? body.jobsiteId;
  const jobsite_id =
    jobsiteIdRaw === null || jobsiteIdRaw === undefined || jobsiteIdRaw === ""
      ? null
      : String(jobsiteIdRaw).trim() || null;

  const assignedRaw = body.assigned_to ?? body.assignedTo;
  const assigned_to =
    assignedRaw === null || assignedRaw === undefined || assignedRaw === ""
      ? null
      : String(assignedRaw).trim() || null;

  const dueRaw = body.due_date ?? body.dueDate;
  const due_date =
    dueRaw === null || dueRaw === undefined || dueRaw === ""
      ? null
      : String(dueRaw).trim().slice(0, 10) || null;

  const photoUrls = body.photo_urls ?? body.photoUrls;
  const photo_urls = Array.isArray(photoUrls)
    ? photoUrls.filter((u): u is string => typeof u === "string" && u.length > 0)
    : [];

  return {
    value: {
      title,
      description: String(body.description ?? "").trim() || null,
      observation_type,
      category,
      subcategory,
      severity,
      status,
      jobsite_id,
      location: String(body.location ?? "").trim() || null,
      trade: String(body.trade ?? "").trim() || null,
      immediate_action_taken: String(body.immediate_action_taken ?? body.immediateActionTaken ?? "").trim() || null,
      corrective_action: String(body.corrective_action ?? body.correctiveAction ?? "").trim() || null,
      assigned_to,
      due_date,
      photo_urls,
      project_id:
        body.project_id === null || body.project_id === undefined
          ? null
          : String(body.project_id).trim() || null,
      linked_dap_id: body.linked_dap_id ? String(body.linked_dap_id) : null,
      linked_jsa_id: body.linked_jsa_id ? String(body.linked_jsa_id) : null,
      linked_incident_id: body.linked_incident_id ? String(body.linked_incident_id) : null,
    },
  };
}
