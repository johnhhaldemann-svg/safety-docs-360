export type GusCoachingTechnique = {
  id: string;
  title: string;
  shortName: string;
  what: string;
  why: string;
  example: string;
  practice: string;
};

export type GusCoachingLessonSegment = {
  minutes: string;
  title: string;
  activity: string;
};

export type GusCoachingScenario = {
  id: string;
  title: string;
  context: string;
  coachGoal: string;
  strongAnswerCues: string[];
};

export type GusCoachingQuizQuestion = {
  id: string;
  question: string;
  choices: string[];
  answer: string;
  why: string;
};

export const gusCoachingTechniques: GusCoachingTechnique[] = [
  {
    id: "active-listening",
    title: "Active listening",
    shortName: "Listen first",
    what: "Give the person your full attention, reflect what you heard, and check that you understood.",
    why: "People are more open to coaching when they feel heard before they are corrected.",
    example: "It sounds like the crew is worried the lift plan changed after the morning huddle.",
    practice: "Reflect one sentence back before asking your next question.",
  },
  {
    id: "powerful-questions",
    title: "Ask powerful questions",
    shortName: "Ask better",
    what: "Use open questions that help the person think, not yes-or-no questions that shut thinking down.",
    why: "A good question helps the crew own the next safe step.",
    example: "What could change on site today that would make this task less safe?",
    practice: "Rewrite a command as a question that starts with what or how.",
  },
  {
    id: "smart-goals",
    title: "Set SMART goals",
    shortName: "Make it clear",
    what: "Make the goal specific, measurable, achievable, relevant, and time-bound.",
    why: "Clear goals are easier to follow up on and harder to ignore.",
    example: "Before the 1 p.m. lift, the foreman will walk the barricade line and send one photo to the safety lead.",
    practice: "Turn a vague safety goal into one clear action with an owner and time.",
  },
  {
    id: "feedback-oiqn",
    title: "Feedback: Observation -> Impact -> Question -> Next step",
    shortName: "Feedback loop",
    what: "Name the behavior you saw, explain the impact, ask a coaching question, then agree on the next step.",
    why: "This keeps feedback practical and avoids blaming the person.",
    example:
      "I saw the ladder set on uneven ground. That can shift while someone climbs. What needs to change before it is used? Next, move it to firm level footing.",
    practice: "Give feedback about a behavior without calling the person careless.",
  },
  {
    id: "grow-model",
    title: "Use the GROW model",
    shortName: "GROW",
    what: "Guide the conversation through Goal, Reality, Options, and Way forward.",
    why: "GROW keeps coaching calm when a situation feels messy.",
    example: "Goal: safe access. Reality: the stair tower is blocked. Options: clear it, use another route, or delay. Way forward: clear and mark the route.",
    practice: "Pick one scenario and ask one question for each GROW step.",
  },
  {
    id: "accountability",
    title: "Use accountability",
    shortName: "Follow through",
    what: "Agree on who owns the next step, when it happens, and what evidence shows it is done.",
    why: "Coaching turns into safety improvement only when someone follows through.",
    example: "Jose owns the housekeeping fix before lunch and will show the cleared walkway photo in the action queue.",
    practice: "End a coaching conversation with owner, time, and evidence.",
  },
  {
    id: "behavior-not-personality",
    title: "Focus on behavior, not personality",
    shortName: "Behavior only",
    what: "Talk about what someone did or did not do, not who they are.",
    why: "Behavior can change. Labels make people defensive.",
    example: "Say, 'The guardrail gap is still open,' not, 'You are being unsafe.'",
    practice: "Change one personality label into a behavior statement.",
  },
  {
    id: "self-reflection",
    title: "Encourage self-reflection",
    shortName: "Let them think",
    what: "Ask people to notice their own choices, risks, and next steps.",
    why: "People remember lessons better when they discover part of the answer themselves.",
    example: "What would you want the next crew to notice before they start here?",
    practice: "Ask a question that helps the worker evaluate the setup.",
  },
  {
    id: "small-actions",
    title: "Break big goals into small actions",
    shortName: "Small steps",
    what: "Turn a large improvement into the next action someone can do today.",
    why: "Small actions reduce overwhelm and create momentum.",
    example: "Start by marking the exclusion zone, then update the JSA before the crew restarts.",
    practice: "Split one broad goal into three field steps.",
  },
  {
    id: "positive-reinforcement",
    title: "Use positive reinforcement",
    shortName: "Name what works",
    what: "Point out useful behavior so the person knows what to repeat.",
    why: "Good coaching builds confidence and repeats the right habits.",
    example: "The way you stopped to check the permit limit helped the crew slow down before hot work started.",
    practice: "Name one specific behavior you want a worker to repeat.",
  },
  {
    id: "limiting-beliefs",
    title: "Challenge limiting beliefs",
    shortName: "Open options",
    what: "Gently question statements like 'that will never work' or 'we always do it this way.'",
    why: "Limiting beliefs can hide safer options.",
    example: "What is one small change we could try before deciding it will not work?",
    practice: "Respond to 'We do not have time' with a curious safety question.",
  },
  {
    id: "demonstrate-practice",
    title: "Demonstrate, then practice",
    shortName: "Show, then try",
    what: "Show the skill once, then let the person practice while you coach.",
    why: "People learn field habits by seeing and doing, not only hearing.",
    example: "Show a three-point contact check, then ask the worker to demonstrate it back.",
    practice: "Pick one safety behavior Gus can model in words before asking the user to try.",
  },
  {
    id: "coach-strengths",
    title: "Coach strengths",
    shortName: "Use strengths",
    what: "Use what the person already does well as a bridge to the next improvement.",
    why: "Strength-based coaching feels respectful and practical.",
    example: "You are good at spotting access issues. Use that same eye on the material staging area.",
    practice: "Connect one strength to one safety improvement.",
  },
  {
    id: "psychological-safety",
    title: "Create psychological safety",
    shortName: "Make it safe to speak",
    what: "Make it clear that raising a concern is welcome and will not be punished.",
    why: "Crews speak up sooner when the conversation feels fair.",
    example: "Thanks for raising it. Let us look at the control together before the task moves on.",
    practice: "Write one sentence that makes it easier to report a concern.",
  },
  {
    id: "feedforward",
    title: "Use feedforward",
    shortName: "Look ahead",
    what: "Focus on what to try next instead of replaying every past mistake.",
    why: "Forward-looking coaching keeps the conversation useful.",
    example: "Next time the plan changes, what cue will tell you to pause and update the briefing?",
    practice: "Turn one correction into a next-time question.",
  },
  {
    id: "silence",
    title: "Let silence work",
    shortName: "Pause",
    what: "Ask the question, then give the person time to think before filling the space.",
    why: "Silence can help people give a better answer instead of the fastest answer.",
    example: "Ask, 'What are we missing?' then wait.",
    practice: "Write a question that deserves a quiet pause.",
  },
  {
    id: "adjust-style",
    title: "Adjust coaching style",
    shortName: "Meet the moment",
    what: "Use a direct style for urgent risk and a reflective style when there is time to learn.",
    why: "The right tone helps the person hear the message.",
    example: "Critical risk: direct next safe step. Planning session: slower questions and reflection.",
    practice: "Choose when Gus should be direct and when Gus should ask a reflective question.",
  },
];

