/**
 * Tunable coefficients for the Dynamic Injury Forecast Engine.
 * Adjust here (and bump `MODEL_VERSION` in `engine.ts`) when calibrating.
 */

export const DYNAMIC_INJURY_FORECAST = {
  MODEL_VERSION: "0.3.0-site-blend",

  /**
   * Thresholds for FULL_DATA vs PARTIAL_DATA vs BENCHMARK_FALLBACK.
   * Tune with product — goal: new tenants always get BENCHMARK or PARTIAL, never empty.
   */
  FORECAST_THRESHOLDS: {
    /** At or below this row count (with weak hours/events) → lean benchmark path. */
    BENCHMARK_SIGNAL_ROWS: 4,
    BENCHMARK_MAX_EVENTS: 3,
    /** Below this inferred hours often meant “tiny default” and forced pure benchmark λ. */
    BENCHMARK_MAX_LABOR_HOURS: 2800,
    ZERO_ROWS_BENCHMARK_HOURS: 2000,

    FULL_MIN_SIGNAL_ROWS: 22,
    FULL_MIN_LABOR_HOURS: 3500,
    FULL_MIN_DISTINCT_MONTHS: 2,
    FULL_MIN_EVENTS: 14,
    FULL_MIN_COMPLETENESS: 0.68,
    FULL_MIN_CORRECTIVE: 2,
    FULL_MIN_INSPECTION_PROXY: 0,
  } as const,

  /** Clamp final confidence score by mode (0–100). */
  MODE_CONFIDENCE: {
    FULL_MIN: 70,
    FULL_MAX: 95,
    PARTIAL_MIN: 45,
    PARTIAL_MAX: 75,
    BENCHMARK_MIN: 22,
    BENCHMARK_MAX: 50,
    PARTIAL_MIN_HYBRID_WEIGHT: 0.22,
    PARTIAL_MAX_HYBRID_WEIGHT: 0.88,
  } as const,

  /** Scales benchmark-core λ before Poisson (separate from full hybrid LAMBDA_SCALE). */
  FALLBACK_LAMBDA_SCALE: 0.052,

  /** Floor so missing-data Poisson output does not read as “no risk”; keep low enough to separate calm vs hot sites. */
  MIN_DISPLAY_RISK_SCORE: 5,

  /** Blended final score: ML placeholder mirrors interpretable until a model is wired. */
  INTERPRETABLE_WEIGHT: 0.6,
  ML_WEIGHT: 0.4,

  /** Poisson λ scale: maps dimensionless layer product into a 30-day intensity. TUNE — not empirically fit yet. */
  LAMBDA_SCALE: 0.012,

  BASELINE: {
    /** Floor/ceiling for credibility z. */
    Z_MIN: 0.15,
    Z_MAX: 0.92,
    /** Incident counts → z curve (piecewise). */
    SMALL_MAX: 3,
    MEDIUM_MAX: 12,
    Z_SMALL: 0.22,
    Z_MED: 0.55,
    Z_LARGE: 0.88,
    /** Minimum benchmark rate so λ does not collapse. */
    BENCHMARK_FLOOR: 0.003,
    BENCHMARK_CAP: 0.08,
  },

  EXPOSURE: {
    LN_HOURS_COEF: 0.35,
    LN_HEADCOUNT_COEF: 0.2,
    LN_HIGH_RISK_TASKS_COEF: 0.15,
    LN_SIMULT_TRADES_COEF: 0.1,
    LN_EQUIPMENT_COEF: 0.1,
    MAX_MULTIPLIER: 3.5,
  },

  LEADING: {
    SEVERITY_LOW: 1,
    SEVERITY_MEDIUM: 2,
    SEVERITY_HIGH: 4,
    SEVERITY_CRITICAL: 6,
    HOURS_PER_OBS_REF: 200,
    W_SEVERITY_NORM: 0.3,
    W_NEAR_MISS: 0.2,
    W_INSP_FAIL: 0.25,
    W_OVERDUE: 0.25,
    PRESSURE_CAP: 2.2,
  },

  TREND: {
    SENSITIVITY: 0.5,
    MIN_MULT: 0.65,
    MAX_MULT: 1.75,
    STABLE_EPS: 0.04,
  },

  FATIGUE: {
    LONG_SHIFT_THRESHOLD: 10,
    LONG_SHIFT_BUMP: 0.2,
    HIGH_WEEKLY_THRESHOLD: 50,
    HIGH_WEEKLY_BUMP: 0.15,
    NIGHT_BUMP: 0.1,
    CONSEC_DAYS_THRESHOLD: 7,
    CONSEC_BUMP: 0.1,
    MAX_MULT: 1.65,
  },

  WEATHER: {
    RAIN: 0.18,
    WIND: 0.15,
    TEMP_STRESS: 0.12,
    VIS: 0.1,
    SLIP: 0.1,
    SEASON: 0.08,
    MAX_MULTIPLIER: 2.1,
  },

  UNCERTAINTY: {
    W_INCOMPLETE: 0.25,
    W_TRADE_MAP: 0.15,
    W_LATE: 0.1,
    W_SEV: 0.1,
    W_CLOSEOUT: 0.08,
    W_STALE: 0.12,
    MAX_MULTIPLIER: 1.85,
  },

  CONFIDENCE: {
    W_COMPLETE: 0.28,
    W_FRESH: 0.22,
    W_MAPPING: 0.2,
    W_CLOSEOUT: 0.15,
    W_CONSISTENCY: 0.15,
  },
} as const;
