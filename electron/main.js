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
const { createAnalyzerService } = require("./analyzers");

const API_PORT = process.env.MYLAB_API_PORT || "47821";
const APP_PORT = process.env.MYLAB_APP_PORT || "47822";

let mainWindow = null;
let apiChild = null;
let nextChild = null;
let shuttingDown = false;
/** Skip close confirmation (user confirmed, or update install). */
let quitConfirmed = false;
let logStream = null;
let drive = null;
let analyzers = null;
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

/**
 * After NSIS quitAndInstall, Electron can relaunch before extraResources
 * (api / app-server) finish copying. Wait briefly instead of failing hard.
 */
function waitForPackagedEntries(timeoutMs = 90000) {
  const resources = process.resourcesPath;
  const apiEntry = path.join(resources, "api", "index.js");
  const nextEntry = path.join(resources, "app-server", "server.js");
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const tick = () => {
      const apiOk = fs.existsSync(apiEntry);
      const nextOk = fs.existsSync(nextEntry);
      if (apiOk && nextOk) {
        resolve({ apiEntry, nextEntry, resources });
        return;
      }
      if (Date.now() - started > timeoutMs) {
        const missing = [
          !apiOk ? apiEntry : null,
          !nextOk ? nextEntry : null,
        ].filter(Boolean);
        reject(
          new Error(
            `App files missing after update (installer may still be copying):\n${missing.join("\n")}`
          )
        );
        return;
      }
      if ((Date.now() - started) % 5000 < 600) {
        log(
          `Waiting for packaged files… api=${apiOk} app-server=${nextOk}`
        );
      }
      setTimeout(tick, 400);
    };
    tick();
  });
}

async function startServers(extraEnv = {}) {
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
    ...extraEnv,
  };

  if (isDev) {
    const apiPort = process.env.MYLAB_DEV_API_PORT || "4000";
    const appPort = process.env.MYLAB_DEV_APP_PORT || "3000";
    await Promise.all([
      waitForUrl(`http://localhost:${apiPort}/health`),
      waitForUrl(`http://localhost:${appPort}`),
    ]);
    return { appUrl: `http://localhost:${appPort}` };
  }

  const { apiEntry, nextEntry, resources } = await waitForPackagedEntries();

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

  await Promise.all([
    waitForUrl(`http://127.0.0.1:${API_PORT}/health`),
    waitForUrl(`http://127.0.0.1:${APP_PORT}`),
  ]);
  return { appUrl: `http://127.0.0.1:${APP_PORT}` };
}

