#!/usr/bin/env node

/**
 * Outlook/Microsoft 365 email CLI via Microsoft Graph API
 *
 * Usage:
 *   node outlook.js auth                                    # Interactive login
 *   node outlook.js search "subject:invoice"                # Search emails
 *   node outlook.js read <messageId>                        # Read email
 *   node outlook.js send --to "a@x.com" --subject "Hi" --body "Hello"
 *   node outlook.js reply <messageId> --body "Thanks"
 *   node outlook.js folders                                 # List folders
 *   node outlook.js list [--folder inbox] [--top 10]        # List recent emails
 */

import { ConfidentialClientApplication, PublicClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { createServer } from "http";

const CONFIG_DIR = join(homedir(), ".outlook-cli");
const TOKEN_FILE = join(CONFIG_DIR, "token.json");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

const SCOPES = [
  "https://graph.microsoft.com/Mail.Read",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/Mail.ReadWrite",
  "https://graph.microsoft.com/User.Read",
];

// ── Helpers ──────────────────────────────────────────────

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
}

function loadConfig() {
  if (!existsSync(CONFIG_FILE)) return null;
  return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
}

function saveConfig(config) {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function loadToken() {
  if (!existsSync(TOKEN_FILE)) return null;
  const data = JSON.parse(readFileSync(TOKEN_FILE, "utf-8"));
  if (data.expiresAt && Date.now() > data.expiresAt) return null;
  return data;
}

function saveToken(token) {
  ensureConfigDir();
  const data = {
    accessToken: token.accessToken,
    expiresAt: Date.now() + (token.expiresIn || 3600) * 1000,
  };
  writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
  return data;
}

function getClient(accessToken) {
  return Client.init({
    authProvider: (done) => done(null, accessToken),
  });
}

function parseArgs(args) {
  const result = { _: [] };
  let i = 0;
  while (i < args.length) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        result[key] = args[i + 1];
        i += 2;
      } else {
        result[key] = true;
        i += 1;
      }
    } else {
      result._.push(args[i]);
      i += 1;
    }
  }
  return result;
}

// ── Auth ────────────────────────────────────────────────

async function authenticate(config) {
  const pca = new PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: config.authority || `https://login.microsoftonline.com/${config.tenantId || "common"}`,
    },
  });

  // Device code flow — works in terminals without browser redirect
  const result = await pca.acquireTokenByDeviceCode({
    scopes: SCOPES,
    deviceCodeCallback: (response) => {
      console.log("\n" + response.message);
      console.log("\nWaiting for authentication...");
    },
  });

  return saveToken(result);
}

async function getAccessToken() {
  const token = loadToken();
  if (token) return token.accessToken;

  const config = loadConfig();
  if (!config) {
    console.error("Error: Not configured.\nRun: node outlook.js setup");
    process.exit(1);
  }

  const newToken = await authenticate(config);
  return newToken.accessToken;
}

// ── Commands ────────────────────────────────────────────

async function setup() {
  console.log("Outlook CLI Setup\n");
  console.log("You need an Azure AD app registration:");
  console.log("1. Go to https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps");
  console.log("2. New registration → Name: 'outlook-cli' → Personal accounts + org");
  console.log("3. Platform: Mobile/Desktop → Redirect URI: http://localhost");
  console.log("4. API permissions → Add: Mail.Read, Mail.Send, Mail.ReadWrite, User.Read");
  console.log("5. Copy the Application (client) ID\n");

  // Read from stdin
  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((r) => rl.question(q, r));

  const clientId = await ask("Application (client) ID: ");
  const tenantId = await ask("Tenant ID (or 'common' for any account): ");

  saveConfig({
    clientId: clientId.trim(),
    tenantId: tenantId.trim() || "common",
  });

  rl.close();
  console.log(`\nConfig saved to ${CONFIG_FILE}`);
  console.log("Run: node outlook.js auth");
}

async function auth() {
  const config = loadConfig();
  if (!config) {
    console.error("Not configured. Run: node outlook.js setup");
    process.exit(1);
  }
  await authenticate(config);
  console.log("✅ Authenticated successfully.");
}

async function listEmails(opts) {
  const client = getClient(await getAccessToken());
  const folder = opts.folder || "inbox";
  const top = parseInt(opts.top) || 10;

  const result = await client
    .api(`/me/mailFolders/${folder}/messages`)
    .top(top)
    .select("id,subject,from,receivedDateTime,isRead,hasAttachments")
    .orderby("receivedDateTime desc")
    .get();

  if (!result.value.length) {
    console.log("No emails found.");
    return;
  }

  for (const msg of result.value) {
    const read = msg.isRead ? "  " : "🔵";
    const attach = msg.hasAttachments ? "📎" : "  ";
    const from = msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || "Unknown";
    const date = new Date(msg.receivedDateTime).toLocaleDateString();
    console.log(`${read} ${attach} ${date}  ${from}`);
    console.log(`      ${msg.subject}`);
    console.log(`      ID: ${msg.id}`);
    console.log();
  }
}

