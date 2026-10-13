const path = require("path");
const fs = require("fs");
const { BrowserWindow, app } = require("electron");
const { autoUpdater } = require("electron-updater");

let configured = false;
let logFn = console.error;
let installHook = null;

/** @type {{
 *  status: 'idle'|'checking'|'available'|'downloading'|'ready'|'latest'|'error'|'dev',
 *  currentVersion: string,
 *  latestVersion: string|null,
 *  percent: number,
 *  transferred: number,
 *  total: number,
 *  error: string|null,
 *  message: string|null,
 * }} */
let state = {
  status: "idle",
  currentVersion: "0.0.0",
  latestVersion: null,
  percent: 0,
  transferred: 0,
  total: 0,
  error: null,
  message: null,
};

function loadUpdateConfig() {
  try {
    const cfgPath = path.join(__dirname, "update-config.json");
    if (fs.existsSync(cfgPath)) {
      return JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    }
  } catch (_) {}
  return {
    owner: "saurabhinno",
    repo: "mylab-manager",
    private: true,
    feedUrl: null,
    token: null,
  };
}

function broadcast() {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send("updates:status", { ...state });
    } catch (_) {}
  }
}

function setState(patch) {
  state = { ...state, ...patch };
  broadcast();
}

function getStatus() {
  return {
    ...state,
    currentVersion: app.isPackaged ? app.getVersion() : state.currentVersion,
    packaged: app.isPackaged,
  };
}

function ensureConfigured() {
  if (configured) return true;
  if (!app.isPackaged) return false;

  const cfg = loadUpdateConfig();
  // Manual download so the Updates page can show progress and an Update button.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;

  if (cfg.token) {
    process.env.GH_TOKEN = cfg.token;
    process.env.GITHUB_TOKEN = cfg.token;
  }

  if (cfg.feedUrl) {
    autoUpdater.setFeedURL({ provider: "generic", url: cfg.feedUrl });
    logFn("Updater: generic feed configured");
  } else {
    const token =
      cfg.token || process.env.GH_TOKEN || process.env.GITHUB_TOKEN || null;
    if (!token) {
      logFn(
        "Updater: no GitHub token baked in — private Releases will 404. Rebuild with MYLAB_GH_UPDATE_TOKEN."
      );
    } else {
      logFn("Updater: GitHub feed configured (token present)");
    }
    autoUpdater.setFeedURL({
      provider: "github",
      owner: cfg.owner,
      repo: cfg.repo,
      private: !!cfg.private,
      token: token || undefined,
    });
  }

  autoUpdater.on("checking-for-update", () => {
    setState({
      status: "checking",
      error: null,
      message: "Checking for updates…",
      percent: 0,
    });
  });

  autoUpdater.on("update-available", (info) => {
    setState({
      status: "available",
      latestVersion: info.version,
      error: null,
      message: `MyLab ${info.version} is available.`,
      percent: 0,
    });
  });

  autoUpdater.on("update-not-available", (info) => {
    setState({
      status: "latest",
      latestVersion: info.version,
      error: null,
      message: "You're up to date.",
      percent: 0,
    });
  });

  autoUpdater.on("error", (err) => {
    setState({
      status: "error",
      error: String(err && err.message ? err.message : err),
      message: "Update failed.",
    });
    logFn("Auto-updater error", err);
  });

  autoUpdater.on("download-progress", (p) => {
    setState({
      status: "downloading",
      percent: Math.max(0, Math.min(100, Number(p.percent) || 0)),
      transferred: Number(p.transferred) || 0,
      total: Number(p.total) || 0,
      message: `Downloading… ${Math.round(p.percent || 0)}%`,
      error: null,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    setState({
      status: "ready",
      latestVersion: info.version,
      percent: 100,
      error: null,
      message: `MyLab ${info.version} downloaded. Restart to install.`,
    });
    logFn(`Update downloaded: ${info.version}`);
  });

  configured = true;
  return true;
}

/**
 * Auto-update via GitHub Releases (or a generic public feed).
 * Replaces app binaries only — userData / SQLite is never touched.
 */
function setupAutoUpdater(log, opts = {}) {
  logFn = log || console.error;
  installHook = typeof opts.beforeInstall === "function" ? opts.beforeInstall : null;
  state.currentVersion = app.getVersion();

  if (!app.isPackaged) {
    setState({
      status: "dev",
      currentVersion: app.getVersion(),
      message: "Updates are only available in the installed desktop app.",
    });
    logFn("Auto-update skipped (dev mode)");
    return;
  }

  ensureConfigured();
  // Quiet background check — no dialogs; Updates page shows result.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      logFn("Background checkForUpdates failed", err);
    });
  }, 8000);
}

