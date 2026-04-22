import type {
  DocumentBuilderSectionTemplate,
  DocumentBuilderTextConfig,
} from "@/types/document-builder-text";

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function summarizeSection(
  section: DocumentBuilderSectionTemplate,
  depth = 0,
  sink: string[] = []
) {
  const prefix = depth > 0 ? `${section.label} under ${section.title}` : section.label;
  const paragraphText = section.paragraphs
    .map((paragraph) => compactWhitespace(paragraph))
    .filter(Boolean)
    .slice(0, 1);
  const bulletText = section.bullets
    .map((bullet) => compactWhitespace(bullet))
    .filter(Boolean)
    .slice(0, 2);

  const fragments = [...paragraphText, ...bulletText];
  if (fragments.length) {
    sink.push(`${prefix}: ${fragments.join(" ")}`.slice(0, 320));
  } else {
    sink.push(prefix);
  }

  for (const child of section.children) {
    summarizeSection(child, depth + 1, sink);
  }

  return sink;
}

export function buildCsepBuilderExpectationSummary(
  config: DocumentBuilderTextConfig,
  maxItems = 24
) {
  const sections = config.builders.csep.sections;
  const summary = sections.flatMap((section) => summarizeSection(section));
  return summary.filter(Boolean).slice(0, maxItems);
}
