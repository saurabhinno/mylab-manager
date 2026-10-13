const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Readable } = require("stream");
const { google } = require("googleapis");
const { safeStorage } = require("electron");

const dns = require("dns").promises;

const BACKUP_NAME = "mylab-backup.v1.bin";
const KEY_NAME = "mylab-backup.key.v1";
const BACKUP_FOLDER_NAME = "MyLab Backups";
/** Auto-backup interval while MyLab is open and online */
const BACKUP_INTERVAL_MS = 5 * 60 * 1000;
const BACKUP_FIRST_DELAY_MS = 20 * 1000;

function loadDriveConfig(userDataPath) {
  const candidates = [
    // Allow drop-in config on a machine without rebuilding
    userDataPath ? path.join(userDataPath, "drive-config.json") : null,
    path.join(__dirname, "drive-config.json"),
    path.join(__dirname, "update-config.json"),
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      const clientId = j.googleClientId || j.clientId || "";
      const clientSecret = j.googleClientSecret || j.clientSecret || "";
      const refreshToken = j.googleRefreshToken || j.refreshToken || "";
      if (clientId && refreshToken) {
        return { clientId, clientSecret, refreshToken };
      }
    } catch (_) {}
  }
  return {
    clientId: process.env.GOOGLE_DRIVE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET || "",
    refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN || "",
  };
}

function encryptString(plain) {
  if (safeStorage.isEncryptionAvailable()) {
    return {
      type: "safeStorage",
      data: safeStorage.encryptString(plain).toString("base64"),
    };
  }
  return { type: "plain", data: plain };
}

function decryptString(payload) {
  if (!payload) return null;
  if (payload.type === "safeStorage") {
    return safeStorage.decryptString(Buffer.from(payload.data, "base64"));
  }
  return payload.data;
}

/**
 * Single-account mode: one Gmail refresh token baked into the build.
 * No per-user Google login in the UI.
 */
