const path = require("path");
const fs = require("fs");
const { dialog, app } = require("electron");
const { autoUpdater } = require("electron-updater");

function loadUpdateConfig() {
  try {
    const cfgPath = path.join(__dirname, "update-config.json");
    if (fs.existsSync(cfgPath)) {
      return JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    }
  } catch (_) {
    // fall through
  }
  return {
    owner: "saurabhinno",
    repo: "mylab-manager",
    private: true,
    feedUrl: null,
    token: null,
  };
}

/**
 * Auto-update via GitHub Releases (or a generic public feed).
 * Replaces app binaries only — userData / SQLite is never touched.
 */
function setupAutoUpdater(log) {
  if (!app.isPackaged) {
    log("Auto-update skipped (dev mode)");
    return;
  }

  const cfg = loadUpdateConfig();
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  if (cfg.feedUrl) {
    autoUpdater.setFeedURL({
      provider: "generic",
      url: cfg.feedUrl,
    });
    log(`Update feed: generic ${cfg.feedUrl}`);
  } else {
    autoUpdater.setFeedURL({
      provider: "github",
      owner: cfg.owner,
      repo: cfg.repo,
      private: !!cfg.private,
      token: cfg.token || undefined,
    });
    log(
      `Update feed: GitHub ${cfg.owner}/${cfg.repo} (token=${
        cfg.token ? "yes" : "no"
      })`
    );
  }

  autoUpdater.on("checking-for-update", () => log("Checking for updates…"));
  autoUpdater.on("update-available", (info) =>
    log(`Update available: ${info.version}`)
  );
  autoUpdater.on("update-not-available", (info) =>
    log(`Up to date (${info.version})`)
  );
  autoUpdater.on("error", (err) => log("Auto-updater error", err));
  autoUpdater.on("download-progress", (p) =>
    log(`Download ${Math.round(p.percent)}%`)
  );

  autoUpdater.on("update-downloaded", async (info) => {
    log(`Update downloaded: ${info.version}`);
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

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log("checkForUpdates failed", err);
    });
  }, 5000);
}

module.exports = { setupAutoUpdater };
