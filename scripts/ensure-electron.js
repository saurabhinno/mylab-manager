#!/usr/bin/env node
/**
 * Ensure the Electron binary is present. On some Node versions extract-zip
 * only unpacks LICENSES; fall back to system unzip from the electron cache.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync, spawnSync } = require("child_process");

const electronDir = path.join(__dirname, "..", "node_modules", "electron");
const pkgPath = path.join(electronDir, "package.json");

if (!fs.existsSync(pkgPath)) {
  console.log("electron not installed yet; skip ensure-electron");
  process.exit(0);
}

const { version } = require(pkgPath);
const distDir = path.join(electronDir, "dist");
const binaryRel =
  process.platform === "darwin"
    ? "Electron.app/Contents/MacOS/Electron"
    : process.platform === "win32"
      ? "electron.exe"
      : "electron";
const binaryPath = path.join(distDir, binaryRel);

if (fs.existsSync(binaryPath)) {
  fs.writeFileSync(path.join(electronDir, "path.txt"), binaryRel);
  process.exit(0);
}

console.log("Electron binary missing; running electron/install.js ...");
const install = spawnSync(process.execPath, ["install.js"], {
  cwd: electronDir,
  stdio: "inherit",
  env: process.env,
});

if (fs.existsSync(binaryPath)) {
  fs.writeFileSync(path.join(electronDir, "path.txt"), binaryRel);
  process.exit(0);
}

// Fallback: unzip from cache
const cacheRoot =
  process.env.electron_config_cache ||
  path.join(os.homedir(), "Library", "Caches", "electron");
const zipName = `electron-v${version}-${process.platform}-${process.arch}.zip`;

function findZip(dir) {
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findZip(full);
      if (found) return found;
    } else if (entry.name === zipName) {
      return full;
    }
  }
  return null;
}

const zipPath = findZip(cacheRoot);
if (!zipPath) {
  console.error(
    `Could not find ${zipName} under ${cacheRoot}. Re-run: npm install electron`
  );
  process.exit(install.status || 1);
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });
console.log(`Extracting ${zipPath} with system unzip...`);
execSync(`unzip -q "${zipPath}" -d "${distDir}"`, { stdio: "inherit" });
fs.writeFileSync(path.join(electronDir, "path.txt"), binaryRel);

if (!fs.existsSync(binaryPath)) {
  console.error("Electron extract fallback failed");
  process.exit(1);
}

console.log("Electron binary ready:", binaryPath);
