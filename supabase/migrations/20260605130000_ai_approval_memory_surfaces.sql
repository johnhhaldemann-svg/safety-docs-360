-- Tier 2 prep: widen the AI Approval Memory Bank `surface` enum so additional review
-- surfaces can write labeled examples. NOT YET APPLIED to any environment — apply this
-- alongside wiring each surface's capture (AI Improvements, Gus Learning, Owner
-- Validation, Document Review). Tier 1 (Prediction Validation + Knowledge Map) does not
-- need this migration.

alter table public.ai_approval_memory
  drop constraint if exists ai_approval_memory_surface_check;

alter table public.ai_approval_memory
  add constraint ai_approval_memory_surface_check check (
    surface in (
      'prediction_validation',
      'knowledge_map_candidate',
      'knowledge_map_relationship',
      'ai_improvement',
      'gus_learning_finding',
      'owner_validation',
      'document_review'
    )
  );
