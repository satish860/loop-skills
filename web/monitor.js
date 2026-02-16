#!/usr/bin/env node

/**
 * Web Monitor using Parallel AI Monitor API (Alpha)
 *
 * Usage:
 *   node monitor.js create "query" [--cadence daily] [--webhook url]
 *   node monitor.js list
 *   node monitor.js get <monitor_id>
 *   node monitor.js events <monitor_id> [--lookback 7d]
 *   node monitor.js update <monitor_id> [--cadence weekly]
 *   node monitor.js delete <monitor_id>
 */

import Parallel from "parallel-web";

const API_KEY = "YIwakM9qjy7zkLsy3UJtlRJeFg0N5z8EXSinXRNR";

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  console.log(`Usage: node monitor.js <command> [options]

Commands:
  create "query"      Create a new monitor
  list                List all monitors
  get <id>            Get monitor details
  events <id>         Get recent events
  update <id>         Update monitor settings
  delete <id>         Delete a monitor

Create Options:
  --cadence MODE      hourly, daily (default), weekly, biweekly
  --webhook URL       Webhook URL for notifications
  --meta KEY=VALUE    Add metadata (repeatable)

Events Options:
  --lookback PERIOD   Time period (e.g., 1d, 7d, 30d)
  --limit N           Max events to return

Update Options:
  --cadence MODE      New cadence
  --webhook URL       New webhook URL

Examples:
  node monitor.js create "AI startup funding news" --cadence daily
  node monitor.js create "Apple product launches" --webhook https://example.com/hook
  node monitor.js events monitor_abc123 --lookback 7d
  node monitor.js delete monitor_abc123`);
  process.exit(0);
}

const client = new Parallel({ apiKey: API_KEY });

const command = args[0];

