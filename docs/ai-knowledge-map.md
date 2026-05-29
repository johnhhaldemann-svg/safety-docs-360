# AI Knowledge Map

The AI Knowledge Map is an additive Super Admin intelligence layer for SafetyDocs360. It does not replace folders, categories, permits, training, incidents, observations, corrective actions, documents, or risk records. It indexes those records into semantic nodes and explainable relationship edges.

## Routes

- Page: `/super-admin/ai-knowledge-map`
- Existing Super Admin alias: `/superadmin/ai-knowledge-map`
- API reads: `/api/ai-knowledge-map/nodes`, `/api/ai-knowledge-map/edges`, `/api/ai-knowledge-map/summary`, `/api/ai-knowledge-map/node/[id]`
- API actions: `/api/ai-knowledge-map/rebuild-index`, `/api/ai-knowledge-map/recalculate-risk-connections`, `/api/ai-knowledge-map/validate-relationship`, `/api/ai-knowledge-map/save-view`

All APIs are Super Admin-only in this phase.

## Demo vs Live Data

If the database tables are missing or no live company graph exists, the UI shows safe demo records. Demo data is generated in code and is not inserted into production tables.

Live data is created only when a Super Admin runs the rebuild action for a selected company. The rebuild reads existing company-scoped records and writes index rows to the AI Knowledge Map tables.

## Database

Migration `20260528232014_ai_knowledge_map.sql` creates:

- `ai_knowledge_nodes`
- `ai_knowledge_edges`
- `ai_vector_memory`
- `ai_engine_events`
- `ai_engine_validation_logs`
- `ai_knowledge_map_views`

The migration enables `pgvector`, stores deterministic vector coordinates, supports optional embeddings, enables RLS, revokes public/anon/authenticated access, and grants service-role access only.

## Fallback Behavior

- If embeddings are unavailable, records still receive deterministic vector coordinates.
- If WebGL is unavailable, the page shows a 2D node list fallback.
- Initial rendering is capped to 500 nodes and 700 relationships for performance.
- AI-generated and low-confidence edges remain reviewable before being trusted downstream.

## Next Improvements

- Add React Three Fiber/Drei if the project approves the dependency.
- Add company-facing AI answers that use only approved graph knowledge behind the scenes.
- Add richer source-record deep links by table.
- Add true dimensionality reduction after enough validated vector memory exists.
