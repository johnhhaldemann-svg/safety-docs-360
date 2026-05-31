"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, BrainCircuit, Gauge, LayoutDashboard, Loader2, RefreshCw, Search, Sparkles } from "lucide-react";
import { CandidateReviewPanel } from "@/components/ai-knowledge-map/CandidateReviewPanel";
import { FilterPanel } from "@/components/ai-knowledge-map/FilterPanel";
import { GlobeCanvas } from "@/components/ai-knowledge-map/GlobeCanvas";
import { LegendBar } from "@/components/ai-knowledge-map/LegendBar";
import { LowConfidenceQueue } from "@/components/ai-knowledge-map/LowConfidenceQueue";
import { MapControls, type MapCommand } from "@/components/ai-knowledge-map/MapControls";
import { RelationshipValidationPanel } from "@/components/ai-knowledge-map/RelationshipValidationPanel";
import { SelectedNodePanel } from "@/components/ai-knowledge-map/SelectedNodePanel";
import { StatsBar } from "@/components/ai-knowledge-map/StatsBar";
import { TrustedLearningInputsPanel } from "@/components/ai-knowledge-map/TrustedLearningInputsPanel";
import type { AiKnowledgeEdge, AiKnowledgeGraphPayload, AiKnowledgeMapFilters, AiKnowledgeNode } from "@/lib/aiKnowledgeMap/types";

type AuthMeResponse = {
  user?: { role?: string | null } | null;
};

const EMPTY_SUMMARY = {
  nodeCount: 0,
  edgeCount: 0,
  dataSourceCount: 0,
  highRiskNodeCount: 0,
  documentNodeCount: 0,
  sharedLibraryNodeCount: 0,
  lowConfidenceCount: 0,
  unreviewedRelationshipCount: 0,
  pendingReviewCount: 0,
  indexedVectorCount: 0,
  companyCount: 0,
  latestUpdate: null,
};

const EMPTY_GRAPH: AiKnowledgeGraphPayload = {
  companies: [],
  selectedCompanyId: null,
  nodes: [],
  edges: [],
  validationQueue: [],
  summary: EMPTY_SUMMARY,
  generatedAt: new Date(0).toISOString(),
  warnings: [],
  demo: true,
  fallback: false,
  fallbackReason: null,
  companySpecificNodeCount: 0,
  companySpecificEdgeCount: 0,
  companyDocumentNodeCount: 0,
  sharedLibraryNodeCount: 0,
  pendingLearningCandidateCount: 0,
  pendingLearningBatchCount: 0,
};

