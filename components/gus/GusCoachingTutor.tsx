"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import {
  Card,
  PageHeader,
  SectionTitle,
  SelectShell,
  cx,
} from "@/components/safe-predict/SafePredictPrimitives";
import {
  evaluateGusCoachingPractice,
  gusCoachingLessonPlan,
  gusCoachingQuiz,
  gusCoachingScenarios,
  gusCoachingScript,
  gusCoachingTechniques,
  gusPracticeQuestions,
} from "@/lib/gus/gusCoachingTraining";

const coreTechniqueIds = ["active-listening", "powerful-questions", "smart-goals", "feedback-oiqn", "grow-model", "accountability"];

function primaryButtonClass(active = false) {
  return cx(
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
    active
      ? "bg-blue-600 text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)]"
      : "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700",
  );
}

export function GusCoachingTutor() {
  const coreTechniques = useMemo(
    () => coreTechniqueIds.map((id) => gusCoachingTechniques.find((technique) => technique.id === id)).filter(Boolean),
    [],
  );
  const [activeTechniqueId, setActiveTechniqueId] = useState(coreTechniqueIds[0]);
  const [selectedScenarioId, setSelectedScenarioId] = useState(gusCoachingScenarios[0]?.id ?? "");
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizRevealed, setQuizRevealed] = useState(false);

  const activeTechnique = gusCoachingTechniques.find((technique) => technique.id === activeTechniqueId) ?? gusCoachingTechniques[0];
  const selectedScenario = gusCoachingScenarios.find((scenario) => scenario.id === selectedScenarioId) ?? gusCoachingScenarios[0];
  const practiceFeedback = selectedScenario && practiceAnswer.trim().length > 0
    ? evaluateGusCoachingPractice(practiceAnswer, selectedScenario)
    : null;
  const quizScore = gusCoachingQuiz.filter((item) => quizAnswers[item.id] === item.answer).length;

  return (
    <div className="min-h-screen bg-[#f7faff] pb-10">
      <PageHeader
        title="Gus Coaching Tutor"
        subtitle="A practical 20-minute training module that helps Gus coach with questions, listening, SMART goals, feedback, GROW, and accountability."
        actions={
          <a
            href="#practice-with-gus"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-[0_14px_28px_rgba(37,99,235,0.22)] transition hover:bg-blue-700"
          >
            Practice with Gus
            <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
        }
      />

      <div className="grid gap-5 px-4 sm:px-7">
        <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="p-5">
            <SectionTitle
              title="20-minute lesson plan"
              hint="A short training flow Gus can rehearse before coaching a safety conversation."
            />
            <div className="mt-5 grid gap-3">
              {gusCoachingLessonPlan.map((segment) => (
                <div key={segment.minutes} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[5rem_1fr]">
                  <div className="inline-flex h-10 w-fit items-center rounded-lg bg-white px-3 text-sm font-black text-blue-700 shadow-sm">
                    {segment.minutes}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-950">{segment.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{segment.activity}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-950 p-5 text-white">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-blue-500/18 text-blue-100">
                  <GraduationCap className="h-6 w-6" aria-hidden />
                </span>
                <div>
                  <p className="text-lg font-black">Coaching promise</p>
                  <p className="mt-1 text-sm leading-5 text-slate-300">Gus helps people think clearly. Gus does not approve work, replace the safety lead, or act as the competent person.</p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 p-5">
              {["Listen before advising", "Ask one useful field question", "Name behavior, not personality", "End with owner, time, and evidence"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                  <span className="text-sm font-bold text-slate-800">{item}</span>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <Card className="p-5">
          <SectionTitle title="Step-by-step coaching techniques" hint="The core lessons Gus should practice first." />
          <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
            {coreTechniques.map((technique) => technique ? (
              <button
                key={technique.id}
                type="button"
                onClick={() => setActiveTechniqueId(technique.id)}
                className={primaryButtonClass(activeTechnique.id === technique.id)}
              >
                {technique.shortName}
              </button>
            ) : null)}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Technique</p>
              <h2 className="mt-2 text-2xl font-black leading-tight text-slate-950">{activeTechnique.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">{activeTechnique.what}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Why it matters</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{activeTechnique.why}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Simple example</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{activeTechnique.example}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Practice</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{activeTechnique.practice}</p>
              </div>
            </div>
          </div>
        </Card>

        <section id="practice-with-gus" className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="p-5">
            <SectionTitle title="Practice with Gus" hint="A short role-play where Gus chooses a scenario and practices what to say as the coach." />
            <div className="mt-5 grid gap-4">
              <SelectShell
                label="Scenario"
                value={selectedScenarioId}
                onChange={(value) => {
                  setSelectedScenarioId(value);
                  setPracticeAnswer("");
                }}
                options={gusCoachingScenarios.map((scenario) => ({ label: scenario.title, value: scenario.id }))}
              />
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Field context</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{selectedScenario.context}</p>
                <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-slate-500">Coach goal</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{selectedScenario.coachGoal}</p>
              </div>
              <label>
                <span className="mb-2 block text-sm font-black text-slate-800">What would Gus say as the coach?</span>
                <textarea
                  value={practiceAnswer}
                  onChange={(event) => setPracticeAnswer(event.target.value)}
                  rows={6}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold leading-6 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Start with what you notice, ask one field question, and end with the next safe step."
                />
              </label>
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle title="Feedback after each answer" hint="Deterministic practice feedback based on coaching cues, not AI approval." />
            {practiceFeedback ? (
              <div className="mt-5 grid gap-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-emerald-700" aria-hidden />
                    <p className="text-lg font-black text-emerald-950">{practiceFeedback.label}</p>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-emerald-900">Practice score: {practiceFeedback.score} / 5 coaching cues</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Keep doing</p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                      {(practiceFeedback.strengths.length > 0 ? practiceFeedback.strengths : ["You started the practice. Now make it more specific."]).map((item) => (
                        <li key={item} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Try next</p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                      {(practiceFeedback.nextTry.length > 0 ? practiceFeedback.nextTry : ["Rehearse the same answer once more with a calm, direct tone."]).map((item) => (
                        <li key={item} className="flex gap-2">
                          <Target className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 grid min-h-[280px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <div>
                  <MessageSquareText className="mx-auto h-10 w-10 text-blue-600" aria-hidden />
                  <p className="mt-3 text-sm font-black text-slate-900">Choose a scenario and draft Gus&apos;s coaching response.</p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Feedback appears as soon as there is an answer to check.</p>
                </div>
              </div>
            )}
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
          <Card className="p-5">
            <SectionTitle title="One-page cheat sheet" hint="All coaching techniques in compact form." />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {gusCoachingTechniques.map((technique) => (
                <div key={technique.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-sm font-black text-slate-950">{technique.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{technique.what}</p>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-5">
            <Card className="p-5">
              <SectionTitle title="Five role-play scenarios" hint="Safety-specific practice situations." />
              <div className="mt-5 grid gap-3">
                {gusCoachingScenarios.map((scenario, index) => (
                  <div key={scenario.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-black text-slate-950">{index + 1}. {scenario.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{scenario.context}</p>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-5">
              <SectionTitle title="Ten practice questions" hint="Reusable coaching questions Gus can rehearse." />
              <div className="mt-5 grid gap-2">
                {gusPracticeQuestions.map((question, index) => (
                  <div key={question} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-blue-50 text-xs font-black text-blue-700">{index + 1}</span>
                    <p className="text-sm font-semibold leading-6 text-slate-700">{question}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
          <Card className="p-5">
            <SectionTitle
              title="Short quiz"
              action={
                <button type="button" onClick={() => setQuizRevealed((current) => !current)} className={primaryButtonClass(quizRevealed)}>
                  <ClipboardCheck className="h-4 w-4" aria-hidden />
                  {quizRevealed ? "Hide answers" : "Show answers"}
                </button>
              }
              hint="A quick check that Gus understands the coaching basics."
            />
            <div className="mt-5 grid gap-4">
              {gusCoachingQuiz.map((item) => {
                const selected = quizAnswers[item.id] ?? "";
                const correct = selected === item.answer;
                return (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-sm font-black text-slate-950">{item.question}</p>
                    <div className="mt-3 grid gap-2">
                      {item.choices.map((choice) => (
                        <button
                          key={choice}
                          type="button"
                          onClick={() => setQuizAnswers((current) => ({ ...current, [item.id]: choice }))}
                          className={cx(
                            "rounded-lg border px-3 py-2 text-left text-sm font-semibold transition",
                            selected === choice ? "border-blue-400 bg-blue-50 text-blue-950" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                          )}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                    {quizRevealed || selected ? (
                      <div className={cx("mt-3 rounded-lg border p-3 text-sm leading-6", correct ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950")}>
                        <p className="font-black">{correct ? "Correct" : selected ? "Check this one" : `Answer: ${item.answer}`}</p>
                        <p className="mt-1">{item.why}</p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm font-black text-blue-950">
                Current score: {quizScore} / {gusCoachingQuiz.length}
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle title="Conversation script" hint="A short coaching script Gus can rehearse out loud." />
            <div className="mt-5 grid gap-3">
              {gusCoachingScript.map((turn, index) => (
                <div
                  key={`${turn.speaker}-${index}`}
                  className={cx(
                    "rounded-lg border p-4",
                    turn.speaker === "Gus" ? "border-blue-100 bg-blue-50" : "border-slate-200 bg-white",
                  )}
                >
                  <p className={cx("text-xs font-black uppercase tracking-[0.12em]", turn.speaker === "Gus" ? "text-blue-700" : "text-slate-500")}>
                    {turn.speaker}
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{turn.line}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-slate-700" aria-hidden />
                <p className="text-sm font-black text-slate-950">Safety authority guardrail</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Gus can coach, draft, ask questions, and frame the next safe step. Gus cannot approve work, certify compliance, replace a competent person, or remove the safety lead check.
              </p>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
