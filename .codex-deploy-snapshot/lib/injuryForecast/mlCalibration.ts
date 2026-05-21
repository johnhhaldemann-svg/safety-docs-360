import type { MlCalibrationHooks } from "./types";

/**
 * Placeholder ML calibration: returns interpretable outputs unchanged until a trained model is injected.
 */
export const defaultMlCalibrationHooks: MlCalibrationHooks = {
  predictProbability: ({ interpretableProbability }) => interpretableProbability,
  predictInjuryTypes: (scores) => scores,
  calibrateWeights: (w) => w,
};
