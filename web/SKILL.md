---
name: web
description: Web search, content extraction, entity discovery, and web monitoring via Parallel AI API. Use when you need to search the web, read web pages, find entities matching criteria, or set up ongoing monitoring.
---

# Web Tools

Four tools in one skill. All use the Parallel AI API.

## Setup

```bash
cd {baseDir} && npm install
```

## Search

Search the web with natural language.

```bash
node {baseDir}/search.js "objective"
node {baseDir}/search.js "objective" --queries "query1" "query2"
node {baseDir}/search.js "objective" --mode agentic          # token-efficient
node {baseDir}/search.js "objective" --mode fast              # ~1s response
node {baseDir}/search.js "objective" --max-results 10
node {baseDir}/search.js "objective" --fresh 3600             # max age in seconds
```

Modes: `one-shot` (comprehensive, default), `agentic` (concise), `fast` (~1s).

## Extract

Extract clean markdown from any URL. Handles JS-heavy pages and PDFs.

```bash
node {baseDir}/extract.js "https://example.com"
node {baseDir}/extract.js "https://example.com" --objective "pricing details"
node {baseDir}/extract.js "https://example.com" --full        # full page content
node {baseDir}/extract.js "url1" "url2" --objective "compare" # multiple URLs (up to 10)
node {baseDir}/extract.js "https://example.com" --fresh 3600  # live fetch
```

Options: `--objective TEXT`, `--full`, `--both`, `--max-chars N`, `--fresh N`, `--queries Q1 Q2`.

## Find All

Discover all entities matching criteria from across the web.

```bash
node {baseDir}/findall.js "all AI startups that raised Series A in 2024"
node {baseDir}/findall.js "portfolio companies of Sequoia" --max-entities 50
node {baseDir}/findall.js "aviation leasing companies in Ireland" --columns "name,fleet_size,hq"
```

Options: `--max-entities N` (default 20), `--columns col1,col2`, `--stream`, `--fresh N`.

## Monitor

Track web changes continuously with scheduled checks.

```bash
node {baseDir}/monitor.js create "topic" --schedule daily     # create monitor
node {baseDir}/monitor.js create "topic" --schedule hourly --webhook URL
node {baseDir}/monitor.js list                                 # list monitors
node {baseDir}/monitor.js results <monitor-id>                 # get results
node {baseDir}/monitor.js delete <monitor-id>                  # delete monitor
```

Schedules: `hourly`, `daily`, `weekly`. Supports `--webhook URL` for notifications.

## When to Use

- **search** — find information, documentation, news, facts
- **extract** — read a specific URL, convert web page to markdown
- **findall** — discover lists of companies, people, products matching criteria
- **monitor** — track ongoing changes (price changes, news, regulatory updates)