async function checkForUpdatesManual() {
  state.currentVersion = app.getVersion();

  if (!app.isPackaged) {
    setState({
      status: "dev",
      currentVersion: app.getVersion(),
      message: "Updates are only available in the installed desktop app.",
    });
    return getStatus();
  }

  if (!ensureConfigured()) {
    setState({ status: "error", error: "Updater not configured", message: null });
    return getStatus();
  }

  if (state.status === "checking" || state.status === "downloading") {
    return getStatus();
  }

  try {
    setState({
      status: "checking",
      error: null,
      message: "Checking for updates…",
      percent: 0,
    });
    const result = await autoUpdater.checkForUpdates();
    const version = app.getVersion();
    const latest = result?.updateInfo?.version || null;
    const available = latest && latest !== version;

    // Events usually set state, but ensure we land correctly if they raced.
    if (state.status === "checking") {
      if (available) {
        setState({
          status: "available",
          latestVersion: latest,
          message: `MyLab ${latest} is available.`,
          error: null,
        });
      } else {
        setState({
          status: "latest",
          latestVersion: latest || version,
          message: "You're up to date.",
          error: null,
        });
      }
    }
    return getStatus();
  } catch (err) {
    setState({
      status: "error",
      error: String(err && err.message ? err.message : err),
      message: "Could not check for updates.",
    });
    return getStatus();
  }
}

async function downloadUpdate() {
  if (!app.isPackaged) {
    return getStatus();
  }
  if (!ensureConfigured()) {
    setState({ status: "error", error: "Updater not configured" });
    return getStatus();
  }

  try {
    setState({
      status: "downloading",
      percent: 0,
      message: "Starting download…",
      error: null,
    });
    await autoUpdater.downloadUpdate();
    return getStatus();
  } catch (err) {
    setState({
      status: "error",
      error: String(err && err.message ? err.message : err),
      message: "Download failed.",
    });
    return getStatus();
  }
}

function installUpdate() {
  if (!app.isPackaged) {
    return { ok: false, error: "Not packaged" };
  }
  if (state.status !== "ready") {
    return { ok: false, error: "Update is not ready to install yet." };
  }

  try {
    if (installHook) {
      try {
        installHook();
      } catch (err) {
        logFn("beforeInstall hook failed", err);
      }
    }

    logFn("Installing update via quitAndInstall…");
    // Force-run after install; kill child servers first via installHook.
    setImmediate(() => {
      try {
        for (const win of BrowserWindow.getAllWindows()) {
          try {
            win.removeAllListeners("close");
            win.destroy();
          } catch (_) {}
        }
        autoUpdater.quitAndInstall(false, true);
      } catch (err) {
        logFn("quitAndInstall threw", err);
        app.exit(0);
      }
    });

    // Fallback if quitAndInstall stalls (common with child node processes on macOS).
    setTimeout(() => {
      logFn("quitAndInstall fallback → app.exit");
      app.exit(0);
    }, 3500);

    return { ok: true };
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    setState({ status: "error", error: msg, message: "Install failed." });
    return { ok: false, error: msg };
  }
}

module.exports = {
  setupAutoUpdater,
  checkForUpdatesManual,
  downloadUpdate,
  installUpdate,
  getStatus,
};
