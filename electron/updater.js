const path = require("path");
const fs = require("fs");
const { dialog, app } = require("electron");
const { autoUpdater } = require("electron-updater");

let configured = false;
let checking = false;
let logFn = console.error;

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

function ensureConfigured() {
  if (configured) return true;
  if (!app.isPackaged) return false;

  const cfg = loadUpdateConfig();
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  if (cfg.feedUrl) {
    autoUpdater.setFeedURL({ provider: "generic", url: cfg.feedUrl });
  } else {
    autoUpdater.setFeedURL({
      provider: "github",
      owner: cfg.owner,
      repo: cfg.repo,
      private: !!cfg.private,
      token: cfg.token || undefined,
    });
  }

  autoUpdater.on("checking-for-update", () => logFn("Checking for updates…"));
  autoUpdater.on("update-available", (info) =>
    logFn(`Update available: ${info.version}`)
  );
  autoUpdater.on("update-not-available", (info) =>
    logFn(`Up to date (${info.version})`)
  );
  autoUpdater.on("error", (err) => logFn("Auto-updater error", err));
  autoUpdater.on("download-progress", (p) =>
    logFn(`Download ${Math.round(p.percent)}%`)
  );
  autoUpdater.on("update-downloaded", async (info) => {
    logFn(`Update downloaded: ${info.version}`);
    const result = await dialog.showMessageBox({
      type: "info",
      title: "Update ready",
      message: `MyLab ${info.version} is ready to install.`,
      detail:
        "Your local patient data stays on this computer. Restart now to apply the update?",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      cancelId: 1,
    });
    if (result.response === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  });

  configured = true;
  return true;
}

/**
 * Auto-update via GitHub Releases (or a generic public feed).
 * Replaces app binaries only — userData / SQLite is never touched.
 */
function setupAutoUpdater(log) {
  logFn = log || console.error;
  if (!app.isPackaged) {
    logFn("Auto-update skipped (dev mode)");
    return;
  }
  ensureConfigured();
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      logFn("checkForUpdates failed", err);
    });
  }, 5000);
}

async function checkForUpdatesManual() {
  if (!app.isPackaged) {
    await dialog.showMessageBox({
      type: "info",
      title: "Check for updates",
      message: "Updates are only available in the installed desktop app.",
      detail: `Current version: ${app.getVersion()} (development mode)`,
    });
    return { ok: true, mode: "dev", version: app.getVersion() };
  }

  if (!ensureConfigured()) {
    return { ok: false, error: "Updater not configured" };
  }
  if (checking) {
    return { ok: false, error: "Already checking for updates" };
  }

  checking = true;
  try {
    const result = await autoUpdater.checkForUpdates();
    const version = app.getVersion();
    const updateInfo = result?.updateInfo;
    const available =
      updateInfo && updateInfo.version && updateInfo.version !== version;

    if (!available) {
      await dialog.showMessageBox({
        type: "info",
        title: "Check for updates",
        message: "You're up to date.",
        detail: `MyLab ${version} is the latest version.`,
      });
      return { ok: true, updateAvailable: false, version };
    }

    await dialog.showMessageBox({
      type: "info",
      title: "Update available",
      message: `MyLab ${updateInfo.version} is available.`,
      detail: "Downloading in the background. You'll be asked to restart when ready.",
    });
    return {
      ok: true,
      updateAvailable: true,
      version,
      latest: updateInfo.version,
    };
  } catch (err) {
    await dialog.showMessageBox({
      type: "error",
      title: "Update check failed",
      message: "Could not check for updates.",
      detail: String(err && err.message ? err.message : err),
    });
    return { ok: false, error: String(err && err.message ? err.message : err) };
  } finally {
    checking = false;
  }
}

module.exports = { setupAutoUpdater, checkForUpdatesManual };
