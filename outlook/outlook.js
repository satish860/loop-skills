#!/usr/bin/env node

/**
 * Outlook/Microsoft 365 email CLI via Microsoft Graph API
 * Supports multiple accounts.
 *
 * Usage:
 *   node outlook.js accounts list                           # List configured accounts
 *   node outlook.js accounts add <email>                    # Add account (interactive)
 *   node outlook.js accounts remove <email>                 # Remove account
 *   node outlook.js accounts credentials <file.json>        # Set Azure AD app credentials
 *   node outlook.js <email> list [--folder inbox] [--top 10]
 *   node outlook.js <email> search "query" [--top 10]
 *   node outlook.js <email> read <messageId>
 *   node outlook.js <email> send --to "a@x.com" --subject "Hi" --body "Hello"
 *   node outlook.js <email> reply <messageId> --body "Thanks"
 *   node outlook.js <email> folders
 */

import { PublicClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const CONFIG_DIR = join(homedir(), ".outlook-cli");
const CREDENTIALS_FILE = join(CONFIG_DIR, "credentials.json");
const ACCOUNTS_FILE = join(CONFIG_DIR, "accounts.json");

const SCOPES = [
  "https://graph.microsoft.com/Mail.Read",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/Mail.ReadWrite",
  "https://graph.microsoft.com/User.Read",
];

// ── Storage ─────────────────────────────────────────────

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
}

function loadCredentials() {
  if (!existsSync(CREDENTIALS_FILE)) return null;
  return JSON.parse(readFileSync(CREDENTIALS_FILE, "utf-8"));
}

function saveCredentials(creds) {
  ensureConfigDir();
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2));
}

function loadAccounts() {
  if (!existsSync(ACCOUNTS_FILE)) return {};
  return JSON.parse(readFileSync(ACCOUNTS_FILE, "utf-8"));
}

function saveAccounts(accounts) {
  ensureConfigDir();
  writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}

function getAccountToken(email) {
  const accounts = loadAccounts();
  const account = accounts[email];
  if (!account) return null;
  if (account.expiresAt && Date.now() > account.expiresAt) return null;
  return account.accessToken;
}

function setAccountToken(email, token) {
  const accounts = loadAccounts();
  accounts[email] = {
    accessToken: token.accessToken,
    expiresAt: Date.now() + (token.expiresIn || 3600) * 1000,
    addedAt: accounts[email]?.addedAt || new Date().toISOString(),
  };
  saveAccounts(accounts);
}

function removeAccount(email) {
  const accounts = loadAccounts();
  delete accounts[email];
  saveAccounts(accounts);
}

// ── Helpers ─────────────────────────────────────────────

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

async function authenticate(email) {
  const creds = loadCredentials();
  if (!creds) {
    console.error("Error: No credentials configured.\nRun: node outlook.js accounts credentials <file.json>");
    console.error("\nOr set up manually:");
    console.error("1. Go to https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps");
    console.error('2. New registration → Name: "outlook-cli" → Personal + org accounts');
    console.error("3. Platform: Mobile/Desktop → Redirect URI: http://localhost");
    console.error("4. API permissions → Add: Mail.Read, Mail.Send, Mail.ReadWrite, User.Read");
    console.error("5. Create a JSON file with: { \"clientId\": \"your-app-id\", \"tenantId\": \"common\" }");
    process.exit(1);
  }

  const pca = new PublicClientApplication({
    auth: {
      clientId: creds.clientId,
      authority: `https://login.microsoftonline.com/${creds.tenantId || "common"}`,
    },
  });

  console.log(`Authenticating ${email}...`);
  const result = await pca.acquireTokenByDeviceCode({
    scopes: SCOPES,
    deviceCodeCallback: (response) => {
      console.log("\n" + response.message);
      console.log("\nWaiting for authentication...");
    },
  });

  setAccountToken(email, result);
  return result.accessToken;
}

async function getAccessToken(email) {
  const token = getAccountToken(email);
  if (token) return token;
  return await authenticate(email);
}

// ── Account Commands ────────────────────────────────────

function accountsList() {
  const accounts = loadAccounts();
  const emails = Object.keys(accounts);
  if (emails.length === 0) {
    console.log("No accounts configured.");
    console.log("Run: node outlook.js accounts add <email>");
    return;
  }
  for (const email of emails) {
    const acc = accounts[email];
    const expired = acc.expiresAt && Date.now() > acc.expiresAt;
    const status = expired ? "⚠️  token expired" : "✅ active";
    console.log(`${status}  ${email}`);
  }
}

async function accountsAdd(email) {
  if (!email) {
    console.error("Usage: node outlook.js accounts add <email>");
    process.exit(1);
  }
  await authenticate(email);
  console.log(`✅ Account ${email} added.`);
}

function accountsRemove(email) {
  if (!email) {
    console.error("Usage: node outlook.js accounts remove <email>");
    process.exit(1);
  }
  removeAccount(email);
  console.log(`Removed ${email}.`);
}

