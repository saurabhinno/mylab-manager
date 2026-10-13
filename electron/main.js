const { app, BrowserWindow, shell, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");
const {
  setupAutoUpdater,
  checkForUpdatesManual,
  downloadUpdate,
  installUpdate,
  getStatus: getUpdateStatus,
} = require("./updater");
const { createDriveBackup } = require("./drive-backup");

const API_PORT = process.env.MYLAB_API_PORT || "47821";
const APP_PORT = process.env.MYLAB_APP_PORT || "47822";

let mainWindow = null;
let apiChild = null;
let nextChild = null;
let shuttingDown = false;
let logStream = null;
let drive = null;
let sharedEnv = null;

const isDev = !app.isPackaged;

function userPaths() {
  const base = app.getPath("userData");
  const db = isDev
    ? path.join(__dirname, "..", "data", "mylab.sqlite")
    : path.join(base, "mylab.sqlite");
  const uploads = isDev
    ? path.join(__dirname, "..", "express-api", "uploads")
    : path.join(base, "uploads");
  return {
    base,
    db,
    uploads,
    log: path.join(base, "mylab-desktop.log"),
  };
}

function log(message, err) {
  const line = `[${new Date().toISOString()}] ${message}${
    err ? `\n${err.stack || err}` : ""
  }\n`;
  try {
    if (!logStream) {
      const { log: logPath } = userPaths();
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      logStream = fs.createWriteStream(logPath, { flags: "a" });
    }
    logStream.write(line);
  } catch (_) {}
  console.error(message, err || "");
}

function waitForUrl(url, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
        } else {
          setTimeout(tick, 300);
        }
      });
    };
    tick();
  });
}

