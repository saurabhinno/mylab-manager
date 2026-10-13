#!/usr/bin/env node
/**
 * One-time helper: sign in with YOUR Gmail and print a refresh token.
 * Put that token in GitHub secrets / env as GOOGLE_DRIVE_REFRESH_TOKEN.
 *
 * Prerequisites:
 * 1. Google Cloud project → enable Drive API
 * 2. OAuth client type "Desktop app"
 * 3. Redirect URI: http://127.0.0.1:17823/oauth2callback
 *
 * Usage:
 *   GOOGLE_DRIVE_CLIENT_ID=xxx.apps.googleusercontent.com \
 *   GOOGLE_DRIVE_CLIENT_SECRET=yyy \
 *   node scripts/google-drive-get-token.js
 */
const http = require("http");
const { URL } = require("url");
const { google } = require("googleapis");

const PORT = 17823;
const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || "";

if (!clientId) {
  console.error("Set GOOGLE_DRIVE_CLIENT_ID first.");
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(
  clientId,
  clientSecret || undefined,
  `http://127.0.0.1:${PORT}/oauth2callback`
);

const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: [
    "https://www.googleapis.com/auth/drive.appdata",
    "https://www.googleapis.com/auth/userinfo.email",
  ],
});

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (u.pathname !== "/oauth2callback") {
      res.writeHead(404);
      res.end();
      return;
    }
    const code = u.searchParams.get("code");
    const { tokens } = await oauth2.getToken(code);
    res.end("OK — copy the refresh token from the terminal, then close this tab.");

    console.log("\n===== SAVE THESE =====\n");
    console.log("GOOGLE_DRIVE_CLIENT_ID=" + clientId);
    if (clientSecret) console.log("GOOGLE_DRIVE_CLIENT_SECRET=" + clientSecret);
    console.log("GOOGLE_DRIVE_REFRESH_TOKEN=" + tokens.refresh_token);
    console.log("\nAdd them as GitHub environment variables/secrets, then rebuild.\n");
    if (!tokens.refresh_token) {
      console.log(
        "WARNING: No refresh_token returned. Revoke app access at https://myaccount.google.com/permissions and try again with prompt=consent."
      );
    }
    server.close();
    process.exit(0);
  } catch (err) {
    console.error(err);
    res.end("Failed — see terminal.");
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("Open this URL in your browser and sign in with your Gmail:\n");
  console.log(authUrl + "\n");
});
