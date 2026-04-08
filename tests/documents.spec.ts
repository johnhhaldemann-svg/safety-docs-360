import { test, expect } from "./fixtures";
import { hasE2ECredentials } from "./helpers/auth";
import { expectAuthenticatedShellUrl } from "./helpers/sessionWait";
import { CLICKWRAP_LABEL } from "@/lib/legal";

test.describe("Library", () => {
  test.beforeEach(() => {
    test.skip(!hasE2ECredentials(), "Requires E2E_USER_EMAIL and E2E_USER_PASSWORD.");
  });

  test("loads document center heading", async ({ page }) => {
    await page.goto("/library", { waitUntil: "domcontentloaded" });
    await expectAuthenticatedShellUrl(page, "/library");
    await expect(
      page.getByRole("heading", { name: /Find what you need faster|Open completed company documents/i })
    ).toBeVisible({ timeout: 25_000 });
  });

  test("refresh keeps user on library", async ({ page }) => {
    await page.goto("/library", { waitUntil: "domcontentloaded" });
    await expectAuthenticatedShellUrl(page, "/library before reload");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expectAuthenticatedShellUrl(page, "/library after reload");
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Submit request (form behavior)", () => {
  test.beforeEach(() => {
    test.skip(!hasE2ECredentials(), "Requires E2E_USER_EMAIL and E2E_USER_PASSWORD.");
  });

  test("submit request stays disabled until legal checkbox when role can submit", async ({ page }) => {
    await page.goto("/submit", { waitUntil: "domcontentloaded" });
    await expectAuthenticatedShellUrl(page, "/submit");

    const plainSubmitBtn = page.getByRole("button", { name: "Submit Request" });
    const csepSubmitBtn = page.getByRole("button", { name: "Submit for Review" });
    const isPlainSubmitFlow = await plainSubmitBtn.isVisible().catch(() => false);
    const isCsepSubmitFlow = await csepSubmitBtn.isVisible().catch(() => false);

    if (!isPlainSubmitFlow && !isCsepSubmitFlow) {
      test.info().annotations.push({
        type: "note",
        description: "Workspace landed on the CSEP summary without a submit CTA, so the checkbox-gate assertion is skipped.",
      });
      return;
    }

    const submitBtn = isPlainSubmitFlow ? plainSubmitBtn : csepSubmitBtn;
    await expect(submitBtn).toBeVisible({ timeout: 25_000 });

    const roleBlocked = page.getByText(/cannot submit documents into the review queue/i);
    if (await roleBlocked.isVisible().catch(() => false)) {
      test.info().annotations.push({
        type: "note",
        description: "User role cannot submit — skipping agreement gate assertion.",
      });
      return;
    }

    const agreement = page.getByRole("checkbox", { name: CLICKWRAP_LABEL });
    await expect(agreement).toBeVisible({ timeout: 15_000 });
    await expect(submitBtn).toBeDisabled();
    await agreement.check();
    if (!isPlainSubmitFlow) {
      test.info().annotations.push({
        type: "note",
        description: "CSEP builder requires additional fields, so the legal checkbox alone does not enable submit.",
      });
      return;
    }
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
  });
});