async function createMonitor() {
  let query = "";
  let cadence = "daily";
  let webhookUrl = null;
  let metadata = {};

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--cadence" && args[i + 1]) {
      cadence = args[i + 1];
      i++;
    } else if (args[i] === "--webhook" && args[i + 1]) {
      webhookUrl = args[i + 1];
      i++;
    } else if (args[i] === "--meta" && args[i + 1]) {
      const [key, value] = args[i + 1].split("=");
      if (key && value) metadata[key] = value;
      i++;
    } else if (!args[i].startsWith("--")) {
      query = args[i];
    }
  }

  if (!query) {
    console.error("Error: Query is required");
    process.exit(1);
  }

  const validCadences = ["hourly", "daily", "weekly", "biweekly"];
  if (!validCadences.includes(cadence)) {
    console.error(`Error: Cadence must be one of: ${validCadences.join(", ")}`);
    process.exit(1);
  }

  const body = {
    query,
    cadence,
  };

  if (webhookUrl) {
    body.webhook = {
      url: webhookUrl,
      event_types: ["monitor.event.detected", "monitor.execution.completed"],
    };
  }

  if (Object.keys(metadata).length > 0) {
    body.metadata = metadata;
  }

  try {
    const res = await client.post("/v1alpha/monitors", { body });
    console.log("## Monitor Created\n");
    console.log(`**ID:** ${res.monitor_id}`);
    console.log(`**Query:** ${res.query}`);
    console.log(`**Cadence:** ${res.cadence}`);
    console.log(`**Status:** ${res.status}`);
    if (res.webhook) console.log(`**Webhook:** ${res.webhook.url}`);
    console.log(`**Created:** ${res.created_at}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

async function listMonitors() {
  try {
    const res = await client.get("/v1alpha/monitors");
    const monitors = res.monitors || [];
    
    if (monitors.length === 0) {
      console.log("No monitors found.");
      return;
    }

    console.log(`## Monitors (${monitors.length})\n`);
    for (const m of monitors) {
      console.log(`### ${m.monitor_id}`);
      console.log(`**Query:** ${m.query}`);
      console.log(`**Cadence:** ${m.cadence} | **Status:** ${m.status}`);
      console.log(`**Created:** ${m.created_at}`);
      console.log();
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

async function getMonitor() {
  const monitorId = args[1];
  if (!monitorId) {
    console.error("Error: Monitor ID is required");
    process.exit(1);
  }

  try {
    const res = await client.get(`/v1alpha/monitors/${monitorId}`);
    console.log("## Monitor Details\n");
    console.log(`**ID:** ${res.monitor_id}`);
    console.log(`**Query:** ${res.query}`);
    console.log(`**Cadence:** ${res.cadence}`);
    console.log(`**Status:** ${res.status}`);
    if (res.webhook) console.log(`**Webhook:** ${res.webhook.url}`);
    if (res.metadata) console.log(`**Metadata:** ${JSON.stringify(res.metadata)}`);
    console.log(`**Created:** ${res.created_at}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

async function getEvents() {
  const monitorId = args[1];
  if (!monitorId) {
    console.error("Error: Monitor ID is required");
    process.exit(1);
  }

  let lookback = null;
  let limit = null;

  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--lookback" && args[i + 1]) {
      lookback = args[i + 1];
      i++;
    } else if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
  }

  try {
    let url = `/v1alpha/monitors/${monitorId}/events`;
    const params = [];
    if (lookback) params.push(`lookback=${lookback}`);
    if (limit) params.push(`limit=${limit}`);
    if (params.length > 0) url += `?${params.join("&")}`;

    const res = await client.get(url);
    const events = res.events || [];

    if (events.length === 0) {
      console.log("No events found.");
      return;
    }

    console.log(`## Events (${events.length})\n`);
    for (const event of events) {
      console.log(`### Event: ${event.event_group_id || "N/A"}`);
      if (event.output) console.log(`**Summary:** ${event.output}`);
      if (event.event_date) console.log(`**Date:** ${event.event_date}`);
      if (event.source_urls && event.source_urls.length > 0) {
        console.log(`**Sources:**`);
        for (const url of event.source_urls) {
          console.log(`  - ${url}`);
        }
      }
      console.log();
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

async function updateMonitor() {
  const monitorId = args[1];
  if (!monitorId) {
    console.error("Error: Monitor ID is required");
    process.exit(1);
  }

  let cadence = null;
  let webhookUrl = null;

  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--cadence" && args[i + 1]) {
      cadence = args[i + 1];
      i++;
    } else if (args[i] === "--webhook" && args[i + 1]) {
      webhookUrl = args[i + 1];
      i++;
    }
  }

  if (!cadence && !webhookUrl) {
    console.error("Error: At least one update field required (--cadence or --webhook)");
    process.exit(1);
  }

  const body = {};
  if (cadence) body.cadence = cadence;
  if (webhookUrl) {
    body.webhook = {
      url: webhookUrl,
      event_types: ["monitor.event.detected", "monitor.execution.completed"],
    };
  }

  try {
    const res = await client.patch(`/v1alpha/monitors/${monitorId}`, { body });
    console.log("## Monitor Updated\n");
    console.log(`**ID:** ${res.monitor_id}`);
    console.log(`**Query:** ${res.query}`);
    console.log(`**Cadence:** ${res.cadence}`);
    console.log(`**Status:** ${res.status}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

async function deleteMonitor() {
  const monitorId = args[1];
  if (!monitorId) {
    console.error("Error: Monitor ID is required");
    process.exit(1);
  }

  try {
    await client.delete(`/v1alpha/monitors/${monitorId}`);
    console.log(`Monitor ${monitorId} deleted successfully.`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Main
try {
  switch (command) {
    case "create":
      await createMonitor();
      break;
    case "list":
      await listMonitors();
      break;
    case "get":
      await getMonitor();
      break;
    case "events":
      await getEvents();
      break;
    case "update":
      await updateMonitor();
      break;
    case "delete":
      await deleteMonitor();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error("Use --help for usage information");
      process.exit(1);
  }
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
