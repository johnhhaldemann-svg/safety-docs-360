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

  console.log("Smoke test passed.");
}

run().catch((error) => {
  console.error("Smoke test failed:", error.message);
  process.exit(1);
});
