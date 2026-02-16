#!/usr/bin/env node

/**
 * SharePoint CLI via Microsoft Graph API
 * Shares auth config with outlook skill (~/.outlook-cli/)
 *
 * Usage:
 *   node sharepoint.js sites                                # List sites
 *   node sharepoint.js search "query"                       # Search across sites
 *   node sharepoint.js lists <siteId>                       # List document libraries
 *   node sharepoint.js files <siteId> [driveId] [--path /folder]
 *   node sharepoint.js read <siteId> <driveId> <itemId>     # Get file metadata
 *   node sharepoint.js download <siteId> <driveId> <itemId> [--output file]
 *   node sharepoint.js upload <siteId> <driveId> <localFile> [--path /folder]
 */

import { PublicClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import { readFileSync, writeFileSync, existsSync, mkdirSync, createWriteStream } from "fs";
import { homedir } from "os";
import { join, basename } from "path";
import https from "https";

// Share auth with outlook skill
const CONFIG_DIR = join(homedir(), ".outlook-cli");
const CREDENTIALS_FILE = join(CONFIG_DIR, "credentials.json");
const TOKEN_FILE = join(CONFIG_DIR, "sharepoint-token.json");

const SCOPES = [
  "https://graph.microsoft.com/Sites.Read.All",
  "https://graph.microsoft.com/Sites.ReadWrite.All",
  "https://graph.microsoft.com/Files.ReadWrite.All",
  "https://graph.microsoft.com/User.Read",
];

function loadCredentials() {
  if (!existsSync(CREDENTIALS_FILE)) return null;
  return JSON.parse(readFileSync(CREDENTIALS_FILE, "utf-8"));
}

function loadToken() {
  if (!existsSync(TOKEN_FILE)) return null;
  const data = JSON.parse(readFileSync(TOKEN_FILE, "utf-8"));
  if (data.expiresAt && Date.now() > data.expiresAt) return null;
  return data;
}

function saveToken(token) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  const data = { accessToken: token.accessToken, expiresAt: Date.now() + (token.expiresIn || 3600) * 1000 };
  writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
  return data;
}

async function authenticate() {
  const creds = loadCredentials();
  if (!creds) {
    console.error("Error: No Azure AD credentials.\nSet up via outlook skill first: node outlook.js accounts credentials <file.json>\nOr create ~/.outlook-cli/credentials.json with { \"clientId\": \"...\", \"tenantId\": \"common\" }\nThe Azure AD app needs Sites.Read.All, Sites.ReadWrite.All, Files.ReadWrite.All permissions.");
    process.exit(1);
  }
  const pca = new PublicClientApplication({
    auth: { clientId: creds.clientId, authority: `https://login.microsoftonline.com/${creds.tenantId || "common"}` },
  });
  const result = await pca.acquireTokenByDeviceCode({
    scopes: SCOPES,
    deviceCodeCallback: (r) => { console.log("\n" + r.message + "\nWaiting..."); },
  });
  return saveToken(result);
}

async function getAccessToken() {
  const token = loadToken();
  if (token) return token.accessToken;
  const newToken = await authenticate();
  return newToken.accessToken;
}

function getClient(accessToken) {
  return Client.init({ authProvider: (done) => done(null, accessToken) });
}

function parseArgs(args) {
  const result = { _: [] };
  let i = 0;
  while (i < args.length) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith("--")) { result[key] = args[i + 1]; i += 2; }
      else { result[key] = true; i += 1; }
    } else { result._.push(args[i]); i += 1; }
  }
  return result;
}

async function listSites() {
  const client = getClient(await getAccessToken());
  const result = await client.api("/sites?search=*").top(50).get();
  for (const site of result.value) {
    console.log(`🌐 ${site.displayName}`);
    console.log(`   URL: ${site.webUrl}`);
    console.log(`   ID: ${site.id}`);
    console.log();
  }
}

async function searchSites(query) {
  const client = getClient(await getAccessToken());
  const result = await client.api(`/sites?search=${encodeURIComponent(query)}`).get();
  for (const site of result.value) {
    console.log(`🌐 ${site.displayName} — ${site.webUrl}`);
    console.log(`   ID: ${site.id}`);
  }
}

async function listDrives(siteId) {
  const client = getClient(await getAccessToken());
  const result = await client.api(`/sites/${siteId}/drives`).get();
  for (const drive of result.value) {
    const used = drive.quota?.used ? `${(drive.quota.used / 1e6).toFixed(1)}MB` : "n/a";
    console.log(`📁 ${drive.name} (${drive.driveType}) — ${used} used`);
    console.log(`   ID: ${drive.id}`);
  }
}

