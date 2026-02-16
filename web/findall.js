#!/usr/bin/env node

/**
 * Web FindAll using Parallel AI FindAll API (Beta)
 *
 * Usage:
 *   node findall.js "FindAll AI startups in NYC"
 *   node findall.js "query" --limit 50 --generator pro
 *   node findall.js status <findall_id>
 *   node findall.js results <findall_id>
 */

import Parallel from "parallel-web";

const API_KEY = "YIwakM9qjy7zkLsy3UJtlRJeFg0N5z8EXSinXRNR";
const BETA_HEADER = "findall-2025-09-15";

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  console.log(`Usage: node findall.js "query" [options]
       node findall.js status <findall_id>
       node findall.js results <findall_id>

Options:
  --limit N        Max matched entities (default: 25)
  --generator G    base, core (default), or pro
  --preview        Test with ~10 candidates first
  --async          Return run ID immediately, don't wait
  --timeout N      Max wait time in seconds (default: 300)
  -h, --help       Show this help

Examples:
  node findall.js "FindAll AI startups that raised Series A in 2024"
  node findall.js "FindAll fintech companies in Brazil" --limit 50
  node findall.js "FindAll portfolio companies of a16z" --generator pro --preview`);
  process.exit(0);
}

const client = new Parallel({ apiKey: API_KEY });

// Helper to sleep
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Check if first arg is a command
const command = args[0];

