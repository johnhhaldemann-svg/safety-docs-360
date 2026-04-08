# Company knowledge (memory bank) playbook

Short guide for making **Company knowledge** and the **operations assistant** part of normal safety operations—not an afterthought.

## Owner

- Designate **one workspace lead** (safety, operations, or compliance) responsible for:
  - What gets added to Company knowledge
  - Periodic review (e.g. quarterly or after major contract/site changes)
  - Telling new hires where to find it and that the assistant uses it

## What belongs in Company knowledge

**Good fits (short, stable, day-to-day):**

- Site- or customer-specific PPE, access, or stop-work triggers
- Repeated customer rules that people ask about in the field
- One-paragraph “remember this” summaries after incidents or audits (not a full investigation report)

**Keep out of memory (use controlled documents instead):**

- Long procedures, full JHAs, or legal text—link or reference those in formal records
- Anything that must be version-controlled with signatures—memory is **assist context**, not the system of record

## Cadence

- **At go-live:** Complete the dashboard **Launch Checklist** item “Add company knowledge” (at least one snippet).
- **After closures:** When an incident is closed or a JSA is submitted, the app may prompt you to add a lesson—use it when there is something reusable.
- **Ongoing:** Review entries when sites, customers, or contracts change; remove or replace outdated snippets using the memory panel.

## Technical note (retrieval quality)

- **Semantic search** over memory uses embeddings. Ensure **`OPENAI_API_KEY`** is set on the server (e.g. Vercel Production) so new and edited snippets get embeddings. Without it, retrieval falls back to keyword matching only.
- See [.env.example](../.env.example) for variable names and deployment notes.
