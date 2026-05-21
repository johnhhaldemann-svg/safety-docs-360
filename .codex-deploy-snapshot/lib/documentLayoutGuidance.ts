export function getCustomerFacingDocumentLayoutGuidance() {
  return [
    "Customer-facing document layout expectations:",
    "1. Cover page: use a clean cover with an optional company logo, a prominent document title, the project name, contractor name, and a concise prepared-by / issued line.",
    "2. Front matter order: Document Summary, High-Risk Work Snapshot, Revision / Prepared By, optional Trade Package Overview, then Contents.",
    "3. High-Risk Work Snapshot: group hazards, tasks, controls, and PPE by trade / subtrade package so each scope reads like a clean work package rather than a flat list.",
    "4. Body opener: begin the body with a short Purpose & How to Use This Blueprint section followed by a Field Execution Snapshot section before the detailed generated sections.",
    "5. Body order after the opener: definitions and references first, then project and grouped trade overview tables, then task / permit / training sections, then program sections, then a leadership review / continuous improvement closeout, followed by appendices.",
    "6. Use a task-first execution snapshot in the body that groups key tasks, hazards, controls, PPE, permits, and work areas by trade / subtrade package.",
    "7. Start each major body section on a clean new page and use short headings, structured tables, and clear section summaries so the document scans like a professional field-ready blueprint rather than a chat response.",
    "8. Customer-facing language only: never expose internal generator names, system labels, placeholder text, or implementation details.",
    "9. Use task-facing labels such as Key Tasks and Related Tasks. Avoid user-facing phrasing like Permit Triggers or Related Task Triggers unless the section is explicitly about authorization requirements.",
    "10. Do not surface raw risk scores in front matter. Summarize priorities and controls instead.",
    "11. Keep SafetyDocs360 branding subtle. The customer's project and company identity should remain visually primary.",
    "12. The finished document should feel polished, balanced, and print-ready, with a large readable cover title and footer content anchored at the bottom of the page.",
    "13. Keep hierarchical numbering consistent across headings and nested detail items using a formal outline structure such as 1, 1.1, 1.1.1, and 1.1.1.1.",
    "14. Keep narrative fields concise. Use one short paragraph or a brief summary instead of repeating details already shown in tables, bullets, or program sections.",
    "15. Treat detailed tables and generated program sections as the primary source of detail. Narrative fields should summarize only what is most important for field execution.",
    "16. Use the leadership review / continuous improvement closeout to summarize priority focus, coordination status, training focus, and when the document must be reissued.",
    "17. Do not repeat the same sentence, idea, OSHA reference list, project fact, or section label across multiple sections. Reference material should appear once in the most appropriate section.",
    "18. Aim for a balanced draft that stays near a 30-page customer-facing document when possible by reducing repetition, compressing low-value filler, and avoiding redundant wrappers around structured content.",
  ].join("\n");
}

export function getReviewLayoutGuidance() {
  return [
    "When evaluating document quality, use the intended customer-facing blueprint layout as the standard.",
    getCustomerFacingDocumentLayoutGuidance(),
    "Call out when the draft breaks that layout standard through weak hierarchy, missing grouped trade packages, broken outline numbering, placeholder copy, leaked internal wording, awkward task labeling, missing front-matter structure, or obvious cover / footer presentation problems.",
  ].join("\n\n");
}
