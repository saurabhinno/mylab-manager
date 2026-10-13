#!/usr/bin/env node
/**
 * Writes electron/update-config.json used by the packaged auto-updater.
 * In CI, pass secrets as env vars so private GitHub Releases can be read.
 */
const fs = require("fs");
const path = require("path");

const out = path.join(__dirname, "..", "electron", "update-config.json");
const config = {
  owner: "saurabhinno",
  repo: "mylab-manager",
  private: true,
  // Optional: public HTTPS folder hosting latest.yml + installers
  feedUrl: process.env.MYLAB_UPDATE_FEED_URL || null,
  // Optional: fine-grained GitHub PAT with Contents: Read on this repo only
  token: process.env.MYLAB_GH_UPDATE_TOKEN || null,
};

fs.writeFileSync(out, JSON.stringify(config, null, 2) + "\n");
console.log(
  `Wrote ${out} (feedUrl=${config.feedUrl ? "yes" : "no"}, token=${
    config.token ? "yes" : "no"
  })`
);
