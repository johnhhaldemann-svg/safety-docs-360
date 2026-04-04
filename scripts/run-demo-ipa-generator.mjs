/**
 * Runs streamlit/generate_demo_workbook.py with the first Python on PATH.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(root, "streamlit", "generate_demo_workbook.py");

const attempts =
  process.platform === "win32"
    ? [
        ["py", ["-3", script]],
        ["python", [script]],
        ["python3", [script]],
      ]
    : [
        ["python3", [script]],
        ["python", [script]],
      ];

for (const [exe, args] of attempts) {
  const r = spawnSync(exe, args, { cwd: root, encoding: "utf8" });
  if (r.error) {
    if (r.error.code === "ENOENT") {
      continue;
    }
    console.error(r.error);
    process.exit(1);
  }
  if (r.status === 0) {
    process.stdout.write(r.stdout || "");
    process.exit(0);
  }
  if (r.status === 9009) {
    continue;
  }
  process.stderr.write(r.stderr || r.stdout || "");
  process.exit(r.status ?? 1);
}

console.error(
  "No Python found. Run: npm run streamlit:osha:install after installing Python, then npm run streamlit:osha:demo-data"
);
process.exit(1);
