export const APP_BRAND = {
  productName: "SafePredict",
  shortName: "SafePredict",
  description: "Safety operations for risk, compliance, documentation, and field execution.",
  supportEmailFallback: "support@example.com",
  defaultMobileApiBaseUrl: "https://app.safepredict.com/api/mobile",
} as const;

export function productSentence(prefix?: string) {
  return [prefix, APP_BRAND.description].filter(Boolean).join(": ");
}

export function defaultNwsUserAgent() {
  return `${APP_BRAND.productName}/1.0 ${APP_BRAND.supportEmailFallback}`;
}

export function defaultGusResearchUserAgent() {
  return `${APP_BRAND.productName}-GusVerifiedLearning/1.0`;
}