export function KnowledgeMapPage() {
  const [graph, setGraph] = useState<AiKnowledgeGraphPayload>(EMPTY_GRAPH);
  const [filters, setFilters] = useState<AiKnowledgeMapFilters>({ sourceType: "all", riskLevel: "all" });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [heatmap, setHeatmap] = useState(true);
  const [command, setCommand] = useState<{ id: number; value: MapCommand | null }>({ id: 0, value: null });
  const [loading, setLoading] = useState(true);
  const [authAllowed, setAuthAllowed] = useState<boolean | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedNode = useMemo(() => graph.nodes.find((node) => node.id === selectedNodeId) ?? graph.nodes[0] ?? null, [graph.nodes, selectedNodeId]);

  const load = useCallback(async (nextFilters: AiKnowledgeMapFilters) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (nextFilters.companyId) params.set("companyId", nextFilters.companyId);
      if (nextFilters.query?.trim()) params.set("q", nextFilters.query.trim());
      if (nextFilters.project && nextFilters.project !== "all") params.set("project", nextFilters.project);
      if (nextFilters.category && nextFilters.category !== "all") params.set("category", nextFilters.category);
      if (nextFilters.riskLevel && nextFilters.riskLevel !== "all") params.set("riskLevel", nextFilters.riskLevel);
      if (nextFilters.trade && nextFilters.trade !== "all") params.set("trade", nextFilters.trade);
      if (nextFilters.sourceType && nextFilters.sourceType !== "all") params.set("sourceType", nextFilters.sourceType);
      if (nextFilters.dateRange && nextFilters.dateRange !== "all") params.set("dateRange", nextFilters.dateRange);
      const [nodesResponse, edgesResponse, summaryResponse] = await Promise.all([
        fetch(`/api/ai-knowledge-map/nodes?${params.toString()}`),
        fetch(`/api/ai-knowledge-map/edges?${params.toString()}`),
        fetch(`/api/ai-knowledge-map/summary?${params.toString()}`),
      ]);
      const nodesBody = await nodesResponse.json().catch(() => null) as Partial<AiKnowledgeGraphPayload> & { error?: string } | null;
      const edgesBody = await edgesResponse.json().catch(() => null) as Partial<AiKnowledgeGraphPayload> & { error?: string } | null;
      const summaryBody = await summaryResponse.json().catch(() => null) as Partial<AiKnowledgeGraphPayload> & { summary?: typeof EMPTY_SUMMARY; error?: string } | null;
      if (!nodesResponse.ok) throw new Error(nodesBody?.error ?? "Unable to load AI Knowledge Map nodes.");
      if (!edgesResponse.ok) throw new Error(edgesBody?.error ?? "Unable to load AI Knowledge Map relationships.");
      if (!summaryResponse.ok) throw new Error(summaryBody?.error ?? "Unable to load AI Knowledge Map summary.");
      const payload: AiKnowledgeGraphPayload = {
        companies: nodesBody?.companies ?? [],
        selectedCompanyId: nodesBody?.selectedCompanyId ?? nextFilters.companyId ?? null,
        nodes: nodesBody?.nodes ?? [],
        edges: edgesBody?.edges ?? [],
        validationQueue: edgesBody?.validationQueue ?? [],
        summary: summaryBody?.summary ?? EMPTY_SUMMARY,
        generatedAt: summaryBody?.generatedAt ?? nodesBody?.generatedAt ?? new Date().toISOString(),
        warnings: [...(nodesBody?.warnings ?? []), ...(edgesBody?.warnings ?? []), ...(summaryBody?.warnings ?? [])],
        demo: Boolean(nodesBody?.demo || edgesBody?.demo || summaryBody?.demo),
        fallback: Boolean(nodesBody?.fallback || edgesBody?.fallback || summaryBody?.fallback),
        fallbackReason: nodesBody?.fallbackReason ?? summaryBody?.fallbackReason ?? null,
        companySpecificNodeCount: nodesBody?.companySpecificNodeCount ?? summaryBody?.companySpecificNodeCount ?? 0,
        companySpecificEdgeCount: edgesBody?.companySpecificEdgeCount ?? summaryBody?.companySpecificEdgeCount ?? 0,
        companyDocumentNodeCount: nodesBody?.companyDocumentNodeCount ?? summaryBody?.companyDocumentNodeCount ?? 0,
        sharedLibraryNodeCount: nodesBody?.sharedLibraryNodeCount ?? summaryBody?.sharedLibraryNodeCount ?? 0,
        pendingLearningCandidateCount: nodesBody?.pendingLearningCandidateCount ?? summaryBody?.pendingLearningCandidateCount ?? 0,
        pendingLearningBatchCount: nodesBody?.pendingLearningBatchCount ?? summaryBody?.pendingLearningBatchCount ?? 0,
      };
      setGraph(payload);
      setFilters((current) => ({ ...current, companyId: payload.selectedCompanyId ?? current.companyId }));
      setSelectedNodeId((current) => current && payload.nodes.some((node) => node.id === current) ? current : payload.nodes[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load AI Knowledge Map.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const response = await fetch("/api/auth/me");
        const body = await response.json().catch(() => null) as AuthMeResponse | null;
        const allowed = response.ok && body?.user?.role === "super_admin";
        if (cancelled) return;
        setAuthAllowed(allowed);
        if (allowed) {
          await load({ sourceType: "all", riskLevel: "all" });
        } else {
          setLoading(false);
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [load]);

  async function runRebuild(generateEmbeddings: boolean) {
    if (!graph.selectedCompanyId || graph.selectedCompanyId === "all") {
      setError("Select one company before rebuilding the AI Knowledge Map. All-company view is read-only for rebuild safety.");
      return;
    }
    setWorking(generateEmbeddings ? "Embedding rebuild" : "Rebuild");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/ai-knowledge-map/rebuild-index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: graph.selectedCompanyId, generateEmbeddings, limitPerTable: 80, maxEmbeddingAttempts: generateEmbeddings ? 24 : 1 }),
      });
      const body = await response.json().catch(() => null) as { error?: string; insertedOrUpdatedNodes?: number; insertedOrUpdatedEdges?: number; candidateNodes?: number; candidateEdges?: number; reviewRequiredCount?: number } | null;
      if (!response.ok) throw new Error(body?.error ?? "Rebuild failed.");
      if ((body?.reviewRequiredCount ?? 0) > 0) {
        setMessage(`Created ${body?.candidateNodes ?? 0} node candidates and ${body?.candidateEdges ?? 0} relationship candidates for Human Review.`);
      } else {
        setMessage(`Rebuilt ${body?.insertedOrUpdatedNodes ?? 0} nodes and ${body?.insertedOrUpdatedEdges ?? 0} relationships.`);
      }
      await load(filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rebuild failed.");
    } finally {
      setWorking(null);
    }
  }

  async function recalculate() {
    if (!graph.selectedCompanyId || graph.selectedCompanyId === "all") {
      setError("Select one company before recalculating relationships. All-company view is read-only for recalculation safety.");
      return;
    }
    setWorking("Recalculate");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/ai-knowledge-map/recalculate-risk-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: graph.selectedCompanyId }),
      });
      const body = await response.json().catch(() => null) as { error?: string; insertedOrUpdatedEdges?: number } | null;
      if (!response.ok) throw new Error(body?.error ?? "Recalculation failed.");
      setMessage(`Recalculated ${body?.insertedOrUpdatedEdges ?? 0} relationships.`);
      await load(filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recalculation failed.");
    } finally {
      setWorking(null);
    }
  }

  async function runLearningCheck() {
    if (!graph.selectedCompanyId || graph.selectedCompanyId === "all") {
      setError("Select one company before running a learning check. All-company view is read-only for learning changes.");
      return;
    }
    setWorking("Learning check");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/ai-knowledge-map/learning-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: graph.selectedCompanyId, maxDocuments: 16, maxInternetSources: 6 }),
      });
      const body = await response.json().catch(() => null) as { error?: string; candidatesCreated?: number; documentsChecked?: number; internetSourcesChecked?: number; failedSources?: number } | null;
      if (!response.ok) throw new Error(body?.error ?? "Learning check failed.");
      setMessage(`Learning check queued ${body?.candidatesCreated ?? 0} candidates from ${body?.documentsChecked ?? 0} documents and ${body?.internetSourcesChecked ?? 0} approved internet sources. Failed sources: ${body?.failedSources ?? 0}.`);
      await load(filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Learning check failed.");
    } finally {
      setWorking(null);
    }
  }

  async function validate(edge: AiKnowledgeEdge, status: "approved" | "rejected" | "incorrect", reasonOverride?: string) {
    if (!edge.id || edge.id.startsWith("demo-edge")) {
      setMessage("Demo relationships show the validation flow. Rebuild a live company index to save review decisions.");
      return false;
    }
    const reason = reasonOverride?.trim() || (status === "approved"
      ? `Super Admin reviewed ${edge.relationshipType} in AI Knowledge Map.`
      : "");
    if (!reason) {
      setError(`${status === "incorrect" ? "Incorrect" : "Reject"} review requires a meaningful reason.`);
      return false;
    }
    setWorking(`Mark ${status}`);
    setError(null);
    try {
      const response = await fetch("/api/ai-knowledge-map/validate-relationship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edgeId: edge.id, status, reason }),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "Validation update failed.");
      setMessage(`Relationship marked ${status}.`);
      await load(filters);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation update failed.");
      return false;
    } finally {
      setWorking(null);
    }
  }

  function commandMap(value: MapCommand) {
    setCommand((current) => ({ id: current.id + 1, value }));
  }

  function applyFilters(nextFilters: AiKnowledgeMapFilters) {
    setFilters(nextFilters);
    void load(nextFilters);
  }

  function selectNode(node: AiKnowledgeNode) {
    setSelectedNodeId(node.id ?? null);
  }

  if (authAllowed === false) {
    return (
      <div className="min-h-screen bg-[#020617] px-4 py-8 text-slate-100">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-300/25 bg-red-300/10 p-6 shadow-2xl">
          <h1 className="text-2xl font-black text-white">Super Admin access required</h1>
          <p className="mt-2 text-sm font-semibold text-red-100">
            The AI Knowledge Map, relationship review tools, rebuild controls, and semantic graph search are not available to company users.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_48%_18%,rgba(14,165,233,0.18),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,1))]" />
      <div className="relative mx-auto flex min-h-screen max-w-[1800px] flex-col gap-4 px-3 py-3 sm:px-4 sm:py-4">
        <header className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/76 px-4 py-4 shadow-2xl backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-white">AI Knowledge Map</h1>
            <p className="mt-1 text-sm font-semibold text-slate-400">Semantic view of connected safety data</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center lg:justify-end">
            <TopButton icon={LayoutDashboard} label="Dashboard" />
            <TopButton icon={Sparkles} label="Insights" />
            <TopButton icon={Bell} label="Alerts" />
            <button type="button" onClick={() => void runRebuild(false)} disabled={Boolean(working)} className="inline-flex items-center gap-2 rounded-lg bg-sky-400 px-3 py-2 text-sm font-black text-slate-950 hover:bg-sky-300 disabled:opacity-60">
              {working === "Rebuild" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Rebuild index
            </button>
            <button type="button" onClick={() => void runRebuild(true)} disabled={Boolean(working)} className="inline-flex items-center gap-2 rounded-lg border border-sky-300/25 bg-sky-300/10 px-3 py-2 text-sm font-black text-sky-100 hover:bg-sky-300/16 disabled:opacity-60">
              {working === "Embedding rebuild" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
              Rebuild + embeddings
            </button>
            <button type="button" onClick={() => void runLearningCheck()} disabled={Boolean(working)} className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-sm font-black text-emerald-100 hover:bg-emerald-300/16 disabled:opacity-60">
              {working === "Learning check" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
              Run Learning Check
            </button>
            <button type="button" onClick={() => void recalculate()} disabled={Boolean(working)} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-black text-slate-100 hover:bg-white/[0.09] disabled:opacity-60">
              {working === "Recalculate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}
              Recalculate risk
            </button>
          </div>
        </header>

        {(message || error || graph.demo || graph.warnings.length > 0) ? (
          <div className="space-y-2">
            {message ? <Banner tone="green" text={message} /> : null}
            {error ? <Banner tone="red" text={error} /> : null}
            {graph.demo ? <Banner tone="amber" text="Demo mode is showing safe sample records. Rebuild a live company index to use live safety records." /> : null}
            {graph.fallback ? <Banner tone="amber" text={graph.fallbackReason ?? "Showing approved fallback safety intelligence until this company has enough reviewed company-specific data."} /> : null}
            {(graph.pendingLearningCandidateCount ?? 0) > 0 ? <Banner tone="amber" text={`AI learned new information. Human Review required before it enters the map. ${graph.pendingLearningCandidateCount} learned item${graph.pendingLearningCandidateCount === 1 ? "" : "s"} waiting.`} /> : null}
            {(graph.sharedLibraryNodeCount ?? 0) > 0 ? <Banner tone="green" text={`Knowledge Library layer active: ${graph.sharedLibraryNodeCount} approved shared document guidance node${graph.sharedLibraryNodeCount === 1 ? "" : "s"} visible with ${graph.companyDocumentNodeCount ?? 0} approved company document node${(graph.companyDocumentNodeCount ?? 0) === 1 ? "" : "s"}.`} /> : null}
            {graph.warnings.slice(0, 2).map((warning) => <Banner key={warning} tone="amber" text={warning} />)}
          </div>
        ) : null}

        <main className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(560px,1fr)_380px]">
          <FilterPanel companies={graph.companies} filters={filters} nodes={graph.nodes} onChange={setFilters} onApply={applyFilters} />
          <section className="flex min-w-0 flex-col gap-3 self-start">
            <div className="relative">
              {loading ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-950/72 backdrop-blur">
                  <Loader2 className="h-8 w-8 animate-spin text-sky-300" />
                </div>
              ) : null}
              <GlobeCanvas nodes={graph.nodes} edges={graph.edges} selectedNodeId={selectedNode?.id ?? null} heatmap={heatmap} command={command} onSelectNode={selectNode} />
            </div>
            <MapControls heatmap={heatmap} onToggleHeatmap={() => setHeatmap((value) => !value)} onCommand={commandMap} onSearch={() => void load(filters)} />
            <StatsBar summary={graph.summary} generatedAt={graph.generatedAt} />
            <LegendBar />
          </section>
          <section className="grid min-h-0 gap-4 lg:col-span-2 lg:grid-cols-2 2xl:sticky 2xl:top-4 2xl:col-span-1 2xl:flex 2xl:max-h-[calc(100vh-2rem)] 2xl:flex-col 2xl:overflow-y-auto 2xl:pr-1">
            <SelectedNodePanel node={selectedNode} edges={graph.edges} nodes={graph.nodes} companies={graph.companies} onValidate={(edge, status, reason) => validate(edge, status, reason)} />
            <TrustedLearningInputsPanel companyId={graph.selectedCompanyId} onChanged={() => void load(filters)} />
            <CandidateReviewPanel companyId={graph.selectedCompanyId} />
            <RelationshipValidationPanel edges={graph.validationQueue} onValidate={(edge, status, reason) => validate(edge, status, reason)} />
            <LowConfidenceQueue edges={graph.edges} />
          </section>
        </main>
      </div>
    </div>
  );
}

function TopButton({ icon: Icon, label }: { icon: typeof Search; label: string }) {
  return (
    <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-black text-slate-100 hover:bg-white/[0.09]">
      <Icon className="h-4 w-4 text-sky-300" />
      {label}
    </button>
  );
}

function Banner({ tone, text }: { tone: "green" | "red" | "amber"; text: string }) {
  const classes = {
    green: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
    red: "border-red-300/25 bg-red-300/10 text-red-100",
    amber: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  };
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${classes[tone]}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      {text}
    </div>
  );
}
