const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

let nextServer = null;

function showStartupFailure(message) {
  const userData = app.getPath("userData");
  const logPath = path.join(userData, "next-server.log");
  const serverScript = resolveStandaloneServerPath();
  const detail = [
    message,
    "",
    "--- Paths (copy/paste) ---",
    `User data folder:\n${userData}`,
    "",
    `Server log:\n${logPath}`,
    "",
    `Next server script (must exist):\n${serverScript}`,
    "",
    `Packaged app: ${app.isPackaged ? "yes" : "no"}`,
    `Main executable:\n${process.execPath}`,
    "",
    "Tip: Press Win+R, paste %APPDATA%\\SafetyDocs360 Offline Demo and Enter.",
  ].join("\n");

  try {
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(path.join(userData, "READ_ME_FIRST.txt"), `${detail}\n`, "utf8");
  } catch {
    // ignore
  }

  try {
    const idx = dialog.showMessageBoxSync({
      type: "error",
      title: "SafetyDocs360 Offline Demo",
      message: "The offline demo could not start.",
      detail,
      buttons: ["Open user data folder", "Close"],
      defaultId: 0,
      cancelId: 1,
    });
    if (idx === 0) {
      void shell.openPath(userData);
    }
  } catch {
    console.error(detail);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPort(port, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const isOpen = await new Promise((resolve) => {
      const socket = net.createConnection({ port, host: "127.0.0.1" });
      socket.once("connect", () => {
        socket.end();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (isOpen) return;
    await wait(300);
  }
  throw new Error("Timed out waiting for local Next server.");
}

function resolveStandaloneServerPath() {
  if (!app.isPackaged) {
    return path.join(__dirname, "..", ".next", "standalone", "server.js");
  }
  return path.join(process.resourcesPath, "app.asar.unpacked", ".next", "standalone", "server.js");
}

async function startStandaloneServer() {
  const port = Number(process.env.PORT || 38111);
  const serverScript = resolveStandaloneServerPath();
  const standaloneDir = path.dirname(serverScript);
  const logPath = path.join(app.getPath("userData"), "next-server.log");

  if (!fs.existsSync(serverScript)) {
    throw new Error(
      `Next standalone server not found at:\n${serverScript}\n\nRebuild with: npm run desktop:build:web`
    );
  }

  // In a packaged app, `process.execPath` is Electron — not Node. Use Electron's
  // Node-compatible mode so `server.js` actually runs as a real Node process.
  const logStream = fs.createWriteStream(logPath, { flags: "a" });
  logStream.write(`\n--- boot ${new Date().toISOString()} cwd=${standaloneDir} script=${serverScript} port=${port}\n`);

  nextServer = spawn(process.execPath, [serverScript], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      OFFLINE_DESKTOP: "1",
      NEXT_PUBLIC_OFFLINE_DESKTOP: "1",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
    },
    // GUI launches have no console; inheriting stdio can break child startup on Windows.
    stdio: ["ignore", "pipe", "pipe"],
  });

  nextServer.stdout?.on("data", (chunk) => logStream.write(chunk));
  nextServer.stderr?.on("data", (chunk) => logStream.write(chunk));

  await new Promise((resolve, reject) => {
    const onExit = (code, signal) => {
      reject(
        new Error(
          `Next server exited before listening (code=${code ?? "null"}, signal=${signal ?? "null"}).`
        )
      );
    };
    nextServer.once("error", reject);
    nextServer.once("exit", onExit);
    waitForPort(port)
      .then(() => {
        nextServer.removeListener("exit", onExit);
        resolve(undefined);
      })
      .catch((err) => {
        nextServer.removeListener("exit", onExit);
        reject(err);
      });
  });

  return `http://127.0.0.1:${port}`;
}

async function createWindow() {
  const appUrl = await startStandaloneServer();
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    showStartupFailure(
      `Could not load the app in the window.\n\nURL: ${validatedURL}\n${errorDescription} (code ${errorCode})`
    );
  });
  await win.loadURL(appUrl);
}

app.whenReady().then(() => {
  createWindow().catch((error) => {
    console.error("Failed to start desktop shell:", error);
    showStartupFailure(error instanceof Error ? error.message : String(error));
    app.quit();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (nextServer && !nextServer.killed) {
    nextServer.kill("SIGTERM");
  }
});
