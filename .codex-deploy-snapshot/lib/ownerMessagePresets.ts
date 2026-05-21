export type OwnerMessagePreset = {
  id: string;
  title: string;
  message: string;
};

export const OWNER_MESSAGE_PRESETS: readonly OwnerMessagePreset[] = [
  {
    id: "safety-protects-people-and-name",
    title: "Safety Protects Our People and Our Name",
    message:
      "Safety, health, and environmental performance are part of how we protect our workforce, our clients, and the reputation we have earned. Compliance establishes the minimum expectation, but our standard is disciplined execution. Every employee and contractor represents this project and our company, and we expect work to be planned and performed with care.",
  },
  {
    id: "standards-apply-to-every-partner",
    title: "Our Standards Apply to Every Partner",
    message:
      "Contractors and project partners are an extension of our work. We expect every organization on our sites to follow the same safety, health, and environmental standards we require of ourselves. Safe work is productive work, and we will only support work practices that protect people, property, the environment, and the communities around us.",
  },
  {
    id: "ehs-supports-strong-projects",
    title: "Strong EHS Performance Supports Strong Projects",
    message:
      "Safety and environmental compliance are not separate from project success. They help reduce downtime, prevent rework, protect schedules, and strengthen client confidence. Our goal is clear: no injuries, no environmental harm, and no avoidable surprises. That is how we deliver work the right way.",
  },
  {
    id: "every-worker-can-stop-unsafe-work",
    title: "Every Worker Can Stop Unsafe Work",
    message:
      "Every person on this project has both the authority and the responsibility to speak up when something is unsafe. If a condition, task, or work method creates unacceptable risk, work must stop until it is corrected. Leadership will support those decisions. A strong safety culture depends on trust, communication, and action.",
  },
  {
    id: "environmental-responsibility",
    title: "We Build With Environmental Responsibility",
    message:
      "Our responsibility extends beyond the limits of the jobsite. Waste, spills, stormwater, air quality, material handling, and community impact must be managed with care. Environmental compliance is not a paperwork exercise; it is part of responsible construction and part of leaving each site better controlled than we found it.",
  },
  {
    id: "everyone-goes-home-safe",
    title: "Everyone Goes Home Safe",
    message:
      "The most important measure of project success is that every worker leaves the site healthy and unharmed. Production, budget, and schedule matter, but none of them justify risking a life. We invest in planning, training, supervision, and proper equipment because protecting people is the foundation of our work.",
  },
  {
    id: "environmental-care-leadership-duty",
    title: "Environmental Care Is A Leadership Duty",
    message:
      "Environmental compliance is a leadership responsibility built into daily decisions. From waste handling and spill prevention to stormwater protection and chemical management, our teams are expected to act with integrity and discipline. We do not aim for the bare minimum; we aim to manage our work responsibly.",
  },
  {
    id: "ehs-results-protect-business",
    title: "Safety And Environmental Results Protect The Business",
    message:
      "Safe operations and strong environmental controls help projects run better. They reduce risk, prevent delays, protect our reputation, and build confidence with clients and regulators. Our commitment to people and the environment is the right thing to do and a practical advantage that keeps the company strong.",
  },
  {
    id: "defend-safe-workplace",
    title: "We Defend The Right To A Safe Workplace",
    message:
      "No worker should feel pressured to take shortcuts or accept unsafe conditions. Employees and contractors are expected to report hazards, stop unsafe work, and request corrections when needed. Leadership stands behind that responsibility. Safety is not optional, and it will not be traded for speed or convenience.",
  },
  {
    id: "build-responsibly",
    title: "We Build Responsibly",
    message:
      "Our projects affect workers, clients, properties, and surrounding communities. We expect every team and partner to manage that responsibility with professionalism and care. From preventing spills and controlling emissions to planning each task safely, our legacy is shaped by both the quality of our work and the way we protect people and places.",
  },
];

export function getOwnerMessagePreset(id: string) {
  return OWNER_MESSAGE_PRESETS.find((preset) => preset.id === id) ?? null;
}
