#!/usr/bin/env node
/**
 * After Next standalone + Express builds, stage files for electron-builder.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function mustExist(p, label) {
  if (!fs.existsSync(p)) {
    console.error(`Missing ${label}: ${p}`);
    process.exit(1);
  }
}

const standalone = path.join(root, ".next", "standalone");
const staticDir = path.join(root, ".next", "static");
const publicDir = path.join(root, "public");
const apiDist = path.join(root, "express-api", "dist");

mustExist(standalone, "Next standalone build");
mustExist(staticDir, "Next static assets");
mustExist(apiDist, "Express API build");

// Next standalone expects .next/static and public beside server.js
copyDir(staticDir, path.join(standalone, ".next", "static"));
if (fs.existsSync(publicDir)) {
  copyDir(publicDir, path.join(standalone, "public"));
}

const stage = path.join(root, "desktop-dist");
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });

copyDir(standalone, path.join(stage, "app-server"));
copyDir(apiDist, path.join(stage, "api"));

// Copy express-api runtime deps (sqlite3, express, sequelize, ...)
const apiModules = path.join(root, "express-api", "node_modules");
mustExist(apiModules, "express-api node_modules");
copyDir(apiModules, path.join(stage, "api", "node_modules"));

// Package.json helps some modules resolve correctly
fs.copyFileSync(
  path.join(root, "express-api", "package.json"),
  path.join(stage, "api", "package.json")
);

console.log("Desktop stage ready at desktop-dist/");