/** Electron bug: after native alert/confirm, inputs stop accepting keystrokes until blur+focus. */
function restoreWindowFocus(win) {
  const target = win && !win.isDestroyed() ? win : mainWindow;
  if (!target || target.isDestroyed()) return;
  try {
    target.blur();
    setTimeout(() => {
      if (!target.isDestroyed()) target.focus();
    }, 10);
  } catch (err) {
    log("restoreWindowFocus failed", err);
  }
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

  mainWindow.on("close", (event) => {
    if (quitConfirmed || shuttingDown) return;
    event.preventDefault();
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: "question",
      title: "MyLab",
      message: "Are you sure you want to close the application?",
      buttons: ["Cancel", "Close"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (choice === 1) {
      quitConfirmed = true;
      mainWindow.close();
    } else {
      restoreWindowFocus(mainWindow);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerDialogIpc() {
  ipcMain.on("dialog:alert", (event, message) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    dialog.showMessageBoxSync(win || undefined, {
      type: "info",
      title: "MyLab",
      message: String(message ?? ""),
      buttons: ["OK"],
      defaultId: 0,
    });
    restoreWindowFocus(win);
    event.returnValue = undefined;
  });

  ipcMain.on("dialog:confirm", (event, message) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = dialog.showMessageBoxSync(win || undefined, {
      type: "question",
      title: "MyLab",
      message: String(message ?? ""),
      buttons: ["Cancel", "OK"],
      defaultId: 1,
      cancelId: 0,
    });
    restoreWindowFocus(win);
    event.returnValue = result === 1;
  });

  ipcMain.on("dialog:restore-focus", (event) => {
    restoreWindowFocus(BrowserWindow.fromWebContents(event.sender));
  });

  /**
   * One-click print: render the open report, open the normal Windows print
   * dialog (via Edge — Electron's own print dialog fails on Epson USB).
   */
  ipcMain.handle("print:page", async (event) => {
    const wc = event.sender;
    const parent = BrowserWindow.fromWebContents(wc);
    log("print:page");
    try {
      if (parent && !parent.isDestroyed()) {
        if (parent.isMinimized()) parent.restore();
        parent.focus();
      }

      const pdfBuffer = await wc.printToPDF({
        printBackground: true,
        pageSize: "A4",
        preferCSSPageSize: true,
        margins: { marginType: "none" },
      });
      const filePath = path.join(
        app.getPath("temp"),
        `mylab-report-${Date.now()}.pdf`
      );
      fs.writeFileSync(filePath, pdfBuffer);

      await openReportForPrint(filePath);
      await openWindowsPrintDialog();

      setTimeout(() => {
        try {
          fs.unlinkSync(filePath);
        } catch (_) {}
      }, 300000);

      restoreWindowFocus(parent);
      return { ok: true };
    } catch (err) {
      log("print:page failed", err);
      restoreWindowFocus(parent);
      return {
        ok: false,
        error: err && err.message ? err.message : String(err),
      };
    }
  });
}

function findEdgePath() {
  const candidates = [
    path.join(
      process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)",
      "Microsoft",
      "Edge",
      "Application",
      "msedge.exe"
    ),
    path.join(
      process.env.PROGRAMFILES || "C:\\Program Files",
      "Microsoft",
      "Edge",
      "Application",
      "msedge.exe"
    ),
    path.join(
      process.env.LOCALAPPDATA || "",
      "Microsoft",
      "Edge",
      "Application",
      "msedge.exe"
    ),
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

/** Open the report PDF in Edge (system PDF viewer). */
function openReportForPrint(filePath) {
  return new Promise((resolve, reject) => {
    const edge = findEdgePath();
    if (edge) {
      const child = spawn(edge, [filePath], {
        detached: true,
        stdio: "ignore",
      });
      child.on("error", reject);
      child.unref();
      resolve();
      return;
    }
    shell
      .openPath(filePath)
      .then((errMsg) => (errMsg ? reject(new Error(errMsg)) : resolve()))
      .catch(reject);
  });
}

/** Open the standard Windows print dialog (Ctrl+P in Edge). */
function openWindowsPrintDialog() {
  return new Promise((resolve) => {
    const script = [
      "Start-Sleep -Seconds 2",
      "$w = New-Object -ComObject WScript.Shell",
      "foreach ($t in @('Edge','msedge','PDF','mylab-report')) {",
      "  if ($w.AppActivate($t)) { break }",
      "}",
      "Start-Sleep -Milliseconds 400",
      "$w.SendKeys('^p')",
    ].join("; ");
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-WindowStyle", "Hidden", "-Command", script],
      { windowsHide: true, stdio: "ignore" }
    );
    const done = () => resolve();
    child.on("exit", done);
    child.on("error", done);
    setTimeout(done, 6000);
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
    const confirm = await dialog.showMessageBox(mainWindow || undefined, {
      type: "warning",
      title: "Restore cloud backup?",
      message: "Replace local data with the Google Drive backup?",
      detail: "Current local data will be overwritten. This cannot be undone.",
      buttons: ["Restore", "Cancel"],
      defaultId: 1,
      cancelId: 1,
    });
    restoreWindowFocus(mainWindow);
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
    quitConfirmed = true;
    if (drive) drive.stopSchedule();
    stopChildren();
    return installUpdate();
  });
  ipcMain.handle("updates:getVersion", async () => app.getVersion());
}

function initAnalyzers() {
  analyzers = createAnalyzerService({
    log,
    getMainWindow: () => mainWindow,
  });

  ipcMain.handle("analyzers:listPorts", async () => analyzers.listPorts());
  ipcMain.handle("analyzers:getStatus", async () => analyzers.getStatus());
  ipcMain.handle("analyzers:getRaw", async () => ({
    raw: analyzers.getRawBuffer(),
  }));
  ipcMain.handle("analyzers:clearRaw", async () => {
    analyzers.clearRawBuffer();
    return { ok: true };
  });
  ipcMain.handle("analyzers:open", async (_e, path, options) => {
    try {
      return await analyzers.openAndListen(path, options || {});
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  });
  ipcMain.handle("analyzers:close", async () => {
    await analyzers.closeActive();
    return { ok: true };
  });
  ipcMain.handle("analyzers:startLan", async (_e, port) => {
    try {
      return await analyzers.startLan(port);
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  });
  ipcMain.handle("analyzers:stopLan", async () => {
    try {
      return await analyzers.stopLan();
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  });
  ipcMain.handle("analyzers:probeHost", async (_e, host, ports) => {
    try {
      return await analyzers.probeHost(host, ports);
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  });
  ipcMain.handle("analyzers:connectLan", async (_e, host, port) => {
    try {
      return await analyzers.connectLan(host, port);
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  });
  ipcMain.handle("analyzers:disconnectLanClient", async () => {
    try {
      analyzers.disconnectLanClient();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  });

  analyzers.startPolling();
  // Cellenium Net/HL7: listen as soon as desktop starts so the machine can
  // push without the operator opening Analyzers or clicking Start.
  analyzers
    .startLan()
    .then((res) => {
      if (res && res.ok) {
        log(`LAN auto-listen on port ${res.port || 5100}`);
      } else {
        log("LAN auto-listen failed", res && res.error);
      }
    })
    .catch((err) => log("LAN auto-listen error", err));

  if (typeof analyzers.startUsb === "function") {
    analyzers
      .startUsb()
      .then((res) => {
        if (res && res.ok) {
          log(`Clinitek USB open on ${res.path || "FTDI"}`);
        } else {
          log("Clinitek USB not opened", res && res.error);
        }
      })
      .catch((err) => log("Clinitek USB error", err));
  }
}

/**
 * Prefer Drive restore over factory seed on empty machines.
 * Returns whether catalogue seed was deferred and must be finalized after.
 */
async function maybeAutoRestoreFromDrive() {
  if (!drive || !drive.isConfigured()) return { deferredSeed: false, restored: false };
  try {
    const status = await drive.getStatus();
    if (!(status.remote && status.localIsEmpty)) {
      return { deferredSeed: false, restored: false };
    }
    const answer = await dialog.showMessageBox(mainWindow || undefined, {
      type: "question",
      title: "Restore from Google Drive?",
      message: "A cloud backup was found.",
      detail:
        "This computer has little or no local data. Restore the lab backup (including your test catalogue) now? Choosing Skip will load the built-in starter catalogue once.",
      buttons: ["Restore now", "Skip"],
      defaultId: 0,
      cancelId: 1,
    });
    restoreWindowFocus(mainWindow);
    if (answer.response === 0) {
      const restored = await drive.downloadBackup();
      if (restored.ok) {
        // Clear defer flag before API restart so restored DB is used as-is.
        if (sharedEnv) sharedEnv.MYLAB_DEFER_CATALOGUE_SEED = "0";
        await restartApiAfterRestore();
        return { deferredSeed: true, restored: true };
      }
    }
    return { deferredSeed: true, restored: false };
  } catch (err) {
    log("Auto-restore check failed", err);
    return { deferredSeed: false, restored: false };
  }
}

app.whenReady().then(async () => {
  try {
    log("MyLab starting (packaged=" + app.isPackaged + ")");
    registerDialogIpc();
    initDrive();

    // If local DB is empty and Drive may have a backup, defer factory seed
    // until the user restores or skips — otherwise seed would block restore.
    const deferCatalogueSeed =
      !isDev &&
      !!drive &&
      drive.isConfigured() &&
      typeof drive.localIsEmpty === "function" &&
      drive.localIsEmpty();

    // Wait for packaged api/app-server before analyzers — post-NSIS relaunch
    // can start while files are still being copied.
    const { appUrl } = await startServers({
      MYLAB_DEFER_CATALOGUE_SEED: deferCatalogueSeed ? "1" : "0",
    });
    initAnalyzers();
    log(
      `Services ready, opening ${appUrl}` +
        (deferCatalogueSeed ? " (catalogue seed deferred for Drive)" : "")
    );
    createWindow(appUrl);

    if (deferCatalogueSeed) {
      const result = await maybeAutoRestoreFromDrive();
      if (!result.restored) {
        // User skipped (or restore failed): allow one-time factory seed.
        if (sharedEnv) sharedEnv.MYLAB_DEFER_CATALOGUE_SEED = "0";
        await restartApiAfterRestore();
        log("Catalogue seed allowed after Drive restore prompt");
      }
    } else {
      await maybeAutoRestoreFromDrive();
    }

    restoreWindowFocus(mainWindow);
    setupAutoUpdater(log, {
      beforeInstall: () => {
        quitConfirmed = true;
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
  if (analyzers) {
    analyzers.stopPolling();
    analyzers.closeActive();
    analyzers.stopLan();
  }
  stopChildren();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (drive) drive.stopSchedule();
  if (analyzers) {
    analyzers.stopPolling();
    analyzers.closeActive();
    analyzers.stopLan();
  }
  stopChildren();
});