function accountsCredentials(file) {
  if (!file) {
    console.error("Usage: node outlook.js accounts credentials <file.json>");
    console.error("\nJSON format: { \"clientId\": \"your-app-id\", \"tenantId\": \"common\" }");
    process.exit(1);
  }
  if (!existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }
  const creds = JSON.parse(readFileSync(file, "utf-8"));
  if (!creds.clientId) {
    console.error("Error: JSON must contain 'clientId' field.");
    process.exit(1);
  }
  saveCredentials({ clientId: creds.clientId, tenantId: creds.tenantId || "common" });
  console.log(`✅ Credentials saved to ${CREDENTIALS_FILE}`);
}

// ── Email Commands ──────────────────────────────────────

async function listEmails(email, opts) {
  const client = getClient(await getAccessToken(email));
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

async function searchEmails(email, query, opts) {
  const client = getClient(await getAccessToken(email));
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

async function readEmail(email, messageId) {
  const client = getClient(await getAccessToken(email));

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

async function sendEmail(email, opts) {
  if (!opts.to || !opts.subject || !opts.body) {
    console.error("Required: --to, --subject, --body");
    process.exit(1);
  }

  const client = getClient(await getAccessToken(email));

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

async function replyEmail(email, messageId, opts) {
  if (!opts.body) {
    console.error("Required: --body");
    process.exit(1);
  }

  const client = getClient(await getAccessToken(email));
  await client.api(`/me/messages/${messageId}/reply`).post({
    comment: opts.body,
  });
  console.log(`✅ Reply sent`);
}

async function listFolders(email) {
  const client = getClient(await getAccessToken(email));
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
const cmd1 = args._[0];
const cmd2 = args._[1];

if (!cmd1 || cmd1 === "--help" || cmd1 === "-h") {
  console.log(`Outlook/Microsoft 365 Email CLI

Account Management:
  node outlook.js accounts list                        List configured accounts
  node outlook.js accounts add <email>                 Add account (device code auth)
  node outlook.js accounts remove <email>              Remove account
  node outlook.js accounts credentials <file.json>     Set Azure AD app credentials

Email Commands (per account):
  node outlook.js <email> list [--folder inbox] [--top 10]
  node outlook.js <email> search "query" [--top 10]
  node outlook.js <email> read <messageId>
  node outlook.js <email> send --to "a@x.com" --subject "Hi" --body "Hello"
  node outlook.js <email> reply <messageId> --body "Thanks"
  node outlook.js <email> folders

Examples:
  node outlook.js accounts credentials ./creds.json
  node outlook.js accounts add satish@deltaxy.ai
  node outlook.js accounts add john@company.com
  node outlook.js satish@deltaxy.ai list --top 5
  node outlook.js john@company.com search "from:boss"
  node outlook.js satish@deltaxy.ai send --to "a@x.com" --subject "Hi" --body "Hello"

Data Storage:
  ~/.outlook-cli/credentials.json   Azure AD app credentials (shared across accounts)
  ~/.outlook-cli/accounts.json      Per-account tokens`);
  process.exit(0);
}

try {
  // Account management commands
  if (cmd1 === "accounts") {
    switch (cmd2) {
      case "list":    accountsList(); break;
      case "add":     await accountsAdd(args._[2]); break;
      case "remove":  accountsRemove(args._[2]); break;
      case "credentials": accountsCredentials(args._[2]); break;
      default:
        console.error(`Unknown accounts command: ${cmd2}\nRun: node outlook.js --help`);
        process.exit(1);
    }
  }
  // Email commands — first arg is email address
  else if (cmd1.includes("@")) {
    const email = cmd1;
    const command = cmd2;

    switch (command) {
      case "list":    await listEmails(email, args); break;
      case "search":
        if (!args._[2]) { console.error('Usage: node outlook.js <email> search "query"'); process.exit(1); }
        await searchEmails(email, args._[2], args);
        break;
      case "read":
        if (!args._[2]) { console.error("Usage: node outlook.js <email> read <messageId>"); process.exit(1); }
        await readEmail(email, args._[2]);
        break;
      case "send":    await sendEmail(email, args); break;
      case "reply":
        if (!args._[2]) { console.error("Usage: node outlook.js <email> reply <messageId> --body \"text\""); process.exit(1); }
        await replyEmail(email, args._[2], args);
        break;
      case "folders":  await listFolders(email); break;
      default:
        console.error(`Unknown command: ${command}\nRun: node outlook.js --help`);
        process.exit(1);
    }
  } else {
    console.error(`Unknown command: ${cmd1}\nRun: node outlook.js --help`);
    process.exit(1);
  }
} catch (err) {
  if (err.statusCode === 401) {
    console.error(`Authentication expired for ${cmd1}.\nRun: node outlook.js accounts add ${cmd1}`);
  } else {
    console.error(`Error: ${err.message}`);
  }
  process.exit(1);
}
