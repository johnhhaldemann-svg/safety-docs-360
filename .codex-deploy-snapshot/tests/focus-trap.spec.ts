import { test, expect } from "./fixtures";
import { hasE2ECredentials } from "./helpers/auth";
import { expectAuthenticatedShellUrl } from "./helpers/sessionWait";

/**
 * Focus-trap contract tests.
 *
 * All three custom overlays (AppCommandPalette, DownloadConfirmModal,
 * MarketplacePreviewModal) share a single primitive — `useFocusTrap` in
 * `lib/hooks/useFocusTrap.ts`. The Command Palette is the deterministic
 * target: it is globally reachable via Ctrl+K on any authenticated page and
 * does not require any specific workspace data to exist, so verifying the
 * full keyboard contract here proves the shared primitive is correct.
 */
test.describe("Focus trap — AppCommandPalette", () => {
  test.beforeEach(() => {
    test.skip(
      !hasE2ECredentials(),
      "Requires E2E_USER_EMAIL and E2E_USER_PASSWORD (modals live behind authentication)."
    );
  });

  test("Tab / Shift+Tab stay inside the dialog, Esc closes, focus returns to trigger", async ({
    page,
  }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expectAuthenticatedShellUrl(page, "/dashboard");

    const trigger = page.locator("aside nav a[href^='/']").first();
    await expect(trigger).toBeVisible({ timeout: 25_000 });
    await trigger.focus();

    const triggerTag = await trigger.evaluate((node) => node.tagName);
    const triggerHref = await trigger.evaluate((node) => (node as HTMLAnchorElement).href);

    await page.keyboard.press("Control+K");

    const dialog = page.getByRole("dialog", { name: "Go to page" });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toHaveAttribute("aria-modal", "true");

    const searchInput = dialog.locator("#command-palette-input");
    await expect(searchInput).toBeFocused();

    // Tab forward several times — focus must never escape the dialog.
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      const focusedInsideDialog = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"][aria-label="Go to page"]');
        return Boolean(dialog && document.activeElement && dialog.contains(document.activeElement));
      });
      expect(focusedInsideDialog, `Tab press #${i + 1} escaped the dialog`).toBe(true);
    }

    // Shift+Tab backward — focus must never escape the dialog.
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Shift+Tab");
      const focusedInsideDialog = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"][aria-label="Go to page"]');
        return Boolean(dialog && document.activeElement && dialog.contains(document.activeElement));
      });
      expect(focusedInsideDialog, `Shift+Tab press #${i + 1} escaped the dialog`).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    // Focus should return to the element that triggered the open.
    await expect
      .poll(
        async () =>
          page.evaluate(
            ({ tag, href }) => {
              const active = document.activeElement as HTMLElement | null;
              if (!active) return false;
              if (active.tagName !== tag) return false;
              if (tag === "A") {
                return (active as HTMLAnchorElement).href === href;
              }
              return true;
            },
            { tag: triggerTag, href: triggerHref }
          ),
        {
          timeout: 5_000,
          intervals: [50, 100, 200, 400],
          message: "Focus did not return to the element that opened the Command Palette.",
        }
      )
      .toBe(true);
  });

  test("open dialog has the required ARIA contract (role, aria-modal, labelled)", async ({
    page,
  }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expectAuthenticatedShellUrl(page, "/dashboard");

    await page.keyboard.press("Control+K");

    const dialog = page.getByRole("dialog", { name: "Go to page" });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toHaveAttribute("aria-label", "Go to page");

    // The first interactive element (the search input) is auto-focused.
    await expect(dialog.locator("#command-palette-input")).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });
});
