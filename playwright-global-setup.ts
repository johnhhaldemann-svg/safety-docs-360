import { chromium, type FullConfig } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performLogin } from "./tests/helpers/auth";

export default async function globalSetup(config: FullConfig) {
  const baseURL =
    config.projects[0]?.use?.baseURL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  const authDir = join(process.cwd(), "playwright", ".auth");
  const authFile = join(authDir, "user.json");

  if (!email || !password) {
    console.log(
      "[playwright-global-setup] E2E_USER_EMAIL / E2E_USER_PASSWORD not set — skipping authenticated storage state."
    );
    await mkdir(authDir, { recursive: true }).catch(() => undefined);
    await writeFile(
      join(authDir, "README.txt"),
      "When E2E_USER_EMAIL and E2E_USER_PASSWORD are set, global setup writes user.json here.\n",
      "utf8"
    ).catch(() => undefined);
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  try {
    await performLogin(page, { email, password });
    await mkdir(authDir, { recursive: true });
    await context.storageState({ path: authFile });
    console.log("[playwright-global-setup] Saved storage state to playwright/.auth/user.json");
  } catch (e) {
    console.error("[playwright-global-setup] Login failed — authenticated tests may fail:", e);
    throw e;
  } finally {
    await browser.close();
  }
}
