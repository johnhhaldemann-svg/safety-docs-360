-- Additive compatibility column used by the AI Knowledge Map display/filter layer.
-- The source record remains the source of truth; this stores only a denormalized label.
alter table public.ai_knowledge_nodes
  add column if not exists project text null;