async function getStatus(findallId) {
  try {
    const res = await client.get(`/v1beta/findall/runs/${findallId}`, {
      headers: { "parallel-beta": BETA_HEADER },
    });

    console.log("## FindAll Status\n");
    console.log(`**ID:** ${res.findall_id}`);
    console.log(`**Status:** ${res.status?.status || "unknown"}`);
    console.log(`**Active:** ${res.status?.is_active ? "Yes" : "No"}`);
    if (res.status?.metrics) {
      console.log(`**Generated:** ${res.status.metrics.generated_candidates_count || 0}`);
      console.log(`**Matched:** ${res.status.metrics.matched_candidates_count || 0}`);
    }
    if (res.status?.termination_reason) {
      console.log(`**Termination:** ${res.status.termination_reason}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

async function getResults(findallId) {
  try {
    const res = await client.get(`/v1beta/findall/runs/${findallId}/result`, {
      headers: { "parallel-beta": BETA_HEADER },
    });

    printResults(res);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

function printResults(res) {
  const candidates = res.candidates || [];
  const matched = candidates.filter((c) => c.match_status === "matched");

  console.log("## FindAll Results\n");
  console.log(`**ID:** ${res.findall_id}`);
  console.log(`**Status:** ${res.status?.status || "unknown"}`);
  console.log(`**Total Candidates:** ${candidates.length}`);
  console.log(`**Matched:** ${matched.length}\n`);

  if (matched.length === 0) {
    console.log("No matched entities found.");
    return;
  }

  console.log("---\n");

  for (let i = 0; i < matched.length; i++) {
    const c = matched[i];
    console.log(`### ${i + 1}. ${c.name}`);
    if (c.url) console.log(`**URL:** ${c.url}`);
    if (c.description) console.log(`**Description:** ${c.description}`);
    console.log();

    // Print match condition values
    if (c.output) {
      console.log("**Match Conditions:**");
      for (const [key, val] of Object.entries(c.output)) {
        if (val.type === "match_condition") {
          const status = val.is_matched ? "✓" : "✗";
          console.log(`  - ${key}: ${val.value} ${status}`);
        }
      }
      console.log();
    }

    // Print citations (abbreviated)
    if (c.basis && c.basis.length > 0) {
      console.log("**Sources:**");
      const seenUrls = new Set();
      for (const b of c.basis) {
        if (b.citations) {
          for (const cite of b.citations) {
            if (!seenUrls.has(cite.url)) {
              seenUrls.add(cite.url);
              console.log(`  - [${cite.title || "Source"}](${cite.url})`);
            }
          }
        }
      }
      console.log();
    }

    console.log("---\n");
  }
}

async function runFindAll() {
  // Parse arguments
  let objective = "";
  let matchLimit = 25;
  let generator = "core";
  let preview = false;
  let async = false;
  let timeout = 300;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      matchLimit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--generator" && args[i + 1]) {
      generator = args[i + 1];
      i++;
    } else if (args[i] === "--preview") {
      preview = true;
    } else if (args[i] === "--async") {
      async = true;
    } else if (args[i] === "--timeout" && args[i + 1]) {
      timeout = parseInt(args[i + 1], 10);
      i++;
    } else if (!args[i].startsWith("--")) {
      objective = args[i];
    }
  }

  if (!objective) {
    console.error("Error: Query is required");
    process.exit(1);
  }

  // Validate generator
  const validGenerators = ["base", "core", "pro"];
  if (preview) {
    generator = "preview";
    matchLimit = Math.min(matchLimit, 10); // Preview limited to 10
  } else if (!validGenerators.includes(generator)) {
    console.error(`Error: Generator must be one of: ${validGenerators.join(", ")}`);
    process.exit(1);
  }

  try {
    // Step 1: Ingest - convert natural language to schema
    console.error(`[Ingesting query...]`);
    const ingestRes = await client.post("/v1beta/findall/ingest", {
      headers: { "parallel-beta": BETA_HEADER },
      body: { objective },
    });

    const entityType = ingestRes.entity_type || "entities";
    const matchConditions = ingestRes.match_conditions || [];

    console.error(`[Entity type: ${entityType}, Conditions: ${matchConditions.length}]`);

    // Step 2: Create run
    console.error(`[Creating FindAll run with generator=${generator}, limit=${matchLimit}...]`);
    const createRes = await client.post("/v1beta/findall/runs", {
      headers: { "parallel-beta": BETA_HEADER },
      body: {
        objective,
        entity_type: entityType,
        match_conditions: matchConditions,
        generator,
        match_limit: matchLimit,
      },
    });

    const findallId = createRes.findall_id;
    console.error(`[Created: ${findallId}]`);

    if (async) {
      console.log(`## FindAll Run Created\n`);
      console.log(`**ID:** ${findallId}`);
      console.log(`**Query:** ${objective}`);
      console.log(`\nUse \`node findall.js status ${findallId}\` to check progress.`);
      console.log(`Use \`node findall.js results ${findallId}\` to get results.`);
      return;
    }

    // Step 3: Poll for completion
    const startTime = Date.now();
    let status = "queued";
    let lastMetrics = null;

    while (status !== "completed" && status !== "failed" && status !== "cancelled") {
      if ((Date.now() - startTime) / 1000 > timeout) {
        console.error(`\n[Timeout after ${timeout}s. Run ID: ${findallId}]`);
        console.log(`\nUse \`node findall.js results ${findallId}\` to get partial results.`);
        return;
      }

      await sleep(3000);

      const pollRes = await client.get(`/v1beta/findall/runs/${findallId}`, {
        headers: { "parallel-beta": BETA_HEADER },
      });

      status = pollRes.status?.status || "unknown";
      const metrics = pollRes.status?.metrics;

      if (metrics && JSON.stringify(metrics) !== JSON.stringify(lastMetrics)) {
        console.error(
          `[Status: ${status} | Generated: ${metrics.generated_candidates_count || 0} | Matched: ${metrics.matched_candidates_count || 0}]`
        );
        lastMetrics = metrics;
      }

      if (!pollRes.status?.is_active) {
        break;
      }
    }

    // Step 4: Get results
    console.error(`[Fetching results...]`);
    const resultRes = await client.get(`/v1beta/findall/runs/${findallId}/result`, {
      headers: { "parallel-beta": BETA_HEADER },
    });

    printResults(resultRes);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Main
try {
  if (command === "status" && args[1]) {
    await getStatus(args[1]);
  } else if (command === "results" && args[1]) {
    await getResults(args[1]);
  } else {
    await runFindAll();
  }
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