export const gusCoachingLessonPlan: GusCoachingLessonSegment[] = [
  {
    minutes: "0-3",
    title: "Set the coaching promise",
    activity: "Gus learns that coaching means helping a person think clearly, choose the next safe step, and keep authority with the responsible safety lead.",
  },
  {
    minutes: "3-8",
    title: "Listen and ask",
    activity: "Practice active listening, one reflection, and one powerful question for a real field concern.",
  },
  {
    minutes: "8-12",
    title: "Turn ideas into goals",
    activity: "Convert a broad safety concern into a SMART goal with owner, time, and evidence.",
  },
  {
    minutes: "12-16",
    title: "Give useful feedback",
    activity: "Use Observation -> Impact -> Question -> Next step while staying focused on behavior, not personality.",
  },
  {
    minutes: "16-20",
    title: "Practice the full loop",
    activity: "Run one GROW scenario, add accountability, name a strength, and end with a forward-looking next step.",
  },
];

export const gusCoachingScenarios: GusCoachingScenario[] = [
  {
    id: "ladder-access",
    title: "Ladder access concern",
    context: "A worker set a ladder on uneven ground because the usual access point is blocked.",
    coachGoal: "Help the worker identify the behavior, risk, safer option, owner, and timing.",
    strongAnswerCues: ["uneven ground", "access", "what", "next", "before"],
  },
  {
    id: "permit-change",
    title: "Hot work permit changed",
    context: "The crew says the work area changed after the permit was prepared.",
    coachGoal: "Guide the person in charge to walk permit limits before work continues.",
    strongAnswerCues: ["permit", "changed", "safety lead", "field", "work"],
  },
  {
    id: "housekeeping",
    title: "Housekeeping drift",
    context: "Material is creeping into the walkway near an active task.",
    coachGoal: "Use behavior-focused feedback and a small action with visible evidence.",
    strongAnswerCues: ["walkway", "material", "owner", "photo", "today"],
  },
  {
    id: "training-gap",
    title: "Training readiness question",
    context: "A newer worker is about to join a task that requires equipment-specific training.",
    coachGoal: "Ask a powerful question and route the readiness check without approving the worker.",
    strongAnswerCues: ["training", "task", "ready", "check", "lead"],
  },
  {
    id: "rushed-briefing",
    title: "Rushed pre-task briefing",
    context: "The crew wants to skip a deeper JSA discussion because the schedule is tight.",
    coachGoal: "Challenge the limiting belief while keeping the conversation respectful.",
    strongAnswerCues: ["time", "risk", "question", "small", "step"],
  },
];

