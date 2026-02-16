#!/usr/bin/env node

/**
 * Microsoft Dynamics 365 CLI via Dataverse Web API
 *
 * Usage:
 *   node dynamics.js setup                                              # Configure org URL
 *   node dynamics.js query "accounts?$select=name,revenue&$top=10"      # OData query
 *   node dynamics.js get <entity> <recordId>                            # Get record
 *   node dynamics.js create <entity> --field "name=Acme" --field "revenue=1000000"
 *   node dynamics.js update <entity> <recordId> --field "name=New Name"
 *   node dynamics.js delete <entity> <recordId>
 *   node dynamics.js entities                                           # List entities
 *   node dynamics.js metadata <entity>                                  # Entity metadata
 */

import { PublicClientApplication } from "@azure/msal-node";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const CONFIG_DIR = join(homedir(), ".dynamics-cli");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const TOKEN_FILE = join(CONFIG_DIR, "token.json");

function ensureDir() { if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true }); }
function loadConfig() { return existsSync(CONFIG_FILE) ? JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) : null; }
function saveConfig(c) { ensureDir(); writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2)); }
function loadToken() {
  if (!existsSync(TOKEN_FILE)) return null;
  const d = JSON.parse(readFileSync(TOKEN_FILE, "utf-8"));
  return d.expiresAt && Date.now() > d.expiresAt ? null : d;
}
function saveToken(t) {
  ensureDir();
  const d = { accessToken: t.accessToken, expiresAt: Date.now() + (t.expiresIn || 3600) * 1000 };
  writeFileSync(TOKEN_FILE, JSON.stringify(d, null, 2));
  return d;
}

function parseArgs(args) {
  const result = { _: [], field: [] };
  let i = 0;
  while (i < args.length) {
    if (args[i] === "--field" && i + 1 < args.length) { result.field.push(args[i + 1]); i += 2; }
    else if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith("--")) { result[key] = args[i + 1]; i += 2; }
      else { result[key] = true; i += 1; }
    } else { result._.push(args[i]); i += 1; }
  }
  return result;
}

