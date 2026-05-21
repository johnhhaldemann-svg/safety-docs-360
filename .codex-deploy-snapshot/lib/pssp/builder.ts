import { PSSPForm, rules, Block } from "./config";

export function buildSafetyPlan(form: PSSPForm): Block[] {
  const blocks: Block[] = [];

  for (const rule of rules) {
    if (rule.when(form)) {
      const newBlocks = rule.blocks(form);
      blocks.push(...newBlocks);
    }
  }

  return blocks;
}