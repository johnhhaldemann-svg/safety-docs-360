import { enforceDraftOnlyStatus, sanitizeGusMessage } from "@/lib/gus/gusSafetyGate";
import type { GusPlanStatus } from "@/lib/gus/gusTypes";
import {
  FORBIDDEN_GUS_OUTPUT_PATTERNS,
  isForbiddenGusAction,
} from "@/lib/gus/gusTrustRules";

export type GusValidationFindingCode =
  | "unsafe_language"
  | "forbidden_action"
  | "non_draft_status";

export type GusValidationFinding = {
  code: GusValidationFindingCode;
  path: string;
  original: string;
  replacement?: string;
  message: string;
};

export type GusValidationResult<TOutput = unknown> = {
  ok: boolean;
  blocked: boolean;
  findings: GusValidationFinding[];
  sanitizedOutput: TOutput;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pathFor(parentPath: string, key: string) {
  return parentPath ? `${parentPath}.${key}` : key;
}

function unsafeLanguageFindings(value: string, path: string): GusValidationFinding[] {
  return FORBIDDEN_GUS_OUTPUT_PATTERNS.flatMap((rule) => {
    const matches = value.match(rule.pattern);
    return matches
      ? [
          {
            code: "unsafe_language" as const,
            path,
            original: matches[0],
            replacement: rule.replacement,
            message: "Gus output used language that could imply approval, compliance, or release for work.",
          },
        ]
      : [];
  });
}

function validateNode(value: unknown, path: string): {
  findings: GusValidationFinding[];
  sanitized: unknown;
} {
  if (typeof value === "string") {
    return {
      findings: unsafeLanguageFindings(value, path),
      sanitized: sanitizeGusMessage(value),
    };
  }

  if (Array.isArray(value)) {
    const sanitizedItems: unknown[] = [];
    const findings: GusValidationFinding[] = [];
    value.forEach((item, index) => {
      const result = validateNode(item, `${path}[${index}]`);
      sanitizedItems.push(result.sanitized);
      findings.push(...result.findings);
    });
    return { findings, sanitized: sanitizedItems };
  }

  if (!isRecord(value)) {
    return { findings: [], sanitized: value };
  }

  const sanitizedRecord: Record<string, unknown> = {};
  const findings: GusValidationFinding[] = [];

  for (const [key, child] of Object.entries(value)) {
    const childPath = pathFor(path, key);
    const result = validateNode(child, childPath);
    sanitizedRecord[key] = result.sanitized;
    findings.push(...result.findings);

    if (key === "actionKey" && typeof child === "string" && isForbiddenGusAction(child)) {
      sanitizedRecord[key] = "recommend_review";
      findings.push({
        code: "forbidden_action",
        path: childPath,
        original: child,
        replacement: "recommend_review",
        message: "Gus cannot perform platform-mutating or approval actions.",
      });
    }

    if (key === "status" && typeof child === "string") {
      const enforcedStatus: GusPlanStatus = enforceDraftOnlyStatus(child);
      if (enforcedStatus !== child) {
        sanitizedRecord[key] = enforcedStatus;
        findings.push({
          code: "non_draft_status",
          path: childPath,
          original: child,
          replacement: enforcedStatus,
          message: "Gus statuses must stay in draft, review, or blocked states.",
        });
      }
    }
  }

  return { findings, sanitized: sanitizedRecord };
}

export function validateGusOutput<TOutput = unknown>(
  output: TOutput
): GusValidationResult<TOutput> {
  const result = validateNode(output, "");
  return {
    ok: result.findings.length === 0,
    blocked: result.findings.some((finding) => finding.code === "forbidden_action"),
    findings: result.findings,
    sanitizedOutput: result.sanitized as TOutput,
  };
}