export const gusPracticeQuestions = [
  "What changed in the field since the plan was written?",
  "What risk would the crew want to know before starting?",
  "What control would make the biggest difference right now?",
  "Who owns the next safe step?",
  "What evidence will show the control is in place?",
  "What strength can this crew use to solve the issue?",
  "What is one small step we can take before the next task?",
  "What would make it easier for someone to speak up here?",
  "What should happen next time this same cue appears?",
  "What question should Gus ask before giving advice?",
];

export const gusCoachingQuiz: GusCoachingQuizQuestion[] = [
  {
    id: "feedback-order",
    question: "Which order keeps feedback behavior-focused?",
    choices: ["Impact -> Blame -> Fix", "Observation -> Impact -> Question -> Next step", "Question -> Order -> Approval"],
    answer: "Observation -> Impact -> Question -> Next step",
    why: "It names what happened, explains why it matters, invites thinking, and lands on a safe next step.",
  },
  {
    id: "smart",
    question: "Which goal is most SMART?",
    choices: [
      "Be safer tomorrow.",
      "Fix housekeeping soon.",
      "Maria clears the east walkway by 10 a.m. and uploads one photo.",
    ],
    answer: "Maria clears the east walkway by 10 a.m. and uploads one photo.",
    why: "It has an owner, action, time, and evidence.",
  },
  {
    id: "authority",
    question: "What should Gus avoid saying?",
    choices: ["I can help draft questions.", "The safety lead should check this.", "This work is approved."],
    answer: "This work is approved.",
    why: "Gus can coach and draft, but cannot approve work or act as the safety authority.",
  },
  {
    id: "grow",
    question: "In GROW, what does Reality mean?",
    choices: ["The current facts in the field", "The final approval", "The score Gus gives the worker"],
    answer: "The current facts in the field",
    why: "Reality is the honest current state before options are chosen.",
  },
  {
    id: "silence",
    question: "When should Gus let silence work?",
    choices: ["After asking a thoughtful field question", "Before explaining any context", "When urgent risk needs a direct next step"],
    answer: "After asking a thoughtful field question",
    why: "A short pause gives the person time to think and own the answer.",
  },
];

export const gusCoachingScript = [
  { speaker: "Gus", line: "I am seeing the walkway narrowing near the active task. What changed since the morning setup?" },
  { speaker: "Worker", line: "Material deliveries came in faster than expected, so we stacked them close." },
  { speaker: "Gus", line: "So the crew solved the delivery issue, but the access route is now tighter. That can affect escape, trip risk, and equipment movement." },
  { speaker: "Gus", line: "What is the smallest move that opens the route before the next task starts?" },
  { speaker: "Worker", line: "We can shift the pallets behind the marked line." },
  { speaker: "Gus", line: "Good. Who owns that move, and what evidence will show the route is clear?" },
  { speaker: "Worker", line: "I will own it and send a photo before the next crew comes through." },
  { speaker: "Gus", line: "That is the next safe step. Keep it draft-only in the system until the safety lead check is complete." },
];

export function evaluateGusCoachingPractice(answer: string, scenario: GusCoachingScenario) {
  const normalized = answer.trim().toLowerCase();
  const matchedCues = scenario.strongAnswerCues.filter((cue) => normalized.includes(cue.toLowerCase()));
  const hasQuestion = answer.includes("?");
  const hasNextStep = /\b(next|before|owner|time|evidence|photo|check|walk)\b/i.test(answer);
  const behaviorFocused = !/\bcareless|lazy|bad attitude|unsafe person|reckless\b/i.test(answer);
  const enoughDetail = normalized.split(/\s+/).filter(Boolean).length >= 14;
  const score = [hasQuestion, hasNextStep, behaviorFocused, enoughDetail, matchedCues.length >= 2].filter(Boolean).length;

  return {
    label: score >= 4 ? "Strong coaching move" : score >= 3 ? "Good start" : "Keep practicing",
    score,
    strengths: [
      ...(hasQuestion ? ["You asked a question instead of jumping straight to a command."] : []),
      ...(hasNextStep ? ["You included a next step or ownership cue."] : []),
      ...(behaviorFocused ? ["You kept the focus on behavior instead of personality."] : []),
    ],
    nextTry: [
      ...(!hasQuestion ? ["Add one open question that starts with what or how."] : []),
      ...(!hasNextStep ? ["End with owner, timing, or evidence for the next safe step."] : []),
      ...(!behaviorFocused ? ["Remove labels about the person and name the field behavior instead."] : []),
      ...(!enoughDetail ? ["Add enough context that the safety lead would know what to check."] : []),
      ...(matchedCues.length < 2 ? [`Tie your answer closer to this scenario: ${scenario.strongAnswerCues.slice(0, 3).join(", ")}.`] : []),
    ],
  };
}
