#!/usr/bin/env node
/**
 * One-time helper to mint a Gmail refresh token for the auto-attach
 * adapter. Run this locally (NOT on the server):
 *
 *   GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... node scripts/gmail-oauth-bootstrap.js
 *
 * 1. It prints a URL. Open it, sign in as the Gmail account to watch
 *    (ronnie@sandiegoconcrete.ai), click through the consent screen.
 * 2. Google redirects to http://localhost:4873/cb?code=... — copy the
 *    `code` query param back into the terminal when prompted.
 * 3. Script exchanges the code for a refresh_token and prints it.
 * 4. Paste the refresh_token into .env.local as GMAIL_REFRESH_TOKEN.
 *
 * Redirect URI is http://localhost:4873/cb (change the port if that's
 * taken; must match the one you configured in Google Cloud Console).
 * The redirect handler is served by a tiny http server in this script.
 */
const http = require("http");
const { URL } = require("url");
const readline = require("readline");

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.GMAIL_OAUTH_REDIRECT_URI ?? "http://localhost:4873/cb";
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET env vars before running.",
  );
  process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPE);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

console.log("\n1. Open this URL in your browser:\n");
console.log("   " + authUrl.toString());
console.log(
  "\n2. After approving, Google will redirect you to http://localhost:4873/cb",
);
console.log("   — this script will capture the code automatically.\n");

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost:4873");
  if (u.pathname !== "/cb") {
    res.statusCode = 404;
    return res.end("Not the callback path");
  }
  const code = u.searchParams.get("code");
  if (!code) {
    res.statusCode = 400;
    return res.end("Missing code");
  }
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }).toString(),
    });
    const j = await tokenRes.json();
    if (!tokenRes.ok || !j.refresh_token) {
      res.statusCode = 500;
      res.end("Token exchange failed — check console");
      console.error("Exchange failed:", j);
      server.close();
      return;
    }
    res.end(
      "Got it — refresh token printed in the terminal. You can close this tab.",
    );
    console.log("\n✓ Refresh token:\n");
    console.log("GMAIL_REFRESH_TOKEN=" + j.refresh_token + "\n");
    console.log("Paste that line into .env.local.\n");
    server.close();
  } catch (err) {
    res.statusCode = 500;
    res.end(String(err));
    console.error(err);
    server.close();
  }
});

server.listen(4873, () => {
  console.log(
    "Callback server listening on http://localhost:4873/cb — ready when you are.",
  );
});

// Also read a pasted code as a fallback if the user is SSH'd and can't
// open a browser on the same host.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question(
  "(Optional) If your browser can't reach localhost, paste the ?code= value here and press Enter:\n> ",
  async (code) => {
    rl.close();
    if (!code?.trim()) return;
    try {
      const r = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: code.trim(),
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }).toString(),
      });
      const j = await r.json();
      if (j.refresh_token) {
        console.log("\n✓ Refresh token:\nGMAIL_REFRESH_TOKEN=" + j.refresh_token + "\n");
      } else {
        console.error("Exchange failed:", j);
      }
      server.close();
    } catch (err) {
      console.error(err);
      server.close();
    }
  },
);
