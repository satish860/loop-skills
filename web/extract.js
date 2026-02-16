#!/usr/bin/env node

/**
 * Web Extract using Parallel AI Extract API
 *
 * Usage:
 *   node extract.js "url1" ["url2" ...]
 *   node extract.js "url" --objective "what to extract"
 *   node extract.js "url" --full
 */

import Parallel from "parallel-web";

const API_KEY = process.env.PARALLEL_API_KEY || "";
if (!API_KEY) {
  console.error("Error: PARALLEL_API_KEY not set.\nGet your key at https://www.parallel.ai and run:\n  export PARALLEL_API_KEY=your-key-here");
  process.exit(1);
}

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  console.log(`Usage: node extract.js "url1" ["url2" ...] [options]

Options:
  --objective TEXT    Focus extraction on specific information
  --queries Q1 Q2     Keyword queries to emphasize terms
  --full              Return full page content (default: excerpts only)
  --both              Return both excerpts and full content
  --max-chars N       Max chars per result (default: 10000/50000)
  --fresh N           Max age in seconds for cached content (min: 600)
  --timeout N         Timeout for live fetch in seconds
  -h, --help          Show this help

Examples:
  node extract.js "https://docs.example.com/api" --objective "authentication methods"
  node extract.js "https://example.com/page.pdf" --full
  node extract.js "url1" "url2" --objective "compare features"`);
  process.exit(0);
}

// Parse arguments
let urls = [];
let objective = "";
let searchQueries = [];
let fullContent = false;
let excerpts = true;
let maxCharsPerResult = null;
let maxAgeSeconds = null;
let timeoutSeconds = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--objective" && args[i + 1]) {
    objective = args[i + 1];
    i++;
  } else if (args[i] === "--queries") {
    i++;
    while (i < args.length && !args[i].startsWith("--")) {
      searchQueries.push(args[i]);
      i++;
    }
    i--;
  } else if (args[i] === "--full") {
    fullContent = true;
    excerpts = false;
  } else if (args[i] === "--both") {
    fullContent = true;
    excerpts = true;
  } else if (args[i] === "--max-chars" && args[i + 1]) {
    maxCharsPerResult = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === "--fresh" && args[i + 1]) {
    maxAgeSeconds = Math.max(600, parseInt(args[i + 1], 10));
    i++;
  } else if (args[i] === "--timeout" && args[i + 1]) {
    timeoutSeconds = parseInt(args[i + 1], 10);
    i++;
  } else if (!args[i].startsWith("--")) {
    urls.push(args[i]);
  }
}

if (urls.length === 0) {
  console.error("Error: At least one URL is required");
  process.exit(1);
}

if (urls.length > 10) {
  console.error("Error: Maximum 10 URLs per request");
  process.exit(1);
}

const client = new Parallel({ apiKey: API_KEY });

// Build request
const request = {
  urls: urls,
};

if (objective) {
  request.objective = objective;
}

if (searchQueries.length > 0) {
  request.search_queries = searchQueries;
}

// Configure excerpts
if (excerpts) {
  if (maxCharsPerResult && !fullContent) {
    request.excerpts = { max_chars_per_result: maxCharsPerResult };
  } else {
    request.excerpts = true;
  }
} else {
  request.excerpts = false;
}

// Configure full content
if (fullContent) {
  if (maxCharsPerResult) {
    request.full_content = { max_chars_per_result: maxCharsPerResult };
  } else {
    request.full_content = true;
  }
} else {
  request.full_content = false;
}

// Add fetch policy if specified
if (maxAgeSeconds !== null || timeoutSeconds !== null) {
  request.fetch_policy = {};
  if (maxAgeSeconds !== null) {
    request.fetch_policy.max_age_seconds = maxAgeSeconds;
  }
  if (timeoutSeconds !== null) {
    request.fetch_policy.timeout_seconds = timeoutSeconds;
  }
}

try {
  const extract = await client.beta.extract(request);

  if (extract.results && extract.results.length > 0) {
    console.log(`## Extracted Content`);
    if (objective) console.log(`**Objective:** ${objective}`);
    console.log(`**URLs:** ${urls.length} | **Mode:** ${fullContent ? (excerpts ? "both" : "full") : "excerpts"}\n`);

    for (let i = 0; i < extract.results.length; i++) {
      const result = extract.results[i];
      console.log(`### ${i + 1}. ${result.title || "Untitled"}`);
      console.log(`**URL:** ${result.url}`);
      if (result.publish_date) {
        console.log(`**Published:** ${result.publish_date}`);
      }
      console.log();

      if (result.excerpts && result.excerpts.length > 0) {
        console.log("#### Excerpts\n");
        for (const excerpt of result.excerpts) {
          console.log(excerpt);
          console.log();
        }
      }

      if (result.full_content) {
        console.log("#### Full Content\n");
        console.log(result.full_content);
        console.log();
      }

      console.log("---\n");
    }
  } else {
    console.log("No content extracted.");
  }

  if (extract.errors && extract.errors.length > 0) {
    console.error("\n### Errors");
    for (const err of extract.errors) {
      console.error(`- ${err.url}: ${err.error}`);
    }
  }

  if (extract.warnings) {
    console.error("\nWarnings:", extract.warnings);
  }

  if (extract.usage) {
    console.error(`\n[Usage: ${JSON.stringify(extract.usage)}]`);
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
