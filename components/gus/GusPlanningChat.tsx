"use client";

import type { GusPlanningQuestion } from "@/lib/gus/plans/basePlanningTypes";

type GusPlanningChatProps = {
  questions: GusPlanningQuestion[];
  answers: Record<string, string>;
  onAnswerChange: (questionId: string, value: string) => void;
};

export function GusPlanningChat({ questions, answers, onAnswerChange }: GusPlanningChatProps) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold text-[var(--app-text-strong)]">Guided Questions</h3>
      <div className="space-y-3">
        {questions.map((question, index) => (
          <label key={question.id} className="block rounded-lg border border-[var(--app-border)] bg-white p-3">
            <span className="flex items-start gap-2 text-sm font-semibold text-[var(--app-text-strong)]">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--app-panel-soft)] text-xs text-[var(--app-muted)]">
                {index + 1}
              </span>
              <span>
                {question.prompt}
                {question.required ? <span className="text-red-600"> *</span> : null}
              </span>
            </span>
            {question.helperText ? (
              <span className="mt-1 block text-xs leading-5 text-[var(--app-muted)]">{question.helperText}</span>
            ) : null}
            <textarea
              value={answers[question.id] ?? ""}
              onChange={(event) => onAnswerChange(question.id, event.currentTarget.value)}
              rows={2}
              className="mt-2 min-h-20 w-full resize-y rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-ring)]"
            />
          </label>
        ))}
      </div>
    </section>
  );
}