async function authenticate(config) {
  const pca = new PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId || "common"}`,
    },
  });
  const result = await pca.acquireTokenByDeviceCode({
    scopes: [`${config.orgUrl}/.default`],
    deviceCodeCallback: (r) => { console.log("\n" + r.message + "\nWaiting..."); },
  });
  return saveToken(result);
}

async function getAccessToken() {
  const token = loadToken();
  if (token) return token.accessToken;
  const config = loadConfig();
  if (!config) { console.error("Not configured. Run: node dynamics.js setup"); process.exit(1); }
  const t = await authenticate(config);
  return t.accessToken;
}

async function apiCall(method, endpoint, body) {
  const config = loadConfig();
  if (!config) { console.error("Not configured. Run: node dynamics.js setup"); process.exit(1); }
  const token = await getAccessToken();
  const url = `${config.orgUrl}/api/data/v9.2/${endpoint}`;

  const options = {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0",
      "Accept": "application/json",
      "Prefer": "odata.include-annotations=*",
    },
  };

  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${response.status}: ${err}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function setup() {
  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((r) => rl.question(q, r));

  console.log("Dynamics 365 CLI Setup\n");
  console.log("You need:");
  console.log("1. Your Dynamics 365 org URL (e.g., https://yourorg.crm4.dynamics.com)");
  console.log("2. An Azure AD app with Dynamics CRM user_impersonation permission\n");

  const orgUrl = await ask("Org URL (e.g., https://yourorg.crm4.dynamics.com): ");
  const clientId = await ask("Azure AD Application (client) ID: ");
  const tenantId = await ask("Tenant ID (or 'common'): ");
  rl.close();

  saveConfig({ orgUrl: orgUrl.trim().replace(/\/$/, ""), clientId: clientId.trim(), tenantId: tenantId.trim() || "common" });
  console.log(`\n✅ Config saved to ${CONFIG_FILE}`);
  console.log("Run: node dynamics.js auth");
}

async function auth() {
  const config = loadConfig();
  if (!config) { console.error("Run setup first."); process.exit(1); }
  await authenticate(config);
  console.log("✅ Authenticated.");
}

async function query(odata) {
  const result = await apiCall("GET", odata);
  if (result?.value) {
    console.log(`Records: ${result.value.length}`);
    for (const r of result.value) {
      const clean = {};
      for (const [k, v] of Object.entries(r)) {
        if (!k.startsWith("@") && !k.startsWith("_")) clean[k] = v;
      }
      console.log(JSON.stringify(clean));
    }
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

async function getRecord(entity, recordId) {
  const result = await apiCall("GET", `${entity}(${recordId})`);
  const clean = {};
  for (const [k, v] of Object.entries(result)) {
    if (!k.startsWith("@") && !k.startsWith("_")) clean[k] = v;
  }
  console.log(JSON.stringify(clean, null, 2));
}

async function createRecord(entity, fields) {
  const data = {};
  for (const f of fields) { const [k, ...v] = f.split("="); data[k] = v.join("="); }
  const result = await apiCall("POST", entity, data);
  console.log(`✅ Created ${entity}`);
}

async function updateRecord(entity, recordId, fields) {
  const data = {};
  for (const f of fields) { const [k, ...v] = f.split("="); data[k] = v.join("="); }
  await apiCall("PATCH", `${entity}(${recordId})`, data);
  console.log(`✅ Updated ${entity}: ${recordId}`);
}

async function deleteRecord(entity, recordId) {
  await apiCall("DELETE", `${entity}(${recordId})`);
  console.log(`✅ Deleted ${entity}: ${recordId}`);
}

async function listEntities() {
  const result = await apiCall("GET", "EntityDefinitions?$select=LogicalName,DisplayName,IsCustomEntity&$orderby=LogicalName");
  const custom = result.value.filter((e) => e.IsCustomEntity);
  const standard = result.value.filter((e) => !e.IsCustomEntity).slice(0, 30);

  console.log("Standard Entities (top 30):");
  for (const e of standard) {
    const name = e.DisplayName?.UserLocalizedLabel?.Label || e.LogicalName;
    console.log(`  ${e.LogicalName} — ${name}`);
  }
  if (custom.length) {
    console.log(`\nCustom Entities (${custom.length}):`);
    for (const e of custom) {
      const name = e.DisplayName?.UserLocalizedLabel?.Label || e.LogicalName;
      console.log(`  ${e.LogicalName} — ${name}`);
    }
  }
}

async function entityMetadata(entity) {
  const result = await apiCall("GET", `EntityDefinitions(LogicalName='${entity}')?$expand=Attributes($select=LogicalName,AttributeType,DisplayName,RequiredLevel)`);
  const name = result.DisplayName?.UserLocalizedLabel?.Label || entity;
  console.log(`# ${name} (${entity})`);
  console.log(`\nAttributes (${result.Attributes.length}):`);
  for (const a of result.Attributes.slice(0, 50)) {
    const label = a.DisplayName?.UserLocalizedLabel?.Label || a.LogicalName;
    const req = a.RequiredLevel?.Value === "ApplicationRequired" ? " *required*" : "";
    console.log(`  ${a.LogicalName} (${a.AttributeType})${req} — ${label}`);
  }
  if (result.Attributes.length > 50) console.log(`  ... and ${result.Attributes.length - 50} more`);
}

// ── Main ──
const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];

if (!cmd || cmd === "--help") {
  console.log(`Microsoft Dynamics 365 CLI

Usage:
  node dynamics.js setup                                                  Interactive setup
  node dynamics.js auth                                                   Authenticate
  node dynamics.js query "accounts?$select=name,revenue&$top=10"          OData query
  node dynamics.js get <entity> <recordId>                                Get record
  node dynamics.js create <entity> --field "name=Acme" --field "revenue=1000000"
  node dynamics.js update <entity> <recordId> --field "name=New Name"
  node dynamics.js delete <entity> <recordId>
  node dynamics.js entities                                               List entities
  node dynamics.js metadata <entity>                                      Entity metadata

Config stored in ~/.dynamics-cli/`);
  process.exit(0);
}

try {
  switch (cmd) {
    case "setup":    await setup(); break;
    case "auth":     await auth(); break;
    case "query":    await query(args._[1]); break;
    case "get":      await getRecord(args._[1], args._[2]); break;
    case "create":   await createRecord(args._[1], args.field); break;
    case "update":   await updateRecord(args._[1], args._[2], args.field); break;
    case "delete":   await deleteRecord(args._[1], args._[2]); break;
    case "entities": await listEntities(); break;
    case "metadata": await entityMetadata(args._[1]); break;
    default: console.error(`Unknown: ${cmd}`); process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
