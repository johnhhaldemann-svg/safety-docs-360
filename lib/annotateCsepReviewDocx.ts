import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type {
  BuilderProgramAiReview,
  BuilderProgramAiReviewFinding,
  BuilderProgramAiReviewSectionNote,
} from "@/lib/builderDocumentAiReview";
import { formatCsepFindingNote } from "@/lib/csepReviewNoteFormat";

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const COMMENTS_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments";
const COMMENTS_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml";
type XmlNodeLike = {
  nodeName?: string | null;
  textContent?: string | null;
  childNodes?: ArrayLike<XmlNodeLike>;
};

function localName(nodeName: string | null | undefined) {
  if (!nodeName) return "";
  const parts = nodeName.split(":");
  return parts[parts.length - 1] ?? "";
}

function normalizeWhitespace(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function collectText(node: XmlNodeLike, parts: string[]) {
  const name = localName(node.nodeName);

  if (name === "t" || name === "delText") {
    if (node.textContent) parts.push(node.textContent);
    return;
  }

  if (name === "tab") {
    parts.push(" ");
    return;
  }

  if (name === "br" || name === "cr") {
    parts.push("\n");
    return;
  }

  const children = node.childNodes ?? [];
  for (let index = 0; index < children.length; index += 1) {
    collectText(children[index], parts);
  }

  if (name === "p") {
    parts.push("\n");
  }
}

function getElementsByLocalName(doc: Document, name: string): Element[] {
  const result: Element[] = [];
  const elements = doc.getElementsByTagName("*");
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];
    if (localName(element.nodeName) === name) {
      result.push(element);
    }
  }
  return result;
}