function createDriveBackup({ userDataPath, dbPath, uploadsPath, log }) {
  const metaPath = path.join(userDataPath, "drive-meta.json");
  const keyPath = path.join(userDataPath, "drive-backup.key");

  let scheduledInterval = null;
  let scheduledFirstTimer = null;
  let backingUp = false;
  let cachedEmail = null;

  async function isOnline() {
    try {
      await dns.resolve("www.googleapis.com");
      return true;
    } catch {
      try {
        await dns.resolve("dns.google");
        return true;
      } catch {
        return false;
      }
    }
  }

  function readMeta() {
    if (!fs.existsSync(metaPath)) return {};
    try {
      return JSON.parse(fs.readFileSync(metaPath, "utf8"));
    } catch {
      return {};
    }
  }

  function writeMeta(patch) {
    const next = { ...readMeta(), ...patch };
    fs.writeFileSync(metaPath, JSON.stringify(next, null, 2));
    return next;
  }

  function isConfigured() {
    const cfg = loadDriveConfig(userDataPath);
    return !!(cfg.clientId && cfg.refreshToken);
  }

  function oauth2Client() {
    const cfg = loadDriveConfig(userDataPath);
    if (!cfg.clientId || !cfg.refreshToken) {
      throw new Error(
        "Cloud backup is not configured. Set GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_REFRESH_TOKEN (run: node scripts/google-drive-get-token.js)."
      );
    }
    const client = new google.auth.OAuth2(
      cfg.clientId,
      cfg.clientSecret || undefined
    );
    client.setCredentials({ refresh_token: cfg.refreshToken });
    return client;
  }

  async function driveApi() {
    const auth = oauth2Client();
    return google.drive({ version: "v3", auth });
  }

  async function resolveEmail() {
    if (cachedEmail) return cachedEmail;
    try {
      const auth = oauth2Client();
      const oauth2 = google.oauth2({ version: "v2", auth });
      const me = await oauth2.userinfo.get();
      cachedEmail = me.data.email || null;
    } catch (_) {
      cachedEmail = null;
    }
    return cachedEmail;
  }

  function getOrCreateBackupKey() {
    if (fs.existsSync(keyPath)) {
      const raw = JSON.parse(fs.readFileSync(keyPath, "utf8"));
      return Buffer.from(decryptString(raw), "base64");
    }
    const key = crypto.randomBytes(32);
    fs.writeFileSync(
      keyPath,
      JSON.stringify(encryptString(key.toString("base64")), null, 2)
    );
    return key;
  }

  function saveBackupKey(keyBuf) {
    fs.writeFileSync(
      keyPath,
      JSON.stringify(encryptString(keyBuf.toString("base64")), null, 2)
    );
  }

  function encryptBuffer(buf, key) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([cipher.update(buf), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([Buffer.from("MYLB"), iv, tag, enc]);
  }

  function decryptBuffer(buf, key) {
    if (buf.slice(0, 4).toString() !== "MYLB") {
      throw new Error("Invalid backup file format");
    }
    const iv = buf.slice(4, 16);
    const tag = buf.slice(16, 32);
    const data = buf.slice(32);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }

  async function ensureBackupFolder(drive) {
    const meta = readMeta();
    if (meta.folderId) {
      try {
        const existing = await drive.files.get({
          fileId: meta.folderId,
          fields: "id,name,webViewLink,trashed",
        });
        if (existing.data && !existing.data.trashed) {
          return {
            id: existing.data.id,
            webViewLink:
              existing.data.webViewLink ||
              `https://drive.google.com/drive/folders/${existing.data.id}`,
          };
        }
      } catch (_) {
        // Folder missing — create again below.
      }
    }

    const listed = await drive.files.list({
      q: `name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents`,
      fields: "files(id,name,webViewLink)",
      pageSize: 1,
      spaces: "drive",
    });
    let folder = (listed.data.files || [])[0] || null;
    if (!folder) {
      const created = await drive.files.create({
        requestBody: {
          name: BACKUP_FOLDER_NAME,
          mimeType: "application/vnd.google-apps.folder",
          parents: ["root"],
        },
        fields: "id,name,webViewLink",
      });
      folder = created.data;
    }

    const webViewLink =
      folder.webViewLink ||
      `https://drive.google.com/drive/folders/${folder.id}`;
    writeMeta({ folderId: folder.id, folderUrl: webViewLink });
    return { id: folder.id, webViewLink };
  }

  async function findFileInFolder(drive, folderId, name) {
    const res = await drive.files.list({
      q: `name='${name}' and '${folderId}' in parents and trashed=false`,
      fields: "files(id,name,modifiedTime,size,appProperties,webViewLink)",
      pageSize: 5,
      spaces: "drive",
    });
    return (res.data.files || [])[0] || null;
  }

  /** Legacy App Data lookups (old builds) — may fail if token lacks appdata scope. */
  async function findAppDataFile(drive, name) {
    try {
      const res = await drive.files.list({
        spaces: "appDataFolder",
        q: `name='${name}' and trashed=false`,
        fields: "files(id,name,modifiedTime,size,appProperties)",
        pageSize: 5,
      });
      return (res.data.files || [])[0] || null;
    } catch (_) {
      return null;
    }
  }

  async function upsertDriveFile(drive, folderId, name, buffer, appProperties = {}) {
    const existing = await findFileInFolder(drive, folderId, name);
    const media = {
      mimeType: "application/octet-stream",
      body: Readable.from(buffer),
    };
    if (existing) {
      await drive.files.update({
        fileId: existing.id,
        media,
        requestBody: { appProperties },
      });
      return existing.id;
    }
    const created = await drive.files.create({
      requestBody: {
        name,
        parents: [folderId],
        appProperties,
      },
      media,
      fields: "id",
    });
    return created.data.id;
  }

  async function downloadNamedBackup(drive, name) {
    const folder = await ensureBackupFolder(drive);
    let existing = await findFileInFolder(drive, folder.id, name);
    if (!existing) {
      // Fall back to older App Data backups if still present.
      existing = await findAppDataFile(drive, name);
    }
    if (!existing) return null;
    const res = await drive.files.get(
      { fileId: existing.id, alt: "media" },
      { responseType: "arraybuffer" }
    );
    return { file: existing, buffer: Buffer.from(res.data), folder };
  }

  function buildBackupJson() {
    if (!fs.existsSync(dbPath)) throw new Error("Local database not found");
    const payload = {
      version: 1,
      createdAt: new Date().toISOString(),
      dbMtime: fs.statSync(dbPath).mtime.toISOString(),
      db: fs.readFileSync(dbPath).toString("base64"),
      uploads: {},
    };
    if (uploadsPath && fs.existsSync(uploadsPath)) {
      for (const name of fs.readdirSync(uploadsPath)) {
        const full = path.join(uploadsPath, name);
        const st = fs.statSync(full);
        if (st.isFile() && st.size < 5_000_000) {
          payload.uploads[name] = fs.readFileSync(full).toString("base64");
        }
      }
    }
    return Buffer.from(JSON.stringify(payload), "utf8");
  }

  function applyBackupJson(jsonBuf) {
    const payload = JSON.parse(jsonBuf.toString("utf8"));
    if (!payload.db) throw new Error("Backup missing database");
    const tmp = dbPath + ".restore-tmp";
    fs.writeFileSync(tmp, Buffer.from(payload.db, "base64"));
    fs.renameSync(tmp, dbPath);
    if (payload.uploads && uploadsPath) {
      fs.mkdirSync(uploadsPath, { recursive: true });
      for (const [name, b64] of Object.entries(payload.uploads)) {
        fs.writeFileSync(
          path.join(uploadsPath, name),
          Buffer.from(b64, "base64")
        );
      }
    }
    return payload;
  }

  async function uploadBackup() {
    if (backingUp) return { ok: false, error: "Backup already in progress" };
    if (!isConfigured()) {
      return { ok: false, error: "Cloud backup token not configured" };
    }
    backingUp = true;
    try {
      const drive = await driveApi();
      const folder = await ensureBackupFolder(drive);
      const key = getOrCreateBackupKey();
      const encrypted = encryptBuffer(buildBackupJson(), key);
      const props = {
        createdAt: new Date().toISOString(),
        dbMtime: fs.existsSync(dbPath)
          ? fs.statSync(dbPath).mtime.toISOString()
          : "",
      };
      await upsertDriveFile(drive, folder.id, KEY_NAME, key);
      await upsertDriveFile(drive, folder.id, BACKUP_NAME, encrypted, props);
      const meta = writeMeta({
        lastBackupAt: new Date().toISOString(),
        lastBackupError: null,
        remoteModifiedTime: props.createdAt,
        folderId: folder.id,
        folderUrl: folder.webViewLink,
      });
      log(
        `Drive backup uploaded (${Math.round(encrypted.length / 1024)} KB) → ${folder.webViewLink}`
      );
      return { ok: true, meta, folderUrl: folder.webViewLink };
    } catch (err) {
      writeMeta({ lastBackupError: String(err.message || err) });
      log("Drive backup failed", err);
      return { ok: false, error: String(err.message || err) };
    } finally {
      backingUp = false;
    }
  }

  async function downloadBackup() {
    if (!isConfigured()) {
      return { ok: false, error: "Cloud backup token not configured" };
    }
    const drive = await driveApi();
    const keyFile = await downloadNamedBackup(drive, KEY_NAME);
    const backupFile = await downloadNamedBackup(drive, BACKUP_NAME);
    if (!backupFile) return { ok: false, error: "No cloud backup found" };
    if (!keyFile) {
      return { ok: false, error: "Cloud backup key missing" };
    }
    saveBackupKey(keyFile.buffer);
    const payload = applyBackupJson(
      decryptBuffer(backupFile.buffer, keyFile.buffer)
    );
    writeMeta({
      lastRestoreAt: new Date().toISOString(),
      remoteModifiedTime: backupFile.file.modifiedTime,
      folderId: backupFile.folder?.id,
      folderUrl: backupFile.folder?.webViewLink,
    });
    return { ok: true, payload, remote: backupFile.file };
  }

  function localIsEmpty() {
    try {
      if (!fs.existsSync(dbPath)) return true;
      return fs.statSync(dbPath).size < 20_000;
    } catch {
      return true;
    }
  }

  async function getStatus() {
    const configured = isConfigured();
    const meta = readMeta();
    let remote = null;
    let error = null;
    let email = null;
    let folderUrl = meta.folderUrl || null;
    if (configured) {
      try {
        email = await resolveEmail();
        const drive = await driveApi();
        const folder = await ensureBackupFolder(drive);
        folderUrl = folder.webViewLink;
        remote = await findFileInFolder(drive, folder.id, BACKUP_NAME);
        if (!remote) remote = await findAppDataFile(drive, BACKUP_NAME);
      } catch (err) {
        error = String(err.message || err);
      }
    }
    return {
      mode: "single-account",
      configured,
      connected: configured && !error,
      email,
      error,
      meta,
      folderUrl,
      folderName: BACKUP_FOLDER_NAME,
      remote: remote
        ? {
            id: remote.id,
            modifiedTime: remote.modifiedTime,
            size: remote.size,
            appProperties: remote.appProperties || {},
            webViewLink: remote.webViewLink || null,
          }
        : null,
      localDbExists: fs.existsSync(dbPath),
      localIsEmpty: localIsEmpty(),
      schedule: "Every 5 minutes while online (MyLab open)",
    };
  }

  function startSchedule(onRan) {
    stopSchedule();
    if (!isConfigured()) {
      log("Drive backup schedule skipped (token not configured)");
      return;
    }

    const tick = async () => {
      if (!(await isOnline())) {
        log("Scheduled Drive backup skipped (offline)");
        return;
      }
      log("Scheduled Drive backup starting…");
      const result = await uploadBackup();
      if (onRan) onRan(result);
    };

    // First attempt shortly after launch, then every 5 minutes.
    scheduledFirstTimer = setTimeout(() => {
      tick();
      scheduledInterval = setInterval(tick, BACKUP_INTERVAL_MS);
    }, BACKUP_FIRST_DELAY_MS);

    log(
      `Drive backup schedule armed (every ${BACKUP_INTERVAL_MS / 60000} min when online; first in ${BACKUP_FIRST_DELAY_MS / 1000}s)`
    );
  }

  function stopSchedule() {
    if (scheduledFirstTimer) {
      clearTimeout(scheduledFirstTimer);
      scheduledFirstTimer = null;
    }
    if (scheduledInterval) {
      clearInterval(scheduledInterval);
      scheduledInterval = null;
    }
  }

  return {
    getStatus,
    uploadBackup,
    downloadBackup,
    localIsEmpty,
    startSchedule,
    stopSchedule,
    isConfigured,
  };
}

module.exports = { createDriveBackup, loadDriveConfig };
