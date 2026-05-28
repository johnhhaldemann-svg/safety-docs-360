import { chromium, type FullConfig } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { E2E_ROLE_AUTH, performLogin } from "./tests/helpers/auth";

type AuthTarget = {
  label: string;
  email?: string;
  password?: string;
  fileName: string;
};

async function writeStorageState(baseURL: string, authDir: string, target: AuthTarget) {
  if (!target.email || !target.password) {
    console.log(`[playwright-global-setup] ${target.label} credentials not set - skipping storage state.`);
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  try {
    await performLogin(page, { email: target.email, password: target.password });
    await mkdir(authDir, { recursive: true });
    await context.storageState({ path: join(authDir, target.fileName) });
    console.log(`[playwright-global-setup] Saved ${target.label} storage state to playwright/.auth/${target.fileName}`);
  } catch (e) {
    console.error(`[playwright-global-setup] ${target.label} login failed - authenticated tests may fail:`, e);
    throw e;
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(config: FullConfig) {
  const baseURL =
    config.projects[0]?.use?.baseURL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
  const authDir = join(process.cwd(), "playwright", ".auth");

  const targets: AuthTarget[] = [
    {
      label: "default E2E user",
      email: process.env.E2E_USER_EMAIL,
      password: process.env.E2E_USER_PASSWORD,
      fileName: "user.json",
    },
    ...Object.values(E2E_ROLE_AUTH).map((role) => ({
      label: role.label,
      email: process.env[role.emailEnv],
      password: process.env[role.passwordEnv],
      fileName: role.storageState.split("/").at(-1) ?? `${role.label}.json`,
    })),
  ];

  await mkdir(authDir, { recursive: true }).catch(() => undefined);
  await writeFile(
    join(authDir, "README.txt"),
    [
      "Playwright global setup writes authenticated storage states here when credentials are set.",
      "",
      "Default user: E2E_USER_EMAIL / E2E_USER_PASSWORD -> user.json",
      "Role users:",
      "- E2E_COMPANY_ADMIN_EMAIL / E2E_COMPANY_ADMIN_PASSWORD -> company-admin.json",
      "- E2E_FIELD_USER_EMAIL / E2E_FIELD_USER_PASSWORD -> field-user.json",
      "- E2E_SUPERADMIN_EMAIL / E2E_SUPERADMIN_PASSWORD -> superadmin.json",
      "",
    ].join("\n"),
    "utf8"
  ).catch(() => undefined);

  for (const target of targets) {
    await writeStorageState(baseURL, authDir, target);
  }
}
