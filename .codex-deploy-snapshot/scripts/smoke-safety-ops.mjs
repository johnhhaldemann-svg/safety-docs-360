const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const token = process.env.SMOKE_BEARER_TOKEN || "";

if (!token) {
  console.error("Missing SMOKE_BEARER_TOKEN.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

async function call(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers || {}),
    },
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${path} failed: ${json?.error || response.statusText}`);
  }
  return json;
}

async function run() {
  console.log("1) Create observation");
  const created = await call("/api/company/observations", {
    method: "POST",
    body: JSON.stringify({
      title: `Smoke Observation ${Date.now()}`,
      description: "Smoke test observation flow",
      severity: "medium",
      category: "hazard",
      status: "open",
    }),
  });
  const observationId = created?.observation?.id;
  if (!observationId) throw new Error("Observation create returned no id.");

  console.log("2) Update observation to in_progress");
  await call(`/api/company/observations/${observationId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "in_progress" }),
  });

  console.log("3) Escalate observation to incident");
  await call(`/api/company/observations/${observationId}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "escalated",
      convertToIncident: true,
      incidentType: "incident",
    }),
  });

  console.log("4) Generate end-of-day report");
  const report = await call("/api/company/reports", {
    method: "POST",
    body: JSON.stringify({
      reportType: "end_of_day",
      workDate: new Date().toISOString().slice(0, 10),
    }),
  });
  const reportId = report?.report?.id;
  if (!reportId) throw new Error("EOD report returned no id.");

  console.log("5) Fetch analytics summary");
  await call("/api/company/analytics/summary?days=30");

  console.log("6) Verify predictive behavior risk driver layer");
  const predictive = await call("/api/company/predictive-risk?days=30");
  const behaviorRisk = predictive?.behaviorRisk;
  if (!behaviorRisk || typeof behaviorRisk.behaviorRiskScore !== "number" || typeof behaviorRisk.riskLevel !== "string") {
    throw new Error("Predictive risk response did not include behaviorRisk score and level.");
  }
  if (!Array.isArray(behaviorRisk.topDrivers) || !Array.isArray(behaviorRisk.recommendedActions) || !Array.isArray(behaviorRisk.sourceEvents)) {
    throw new Error("Predictive behaviorRisk response is missing driver/action/source event arrays.");
  }
  if (behaviorRisk.sourceEvents.length > 0 && behaviorRisk.topDrivers.length === 0) {
    throw new Error("Behavior risk source events were found but no top drivers were returned.");
  }

  console.log("Smoke test passed.");
}

run().catch((error) => {
  console.error("Smoke test failed:", error.message);
  process.exit(1);
});