async function listFiles(siteId, opts) {
  const client = getClient(await getAccessToken());
  const driveId = opts._[2];
  const folderPath = opts.path || "";

  let endpoint;
  if (driveId && folderPath) {
    endpoint = `/sites/${siteId}/drives/${driveId}/root:${folderPath}:/children`;
  } else if (driveId) {
    endpoint = `/sites/${siteId}/drives/${driveId}/root/children`;
  } else {
    // Use default drive
    endpoint = `/sites/${siteId}/drive/root/children`;
  }

  const result = await client.api(endpoint).top(50).get();
  for (const item of result.value) {
    const type = item.folder ? "📁" : "📄";
    const size = item.size ? `${(item.size / 1024).toFixed(0)}KB` : "";
    const modified = new Date(item.lastModifiedDateTime).toLocaleDateString();
    console.log(`${type} ${item.name}  ${size}  ${modified}`);
    console.log(`   ID: ${item.id}  DriveID: ${item.parentReference?.driveId || "n/a"}`);
  }
}

async function readFile(siteId, driveId, itemId) {
  const client = getClient(await getAccessToken());
  const item = await client.api(`/sites/${siteId}/drives/${driveId}/items/${itemId}`).get();
  console.log(`Name: ${item.name}`);
  console.log(`Size: ${(item.size / 1024).toFixed(0)}KB`);
  console.log(`Modified: ${item.lastModifiedDateTime}`);
  console.log(`Modified by: ${item.lastModifiedBy?.user?.displayName || "unknown"}`);
  console.log(`Web URL: ${item.webUrl}`);
  if (item["@microsoft.graph.downloadUrl"]) {
    console.log(`Download URL: ${item["@microsoft.graph.downloadUrl"]}`);
  }
}

async function downloadFile(siteId, driveId, itemId, opts) {
  const client = getClient(await getAccessToken());
  const item = await client.api(`/sites/${siteId}/drives/${driveId}/items/${itemId}`).get();
  const downloadUrl = item["@microsoft.graph.downloadUrl"];
  if (!downloadUrl) { console.error("No download URL available"); process.exit(1); }

  const outputPath = opts.output || item.name;
  const file = createWriteStream(outputPath);
  https.get(downloadUrl, (response) => {
    response.pipe(file);
    file.on("finish", () => { file.close(); console.log(`✅ Downloaded: ${outputPath}`); });
  });
}

async function uploadFile(siteId, driveId, localFile, opts) {
  const client = getClient(await getAccessToken());
  const fileName = basename(localFile);
  const folderPath = opts.path || "";
  const content = readFileSync(localFile);

  const endpoint = folderPath
    ? `/sites/${siteId}/drives/${driveId}/root:${folderPath}/${fileName}:/content`
    : `/sites/${siteId}/drives/${driveId}/root:/${fileName}:/content`;

  const result = await client.api(endpoint).put(content);
  console.log(`✅ Uploaded: ${result.name} (${(result.size / 1024).toFixed(0)}KB)`);
  console.log(`   Web URL: ${result.webUrl}`);
}

// ── Main ──
const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];

if (!cmd || cmd === "--help") {
  console.log(`SharePoint CLI (via Microsoft Graph)

Usage:
  node sharepoint.js sites                                           List all sites
  node sharepoint.js search "query"                                  Search sites
  node sharepoint.js lists <siteId>                                  List document libraries
  node sharepoint.js files <siteId> [driveId] [--path /folder]       List files
  node sharepoint.js read <siteId> <driveId> <itemId>                File metadata
  node sharepoint.js download <siteId> <driveId> <itemId> [--output file]
  node sharepoint.js upload <siteId> <driveId> <localFile> [--path /folder]

Shares Azure AD credentials with outlook skill (~/.outlook-cli/credentials.json).
Add Sites.Read.All, Sites.ReadWrite.All, Files.ReadWrite.All to your Azure AD app.`);
  process.exit(0);
}

try {
  switch (cmd) {
    case "sites":    await listSites(); break;
    case "search":   await searchSites(args._[1]); break;
    case "lists":    await listDrives(args._[1]); break;
    case "files":    await listFiles(args._[1], args); break;
    case "read":     await readFile(args._[1], args._[2], args._[3]); break;
    case "download": await downloadFile(args._[1], args._[2], args._[3], args); break;
    case "upload":   await uploadFile(args._[1], args._[2], args._[3], args); break;
    default: console.error(`Unknown: ${cmd}`); process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
