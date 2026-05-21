/**
 * Runs the OSHA IPA Streamlit app from the repo root.
 * Tries py -3 (Windows), then python3, then python.
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = join(root, "streamlit", "osha_compliance_tracker.py");
const streamlitArgs = ["-m", "streamlit", "run", scriptPath];

const attempts =
  process.platform === "win32"
    ? [
        ["py", ["-3", ...streamlitArgs]],
        ["python", streamlitArgs],
        ["python3", streamlitArgs],
      ]
    : [
        ["python3", streamlitArgs],
        ["python", streamlitArgs],
      ];

function trySpawn(index) {
  if (index >= attempts.length) {
    console.error(
      "Could not start Streamlit: no working Python found. Install Python 3 from python.org, then:\n" +
        "  python -m pip install -r streamlit/requirements.txt\n" +
        "  npm run streamlit:osha"
    );
    process.exit(1);
  }

  const [exe, args] = attempts[index];
  const child = spawn(exe, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env },
  });

  let settled = false;

  child.once("error", (err) => {
    if (settled) return;
    if (err && "code" in err && err.code === "ENOENT") {
      settled = true;
      trySpawn(index + 1);
      return;
    }
    console.error(err);
    process.exit(1);
  });

  child.once("exit", (code, signal) => {
    if (settled) return;
    settled = true;
    if (signal) {
      process.exit(1);
      return;
    }
    // Missing executable: try next candidate (do not retry on import errors — run pip install).
    if (code === 9009 || code === 127) {
      trySpawn(index + 1);
      return;
    }
    process.exit(code ?? 0);
  });
}

trySpawn(0);
