---
name: notion
description: Notion CLI for searching pages, reading content, querying databases, creating pages, and adding rows. Use when the user needs to interact with Notion.
---

# Notion

Notion operations via Notion API.

## Setup

```bash
cd {baseDir} && npm install
export NOTION_API_KEY=ntn_your-token
```

Create integration at https://www.notion.so/my-integrations. Share pages/databases with the integration.

## Search

```bash
node {baseDir}/notion.js search "project plan"
node {baseDir}/notion.js search "meeting notes"
```

## Read Page

```bash
node {baseDir}/notion.js page <pageId>
```

## Query Database

```bash
node {baseDir}/notion.js db <databaseId>
node {baseDir}/notion.js db <databaseId> --limit 50
```

## Create Page

```bash
node {baseDir}/notion.js create-page <parentPageId> "Meeting Notes" "Discussion about Q1 goals"
```

## Add Database Row

```bash
node {baseDir}/notion.js add-row <databaseId> --prop "Name=New Task" --prop "Status=In Progress" --prop "Priority=High"
```

Property types auto-detected from database schema: title, rich_text, number, select, checkbox, url, email, date, status.
