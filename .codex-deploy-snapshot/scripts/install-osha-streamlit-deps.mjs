/**
 * pip install -r streamlit/requirements.txt using the first Python that works.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const req = join(root, "streamlit", "requirements.txt");

const attempts =
  process.platform === "win32"
    ? [
        ["py", ["-3", "-m", "pip", "install", "-r", req]],
        ["python", ["-m", "pip", "install", "-r", req]],
        ["python3", ["-m", "pip", "install", "-r", req]],
      ]
    : [
        ["python3", ["-m", "pip", "install", "-r", req]],
        ["python", ["-m", "pip", "install", "-r", req]],
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
    console.log("Streamlit dependencies installed.");
    process.exit(0);
  }
  if (r.status === 9009) {
    continue;
  }
  console.error(r.stderr || r.stdout || `pip exited with code ${r.status}`);
  process.exit(r.status ?? 1);
}

console.error(
  "No Python found. Install Python 3 from https://www.python.org/downloads/ (check “Add to PATH”), then run:\n" +
    "  npm run streamlit:osha:install"
);
process.exit(1);
