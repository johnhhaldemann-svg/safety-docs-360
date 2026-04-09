const DEFAULT_PREVIEW_FIELD_LABELS = [
  "Project Name",
  "Project Number",
  "Project Address",
  "Owner / Client",
  "GC / CM",
  "Safety Contact",
  "Contractor Company",
  "Contractor Phone",
  "Contractor Email",
  "Plan Author",
  "Approved By",
  "Approval Date",
  "Revision",
  "Document Status",
  "Document Purpose",
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function chunkLines(lines: string[], size: number) {
  const chunks: string[][] = [];
  for (let index = 0; index < lines.length; index += size) {
    chunks.push(lines.slice(index, index + size));
  }
  return chunks;
}

export function normalizePreviewText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitPreviewLines(value: string, labels = DEFAULT_PREVIEW_FIELD_LABELS) {
  if (!value.trim()) {
    return [] as string[];
  }

  const labelPattern = labels.map(escapeRegExp).join("|");
  const withLabelBreaks = value.replace(new RegExp(`\\b(${labelPattern})\\b`, "g"), "\n$1");

  return withLabelBreaks
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function isFieldLabelLine(line: string) {
  const lower = line.toLowerCase();
  return DEFAULT_PREVIEW_FIELD_LABELS.some((label) => lower.startsWith(label.toLowerCase()));
}

export function isLikelySectionHeading(line: string) {
  const trimmed = line.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return false;
  }

  if (trimmed.length > 110) {
    return false;
  }

  if (isFieldLabelLine(trimmed)) {
    return false;
  }

  if (/^(section|chapter|part|article|appendix|schedule|module|overview|purpose|scope|summary|instructions|procedure|process|guidance|review|approval|checklist|requirements|workflow)\b/i.test(trimmed)) {
    return true;
  }

  if (/^\d+(\.\d+)*[.)]?\s+[A-Za-z]/.test(trimmed)) {
    return true;
  }

  if (/^[IVXLC]+\.[\sA-Z]/i.test(trimmed)) {
    return true;
  }

  if (/^[A-Z0-9][A-Z0-9 /,&().:'-]{7,}$/.test(trimmed)) {
    return true;
  }

  if (/^[A-Z][A-Za-z0-9 /,&().:'-]{0,72}:$/.test(trimmed)) {
    return true;
  }

  const words = trimmed.split(/\s+/);
  if (words.length <= 8 && trimmed.length <= 70 && !/[.!?]$/.test(trimmed)) {
    const titleCaseWords = words.filter((word) => /^[A-Z][A-Za-z0-9'/-]*$/.test(word));
    if (titleCaseWords.length >= Math.max(2, Math.ceil(words.length / 2))) {
      return true;
    }
  }

  return false;
}

export type MarketplacePreviewSection = {
  title: string;
  lines: string[];
  teaserLines: string[];
  blurredLines: string[];
  lineCount: number;
  fallback: boolean;
};

function formatSectionLabel(index: number) {
  return `Section ${String(index + 1).padStart(2, "0")}`;
}

function normalizeSectionTitle(line: string, fallbackIndex: number) {
  const trimmed = line.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return formatSectionLabel(fallbackIndex);
  }

  const stripped = trimmed.replace(/[:\-–—\s]+$/u, "").trim();
  return stripped || formatSectionLabel(fallbackIndex);
}

function inferSectionTopic(lines: string[]) {
  for (const rawLine of lines) {
    const line = rawLine.trim().replace(/\s+/g, " ");
    if (!line) {
      continue;
    }

    const matchedLabel = DEFAULT_PREVIEW_FIELD_LABELS.find((label) =>
      line.toLowerCase().startsWith(label.toLowerCase())
    );
    if (matchedLabel) {
      return matchedLabel;
    }

    if (isLikelySectionHeading(line)) {
      const heading = line.replace(/[:\-â€“â€”\s]+$/u, "").trim();
      if (!/^section\s+\d+$/i.test(heading)) {
        return heading;
      }
    }

    if (line.length <= 70 && !/[.!?]$/.test(line) && line.split(/\s+/).length <= 8) {
      return line;
    }
  }

  return null;
}

function buildDescriptiveSectionTitle(title: string, lines: string[], fallbackIndex: number) {
  const normalizedTitle = normalizeSectionTitle(title, fallbackIndex);
  const genericSection = /^section\s+\d+$/i.test(normalizedTitle);

  if (!genericSection && normalizedTitle !== formatSectionLabel(fallbackIndex)) {
    return normalizedTitle;
  }

  const topic = inferSectionTopic(lines);
  if (topic) {
    return `${formatSectionLabel(fallbackIndex)}: ${topic}`;
  }

  return formatSectionLabel(fallbackIndex);
}

function buildFallbackSections(
  lines: string[],
  teaserLineCount: number,
  fallbackGroupSize: number
) {
  return chunkLines(lines, fallbackGroupSize).map((chunk, index) => {
    const titleSource = chunk[0] ?? "";
    const title = buildDescriptiveSectionTitle(titleSource, chunk, index);
    const teaserLines = chunk.slice(0, teaserLineCount);
    const blurredLines = chunk.slice(teaserLineCount);
    return {
      title,
      lines: chunk,
      teaserLines,
      blurredLines,
      lineCount: chunk.length,
      fallback: true,
    } satisfies MarketplacePreviewSection;
  });
}

export function buildMarketplacePreviewSections(
  lines: string[],
  options?: {
    teaserLineCount?: number;
    maxSections?: number;
    fallbackGroupSize?: number;
  }
) {
  const teaserLineCount = Math.max(1, options?.teaserLineCount ?? 2);
  const maxSections = Math.max(1, options?.maxSections ?? 6);
  const fallbackGroupSize = Math.max(2, options?.fallbackGroupSize ?? 6);
  const sections: { title: string; lines: string[] }[] = [];

  let current: { title: string; lines: string[] } | null = null;

  const pushCurrent = () => {
    if (current && current.lines.length > 0) {
      sections.push(current);
    }
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (isLikelySectionHeading(line)) {
      if (!current) {
        current = { title: normalizeSectionTitle(line, sections.length), lines: [] };
        continue;
      }

      if (current.lines.length === 0) {
        current.title = normalizeSectionTitle(line, sections.length);
        continue;
      }

      pushCurrent();
      current = { title: normalizeSectionTitle(line, sections.length), lines: [] };
      continue;
    }

    if (!current) {
      current = { title: "Opening excerpt", lines: [] };
    }

    current.lines.push(line);
  }

  pushCurrent();

  const meaningful = sections.filter((section) => section.lines.length > 0);
  const chosenSections =
    meaningful.length > 1
      ? meaningful
      : buildFallbackSections(lines, teaserLineCount, fallbackGroupSize);

  return chosenSections.slice(0, maxSections).map((section, index) => ({
    title: buildDescriptiveSectionTitle(section.title, section.lines, index),
    lines: section.lines,
    teaserLines: section.lines.slice(0, teaserLineCount),
    blurredLines: section.lines.slice(teaserLineCount),
    lineCount: section.lines.length,
    fallback: "fallback" in section ? section.fallback : false,
  }));
}