async function searchEmails(query, opts) {
  const client = getClient(await getAccessToken());
  const top = parseInt(opts.top) || 10;

  const result = await client
    .api("/me/messages")
    .search(query)
    .top(top)
    .select("id,subject,from,receivedDateTime,isRead,hasAttachments,bodyPreview")
    .get();

  if (!result.value.length) {
    console.log(`No results for: ${query}`);
    return;
  }

  for (const msg of result.value) {
    const from = msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || "Unknown";
    const date = new Date(msg.receivedDateTime).toLocaleDateString();
    console.log(`📧 ${date}  ${from}`);
    console.log(`   ${msg.subject}`);
    console.log(`   ${msg.bodyPreview?.slice(0, 100)}...`);
    console.log(`   ID: ${msg.id}`);
    console.log();
  }
}

async function readEmail(messageId) {
  const client = getClient(await getAccessToken());

  const msg = await client
    .api(`/me/messages/${messageId}`)
    .select("id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,hasAttachments")
    .get();

  const from = msg.from?.emailAddress?.address || "Unknown";
  const to = msg.toRecipients?.map((r) => r.emailAddress.address).join(", ") || "";
  const cc = msg.ccRecipients?.map((r) => r.emailAddress.address).join(", ") || "";
  const date = new Date(msg.receivedDateTime).toLocaleString();

  console.log(`From: ${from}`);
  console.log(`To: ${to}`);
  if (cc) console.log(`CC: ${cc}`);
  console.log(`Date: ${date}`);
  console.log(`Subject: ${msg.subject}`);
  console.log(`---`);
  // Strip HTML tags for plain text output
  const body = msg.body?.content?.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() || "";
  console.log(body);

  if (msg.hasAttachments) {
    const attachments = await client.api(`/me/messages/${messageId}/attachments`).get();
    console.log(`\n--- Attachments ---`);
    for (const att of attachments.value) {
      console.log(`📎 ${att.name} (${att.contentType}, ${att.size} bytes)`);
    }
  }
}

async function sendEmail(opts) {
  if (!opts.to || !opts.subject || !opts.body) {
    console.error("Required: --to, --subject, --body");
    process.exit(1);
  }

  const client = getClient(await getAccessToken());

  const message = {
    subject: opts.subject,
    body: { contentType: "Text", content: opts.body },
    toRecipients: opts.to.split(",").map((e) => ({ emailAddress: { address: e.trim() } })),
  };

  if (opts.cc) {
    message.ccRecipients = opts.cc.split(",").map((e) => ({ emailAddress: { address: e.trim() } }));
  }

  await client.api("/me/sendMail").post({ message });
  console.log(`✅ Sent to ${opts.to}`);
}

async function replyEmail(messageId, opts) {
  if (!opts.body) {
    console.error("Required: --body");
    process.exit(1);
  }

  const client = getClient(await getAccessToken());
  await client.api(`/me/messages/${messageId}/reply`).post({
    comment: opts.body,
  });
  console.log(`✅ Reply sent`);
}

async function listFolders() {
  const client = getClient(await getAccessToken());
  const result = await client
    .api("/me/mailFolders")
    .top(50)
    .select("id,displayName,totalItemCount,unreadItemCount")
    .get();

  for (const folder of result.value) {
    const unread = folder.unreadItemCount > 0 ? ` (${folder.unreadItemCount} unread)` : "";
    console.log(`📁 ${folder.displayName} — ${folder.totalItemCount} items${unread}`);
    console.log(`   ID: ${folder.id}`);
  }
}

// ── Main ────────────────────────────────────────────────

const args = parseArgs(process.argv.slice(2));
const command = args._[0];

if (!command || command === "--help" || command === "-h") {
  console.log(`Outlook/Microsoft 365 Email CLI

Usage:
  node outlook.js setup                                    Set up Azure AD credentials
  node outlook.js auth                                     Authenticate (device code flow)
  node outlook.js list [--folder inbox] [--top 10]         List recent emails
  node outlook.js search "query"                           Search emails
  node outlook.js read <messageId>                         Read full email
  node outlook.js send --to "a@x.com" --subject "Hi" --body "Hello"
  node outlook.js reply <messageId> --body "Thanks"        Reply to email
  node outlook.js folders                                  List mail folders

Requires Azure AD app registration. Run 'node outlook.js setup' first.`);
  process.exit(0);
}

try {
  switch (command) {
    case "setup":
      await setup();
      break;
    case "auth":
      await auth();
      break;
    case "list":
      await listEmails(args);
      break;
    case "search":
      if (!args._[1]) {
        console.error("Usage: node outlook.js search \"query\"");
        process.exit(1);
      }
      await searchEmails(args._[1], args);
      break;
    case "read":
      if (!args._[1]) {
        console.error("Usage: node outlook.js read <messageId>");
        process.exit(1);
      }
      await readEmail(args._[1]);
      break;
    case "send":
      await sendEmail(args);
      break;
    case "reply":
      if (!args._[1]) {
        console.error("Usage: node outlook.js reply <messageId> --body \"text\"");
        process.exit(1);
      }
      await replyEmail(args._[1], args);
      break;
    case "folders":
      await listFolders();
      break;
    default:
      console.error(`Unknown command: ${command}\nRun: node outlook.js --help`);
      process.exit(1);
  }
} catch (err) {
  if (err.statusCode === 401) {
    console.error("Authentication expired. Run: node outlook.js auth");
  } else {
    console.error(`Error: ${err.message}`);
  }
  process.exit(1);
}