function spawnNode(scriptPath, env, cwd) {
  const childEnv = {
    ...process.env,
    ...env,
    ELECTRON_RUN_AS_NODE: "1",
  };
  const child = spawn(process.execPath, [scriptPath], {
    env: childEnv,
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (buf) => log(`[child stdout] ${buf}`));
  child.stderr.on("data", (buf) => log(`[child stderr] ${buf}`));
  child.on("exit", (code) => {
    if (!shuttingDown && code && code !== 0) {
      log(`Child exited (${scriptPath}): ${code}`);
    }
  });
  child.on("error", (err) => log(`Failed to spawn ${scriptPath}`, err));
  return child;
}

function startApiOnly() {
  if (isDev) return; // API is started by npm scripts in dev
  const resources = process.resourcesPath;
  const apiEntry = path.join(resources, "api", "index.js");
  apiChild = spawnNode(
    apiEntry,
    {
      ...sharedEnv,
      PORT: API_PORT,
    },
    path.join(resources, "api")
  );
}

async function restartApiAfterRestore() {
  if (isDev) {
    await dialog.showMessageBox({
      type: "info",
      title: "Restore complete",
      message: "Cloud backup restored.",
      detail: "Restart the desktop:dev process (or reload) so the API picks up the restored database.",
    });
    return;
  }
  if (apiChild && !apiChild.killed) {
    apiChild.kill();
    apiChild = null;
  }
  await new Promise((r) => setTimeout(r, 500));
  startApiOnly();
  await waitForUrl(`http://127.0.0.1:${API_PORT}/health`);
}

function startServers() {
  const { db, uploads } = userPaths();
  fs.mkdirSync(uploads, { recursive: true });
  fs.mkdirSync(path.dirname(db), { recursive: true });

  sharedEnv = {
    DESKTOP: "1",
    DB_DIALECT: "sqlite",
    SQLITE_PATH: db,
    UPLOADS_DIR: uploads,
    NODE_ENV: isDev ? "development" : "production",
    FRONTEND_URL: `http://127.0.0.1:${APP_PORT}`,
  };

  if (isDev) {
    const apiPort = process.env.MYLAB_DEV_API_PORT || "4000";
    const appPort = process.env.MYLAB_DEV_APP_PORT || "3000";
    return Promise.all([
      waitForUrl(`http://localhost:${apiPort}/health`),
      waitForUrl(`http://localhost:${appPort}`),
    ]).then(() => ({
      appUrl: `http://localhost:${appPort}`,
    }));
  }

  const resources = process.resourcesPath;
  const apiEntry = path.join(resources, "api", "index.js");
  const nextEntry = path.join(resources, "app-server", "server.js");

  if (!fs.existsSync(apiEntry)) {
    throw new Error(`API entry missing: ${apiEntry}`);
  }
  if (!fs.existsSync(nextEntry)) {
    throw new Error(`App server entry missing: ${nextEntry}`);
  }

  log(`Starting API from ${apiEntry}`);
  startApiOnly();

  log(`Starting Next from ${nextEntry}`);
  nextChild = spawnNode(
    nextEntry,
    {
      ...sharedEnv,
      PORT: APP_PORT,
      HOSTNAME: "127.0.0.1",
      NEXT_PUBLIC_API_URL: `http://127.0.0.1:${API_PORT}`,
    },
    path.join(resources, "app-server")
  );

  return Promise.all([
    waitForUrl(`http://127.0.0.1:${API_PORT}/health`),
    waitForUrl(`http://127.0.0.1:${APP_PORT}`),
  ]).then(() => ({
    appUrl: `http://127.0.0.1:${APP_PORT}`,
  }));
}

function createWindow(appUrl) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    title: "MyLab",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadURL(appUrl);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function stopChildren() {
  shuttingDown = true;
  for (const child of [apiChild, nextChild]) {
    if (child && !child.killed) {
      child.kill();
    }
  }
}

async function showStartupError(err) {
  const { log: logPath } = userPaths();
  log("Failed to start MyLab", err);
  await dialog.showMessageBox({
    type: "error",
    title: "MyLab failed to start",
    message: "MyLab could not start its local services.",
    detail: `${err && err.message ? err.message : String(err)}\n\nLog file:\n${logPath}`,
  });
}

function initDrive() {
  const paths = userPaths();
  drive = createDriveBackup({
    userDataPath: paths.base,
    dbPath: paths.db,
    uploadsPath: paths.uploads,
    log,
  });

  ipcMain.handle("drive:getStatus", async () => drive.getStatus());
  ipcMain.handle("drive:backupNow", async () => drive.uploadBackup());
  ipcMain.handle("drive:restore", async () => {
    const confirm = await dialog.showMessageBox({
      type: "warning",
      title: "Restore cloud backup?",
      message: "Replace local data with the Google Drive backup?",
      detail: "Current local data will be overwritten. This cannot be undone.",
      buttons: ["Restore", "Cancel"],
      defaultId: 1,
      cancelId: 1,
    });
    if (confirm.response !== 0) return { ok: false, cancelled: true };
    const restored = await drive.downloadBackup();
    if (restored.ok) await restartApiAfterRestore();
    return restored;
  });

  drive.startSchedule();

  ipcMain.handle("updates:getStatus", async () => getUpdateStatus());
  ipcMain.handle("updates:check", async () => checkForUpdatesManual());
  ipcMain.handle("updates:download", async () => downloadUpdate());
  ipcMain.handle("updates:install", async () => {
    // Stop API/Next children so quitAndInstall can actually exit on macOS.
    if (drive) drive.stopSchedule();
    stopChildren();
    return installUpdate();
  });
  ipcMain.handle("updates:getVersion", async () => app.getVersion());
}

async function maybeAutoRestoreFromDrive() {
  if (!drive || !drive.isConfigured()) return;
  try {
    const status = await drive.getStatus();
    if (!(status.remote && status.localIsEmpty)) return;
    const answer = await dialog.showMessageBox({
      type: "question",
      title: "Restore from Google Drive?",
      message: "A cloud backup was found.",
      detail:
        "This computer has little or no local data. Restore the cloud backup now?",
      buttons: ["Restore now", "Skip"],
      defaultId: 0,
      cancelId: 1,
    });
    if (answer.response === 0) {
      const restored = await drive.downloadBackup();
      if (restored.ok) await restartApiAfterRestore();
    }
  } catch (err) {
    log("Auto-restore check failed", err);
  }
}

app.whenReady().then(async () => {
  try {
    log("MyLab starting (packaged=" + app.isPackaged + ")");
    initDrive();
    const { appUrl } = await startServers();
    log(`Services ready, opening ${appUrl}`);
    createWindow(appUrl);
    await maybeAutoRestoreFromDrive();
    setupAutoUpdater(log, {
      beforeInstall: () => {
        if (drive) drive.stopSchedule();
        stopChildren();
      },
    });
  } catch (err) {
    await showStartupError(err);
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const appUrl = isDev
        ? `http://localhost:${process.env.MYLAB_DEV_APP_PORT || "3000"}`
        : `http://127.0.0.1:${APP_PORT}`;
      createWindow(appUrl);
    }
  });
});

app.on("window-all-closed", () => {
  if (drive) drive.stopSchedule();
  stopChildren();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (drive) drive.stopSchedule();
  stopChildren();
});
