---
name: firecrawl
description: Web crawling, scraping, and structured extraction via Firecrawl API. Use when you need to scrape JS-heavy pages, crawl entire sites, or extract structured data. Requires FIRECRAWL_API_KEY env var.
---

# Firecrawl Tools

Web crawling and scraping via Firecrawl API. Handles JS-heavy pages, full site crawls, structured extraction.

## Setup

Set `FIRECRAWL_API_KEY` in your environment:
```bash
export FIRECRAWL_API_KEY=fc-xxxxxxxxxx
```

## Search

```bash
python3 {baseDir}/scripts/search.py "your search query" --limit 10
```

## Scrape a Page

```bash
python3 {baseDir}/scripts/scrape.py "https://example.com"
```

## Crawl a Site

```bash
python3 {baseDir}/scripts/crawl.py "https://example.com" --max-pages 50
```

## When to Use

- **firecrawl** vs **web extract**: Use firecrawl when you need to crawl entire sites or extract structured data. Use web extract for single-page content.
- Scraping JS-heavy SPAs that need rendering
- Crawling documentation sites or knowledge bases
- Extracting structured data from multiple pages
