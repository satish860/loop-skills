#!/usr/bin/env node

/**
 * Web Search using Parallel AI Search API
 *
 * Usage:
 *   node search.js "objective"
 *   node search.js "objective" --queries "query1" "query2"
 *   node search.js "objective" --mode agentic
 *   node search.js "objective" --max-results 10
 *   node search.js "objective" --fresh 3600
 */

import Parallel from "parallel-web";

const API_KEY = process.env.PARALLEL_API_KEY || "";
if (!API_KEY) {
  console.error("Error: PARALLEL_API_KEY not set.\nGet your key at https://www.parallel.ai and run:\n  export PARALLEL_API_KEY=your-key-here");
  process.exit(1);
}

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  console.log(`Usage: node search.js "objective" [options]

Options:
  --queries Q1 Q2      Specific search queries (recommended with objective)
  --mode MODE          Search mode: one-shot (default), agentic, or fast
                       - one-shot: comprehensive results, longer excerpts
                       - agentic: concise, token-efficient for multi-step workflows
                       - fast: ~1s response for latency-sensitive cases
  --max-results N      Maximum results (1-20, default: 10)
  --max-chars N        Max characters per result excerpt (default: 10000)
  --max-total N        Max total characters across all excerpts (default: 50000)
  --fresh N            Max age in seconds for fresh content (enables live fetch)
  --include D1 D2      Include only these domains
  --exclude D1 D2      Exclude these domains
  --after YYYY-MM-DD   Only include content after this date
  -h, --help           Show this help

Best Practice: Provide both an objective (context about your goal) AND
specific search queries for optimal results.

Examples:
  node search.js "Find EV tax credits for California businesses" \\
    --queries "EV tax credit business" "California EV rebate"

  node search.js "Recent quantum computing research" --mode agentic \\
    --queries "quantum error correction 2024" --fresh 86400`);
  process.exit(0);
}

// Parse arguments
let objective = "";
let searchQueries = [];
let mode = "one-shot";
let maxResults = 10;
let maxCharsPerResult = 10000;
let maxCharsTotal = 50000;
let maxAgeSeconds = null;
let includeDomains = [];
let excludeDomains = [];
let afterDate = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--queries") {
    i++;
    while (i < args.length && !args[i].startsWith("--")) {
      searchQueries.push(args[i]);
      i++;
    }
    i--;
  } else if (args[i] === "--mode" && args[i + 1]) {
    mode = args[i + 1];
    i++;
  } else if (args[i] === "--max-results" && args[i + 1]) {
    maxResults = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === "--max-chars" && args[i + 1]) {
    maxCharsPerResult = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === "--max-total" && args[i + 1]) {
    maxCharsTotal = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === "--fresh" && args[i + 1]) {
    maxAgeSeconds = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === "--include") {
    i++;
    while (i < args.length && !args[i].startsWith("--")) {
      includeDomains.push(args[i]);
      i++;
    }
    i--;
  } else if (args[i] === "--exclude") {
    i++;
    while (i < args.length && !args[i].startsWith("--")) {
      excludeDomains.push(args[i]);
      i++;
    }
    i--;
  } else if (args[i] === "--after" && args[i + 1]) {
    afterDate = args[i + 1];
    i++;
  } else if (!args[i].startsWith("--")) {
    objective = args[i];
  }
}

if (!objective && searchQueries.length === 0) {
  console.error("Error: Provide an objective or search queries");
  process.exit(1);
}

// Validate mode
if (!["one-shot", "agentic", "fast"].includes(mode)) {
  console.error("Error: Mode must be one-shot, agentic, or fast");
  process.exit(1);
}

const client = new Parallel({ apiKey: API_KEY });

// Build request
const request = {
  mode: mode,
  max_results: maxResults,
  excerpts: {
    max_chars_per_result: maxCharsPerResult,
    max_chars_total: maxCharsTotal,
  },
};

if (objective) {
  request.objective = objective;
}

if (searchQueries.length > 0) {
  request.search_queries = searchQueries;
}

// Add source policy if specified
if (includeDomains.length > 0 || excludeDomains.length > 0 || afterDate) {
  request.source_policy = {};
  if (includeDomains.length > 0) {
    request.source_policy.include_domains = includeDomains;
  }
  if (excludeDomains.length > 0) {
    request.source_policy.exclude_domains = excludeDomains;
  }
  if (afterDate) {
    request.source_policy.after_date = afterDate;
  }
}

// Add fetch policy if fresh content requested
if (maxAgeSeconds !== null) {
  request.fetch_policy = { max_age_seconds: maxAgeSeconds };
}

try {
  const search = await client.beta.search(request);

  if (search.results && search.results.length > 0) {
    console.log(`## Search Results`);
    if (objective) console.log(`**Objective:** ${objective}`);
    if (searchQueries.length > 0) console.log(`**Queries:** ${searchQueries.join(", ")}`);
    console.log(`**Mode:** ${mode} | **Results:** ${search.results.length}\n`);

    for (let i = 0; i < search.results.length; i++) {
      const result = search.results[i];
      console.log(`### ${i + 1}. ${result.title}`);
      console.log(`**URL:** ${result.url}`);
      if (result.publish_date) {
        console.log(`**Published:** ${result.publish_date}`);
      }
      console.log();

      if (result.excerpts && result.excerpts.length > 0) {
        for (const excerpt of result.excerpts) {
          console.log(excerpt);
          console.log();
        }
      }
      console.log("---\n");
    }
  } else {
    console.log("No results found.");
  }

  if (search.warnings) {
    console.error("\nWarnings:", search.warnings);
  }

  if (search.usage) {
    console.error(`\n[Usage: ${JSON.stringify(search.usage)}]`);
  }
} catch (error) {
  if (error.status === 401) {
    console.error("Error: Invalid API key");
  } else if (error.status === 429) {
    console.error("Error: Rate limited. Try again in a moment.");
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}