function buildMatchTokens(text: string) {
  return normalizeWhitespace(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .slice(0, 18);
}

function paragraphScore(paragraphText: string, finding: ReviewCommentTarget) {
  const paragraphLower = paragraphText.toLowerCase();
  const exampleText = normalizeWhitespace(finding.documentExample.replace(/\.\.\./g, " "));
  const exampleLower = exampleText.toLowerCase();

  let score = 0;
  if (exampleLower && exampleLower.length >= 18 && paragraphLower.includes(exampleLower.slice(0, 80))) {
    score += 40;
  }

  for (const token of buildMatchTokens(`${finding.sectionLabel} ${finding.issue} ${exampleText}`)) {
    if (paragraphLower.includes(token)) {
      score += 4;
    }
  }

  if (paragraphLower.includes(finding.sectionLabel.toLowerCase())) {
    score += 12;
  }

  return score;
}

type ReviewCommentTarget = {
  sectionLabel: string;
  issue: string;
  documentExample: string;
  preferredExample: string;
  reviewerNote: string;
  referenceSupport?: string;
  whyItMatters?: string;
};

function sectionNoteToCommentTarget(note: BuilderProgramAiReviewSectionNote): ReviewCommentTarget {
  return {
    sectionLabel: note.sectionLabel,
    issue:
      note.status === "missing"
        ? `${note.sectionLabel} is missing or not clearly developed in the document.`
        : note.whatNeedsWork,
    documentExample: note.whatWasFound,
    preferredExample: note.suggestedBuilderTarget,
    reviewerNote: note.whatNeedsWork,
    referenceSupport: undefined,
    whyItMatters: undefined,
  };
}

function findingToCommentTarget(finding: BuilderProgramAiReviewFinding): ReviewCommentTarget {
  return {
    sectionLabel: finding.sectionLabel,
    issue: finding.issue,
    documentExample: finding.documentExample,
    preferredExample: finding.preferredExample,
    reviewerNote: finding.reviewerNote,
    referenceSupport: finding.referenceSupport,
    whyItMatters: finding.whyItMatters,
  };
}

function buildCommentTargets(review: BuilderProgramAiReview) {
  const targets: ReviewCommentTarget[] = [];
  const seen = new Set<string>();

  for (const note of review.sectionReviewNotes) {
    if (note.status === "present") continue;
    const target = sectionNoteToCommentTarget(note);
    const key = `${target.sectionLabel.toLowerCase()}::${normalizeWhitespace(target.issue).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push(target);
  }

  for (const finding of review.detailedFindings) {
    if (finding.sentiment === "positive") continue;
    const target = findingToCommentTarget(finding);
    const key = `${target.sectionLabel.toLowerCase()}::${normalizeWhitespace(target.issue).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push(target);
  }

  return targets;
}

function composeCommentText(target: ReviewCommentTarget, _index: number) {
  return formatCsepFindingNote({
    sectionLabel: target.sectionLabel,
    sentiment: "negative",
    issue: `${target.sectionLabel}: ${target.issue}`,
    problem: target.issue,
    documentExample: target.documentExample,
    preferredExample: target.preferredExample,
    reviewerNote: target.reviewerNote,
    requiredOutput: target.preferredExample,
    acceptanceCheck:
      "The updated paragraph is specific to the actual work, matches the section intent, and reads like final issue language.",
    doNot:
      "Do not leave this as a generic note, checklist fragment, or placeholder statement that is not tied to the paragraph.",
    referenceSupport: target.referenceSupport,
    whyItMatters: target.whyItMatters,
  });
}

function findBestParagraphIndex(
  paragraphTexts: string[],
  target: ReviewCommentTarget,
  usedParagraphIndexes: Set<number>
) {
  let bestIndex = -1;
  let bestScore = 0;

  paragraphTexts.forEach((paragraphText, index) => {
    const score = paragraphScore(paragraphText, target);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  if (bestIndex >= 0) {
    return bestIndex;
  }

  const sectionLabel = target.sectionLabel.toLowerCase();
  const headingIndex = paragraphTexts.findIndex((paragraphText) =>
    paragraphText.toLowerCase().includes(sectionLabel)
  );
  if (headingIndex >= 0) {
    return headingIndex;
  }
  return -1;
}

function ensureCommentsDocument(zip: JSZip) {
  const commentsFile = zip.file("word/comments.xml");
  if (commentsFile) {
    return commentsFile.async("text").then((xml) => new DOMParser().parseFromString(xml, "text/xml"));
  }

  return Promise.resolve(
    new DOMParser().parseFromString(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="${WORD_NS}"></w:comments>`,
      "text/xml"
    )
  );
}

function ensureCommentsRelationship(relsDoc: Document) {
  const relationships = getElementsByLocalName(relsDoc, "Relationship");
  const hasCommentsRel = relationships.some(
    (rel) => rel.getAttribute("Type") === COMMENTS_REL_TYPE || rel.getAttribute("Target") === "comments.xml"
  );
  if (hasCommentsRel) return;

  const ids = relationships
    .map((rel) => rel.getAttribute("Id") ?? "")
    .filter(Boolean)
    .map((id) => Number(id.replace(/^rId/i, "")))
    .filter((value) => Number.isFinite(value));
  const nextId = ids.length ? Math.max(...ids) + 1 : 1;
  const relNode = relsDoc.createElementNS(REL_NS, "Relationship");
  relNode.setAttribute("Id", `rId${nextId}`);
  relNode.setAttribute("Type", COMMENTS_REL_TYPE);
  relNode.setAttribute("Target", "comments.xml");
  relsDoc.documentElement.appendChild(relNode);
}

function ensureCommentsContentType(contentTypesDoc: Document) {
  const overrides = getElementsByLocalName(contentTypesDoc, "Override");
  const hasOverride = overrides.some((node) => node.getAttribute("PartName") === "/word/comments.xml");
  if (hasOverride) return;

  const overrideNode = contentTypesDoc.createElement("Override");
  overrideNode.setAttribute("PartName", "/word/comments.xml");
  overrideNode.setAttribute("ContentType", COMMENTS_CONTENT_TYPE);
  contentTypesDoc.documentElement.appendChild(overrideNode);
}

function createCommentReferenceRun(doc: Document, commentId: string) {
  const run = doc.createElementNS(WORD_NS, "w:r");
  const runProps = doc.createElementNS(WORD_NS, "w:rPr");
  const runStyle = doc.createElementNS(WORD_NS, "w:rStyle");
  runStyle.setAttribute("w:val", "CommentReference");
  runProps.appendChild(runStyle);
  run.appendChild(runProps);

  const reference = doc.createElementNS(WORD_NS, "w:commentReference");
  reference.setAttribute("w:id", commentId);
  run.appendChild(reference);
  return run;
}

function appendCommentEntry(commentsDoc: Document, commentId: string, note: string) {
  const commentNode = commentsDoc.createElementNS(WORD_NS, "w:comment");
  commentNode.setAttribute("w:id", commentId);
  commentNode.setAttribute("w:author", "Safety360Docs Review");
  commentNode.setAttribute("w:initials", "SD");
  commentNode.setAttribute("w:date", new Date().toISOString());

  const paragraph = commentsDoc.createElementNS(WORD_NS, "w:p");
  const run = commentsDoc.createElementNS(WORD_NS, "w:r");
  const text = commentsDoc.createElementNS(WORD_NS, "w:t");
  text.appendChild(commentsDoc.createTextNode(note));
  run.appendChild(text);
  paragraph.appendChild(run);
  commentNode.appendChild(paragraph);
  commentsDoc.documentElement.appendChild(commentNode);
}

export async function annotateCsepReviewDocx(params: {
  buffer: Buffer;
  review: BuilderProgramAiReview;
}) {
  const zip = await JSZip.loadAsync(params.buffer);
  const documentXmlFile = zip.file("word/document.xml");
  const relsFile = zip.file("word/_rels/document.xml.rels");
  const contentTypesFile = zip.file("[Content_Types].xml");

  if (!documentXmlFile || !relsFile || !contentTypesFile) {
    throw new Error("Uploaded DOCX is missing required Word document parts.");
  }

  const [documentXml, relsXml, contentTypesXml, commentsDoc] = await Promise.all([
    documentXmlFile.async("text"),
    relsFile.async("text"),
    contentTypesFile.async("text"),
    ensureCommentsDocument(zip),
  ]);

  const documentDoc = new DOMParser().parseFromString(documentXml, "text/xml");
  const relsDoc = new DOMParser().parseFromString(relsXml, "text/xml");
  const contentTypesDoc = new DOMParser().parseFromString(contentTypesXml, "text/xml");
  const paragraphs = getElementsByLocalName(documentDoc, "p");

  const paragraphTexts = paragraphs.map((paragraph) => {
    const parts: string[] = [];
    collectText(paragraph, parts);
    return normalizeWhitespace(parts.join(" "));
  });

  const commentTargets = buildCommentTargets(params.review);
  const commentPlacements: Array<{ paragraphIndex: number; target: ReviewCommentTarget }> = [];
  const usedParagraphIndexes = new Set<number>();
  for (const target of commentTargets) {
    const bestIndex = findBestParagraphIndex(paragraphTexts, target, usedParagraphIndexes);
    if (bestIndex < 0) continue;
    usedParagraphIndexes.add(bestIndex);
    commentPlacements.push({ paragraphIndex: bestIndex, target });
  }

  const existingComments = getElementsByLocalName(commentsDoc, "comment");
  let nextCommentId = existingComments.length
    ? Math.max(
        ...existingComments.map((node) => Number(node.getAttribute("w:id") ?? node.getAttribute("id") ?? 0))
      ) + 1
    : 0;

  const sortedPlacements = [...commentPlacements].sort(
    (left, right) => right.paragraphIndex - left.paragraphIndex
  );
  for (let placementIndex = 0; placementIndex < sortedPlacements.length; placementIndex += 1) {
    const placement = sortedPlacements[placementIndex];
    const paragraph = paragraphs[placement.paragraphIndex];
    if (!paragraph) continue;

    const commentId = String(nextCommentId++);
    appendCommentEntry(
      commentsDoc,
      commentId,
      composeCommentText(placement.target, sortedPlacements.length - placementIndex)
    );

    const rangeStart = documentDoc.createElementNS(WORD_NS, "w:commentRangeStart");
    rangeStart.setAttribute("w:id", commentId);
    const rangeEnd = documentDoc.createElementNS(WORD_NS, "w:commentRangeEnd");
    rangeEnd.setAttribute("w:id", commentId);
    const referenceRun = createCommentReferenceRun(documentDoc, commentId);

    if (paragraph.firstChild) {
      paragraph.insertBefore(rangeStart, paragraph.firstChild);
    } else {
      paragraph.appendChild(rangeStart);
    }
    paragraph.appendChild(rangeEnd);
    paragraph.appendChild(referenceRun);
  }

  ensureCommentsRelationship(relsDoc);
  ensureCommentsContentType(contentTypesDoc);

  const serializer = new XMLSerializer();
  zip.file("word/document.xml", serializer.serializeToString(documentDoc));
  zip.file("word/comments.xml", serializer.serializeToString(commentsDoc));
  zip.file("word/_rels/document.xml.rels", serializer.serializeToString(relsDoc));
  zip.file("[Content_Types].xml", serializer.serializeToString(contentTypesDoc));

  return zip.generateAsync({ type: "nodebuffer" });
}
