#!/usr/bin/env node

/**
 * Notion CLI via Notion API
 *
 * Usage:
 *   node notion.js search "query"                       # Search pages/databases
 *   node notion.js page <pageId>                        # Read page content
 *   node notion.js db <databaseId> [--limit 20]         # Query database
 *   node notion.js create-page <parentId> "Title" "Content"
 *   node notion.js update-page <pageId> "New content"
 *   node notion.js add-row <databaseId> --prop "Name=value" --prop "Status=Done"
 */

import { Client } from "@notionhq/client";

const TOKEN = process.env.NOTION_API_KEY || "";

function requireToken() {
  if (!TOKEN) {
    console.error("Error: NOTION_API_KEY not set.\nCreate an integration at https://www.notion.so/my-integrations\nThen: export NOTION_API_KEY=ntn_your-token\nDon't forget to share pages/databases with the integration.");
    process.exit(1);
  }
  return new Client({ auth: TOKEN });
}

let notion;

function parseArgs(args) {
  const result = { _: [], prop: [] };
  let i = 0;
  while (i < args.length) {
    if (args[i] === "--prop" && i + 1 < args.length) {
      result.prop.push(args[i + 1]); i += 2;
    } else if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        result[key] = args[i + 1]; i += 2;
      } else { result[key] = true; i += 1; }
    } else { result._.push(args[i]); i += 1; }
  }
  return result;
}

function extractText(richText) {
  return richText?.map((t) => t.plain_text).join("") || "";
}

async function search(query) {
  const result = await notion.search({ query, page_size: 20 });
  for (const item of result.results) {
    const type = item.object;
    let title = "";
    if (type === "page") {
      const titleProp = Object.values(item.properties || {}).find((p) => p.type === "title");
      title = titleProp ? extractText(titleProp.title) : "Untitled";
    } else if (type === "database") {
      title = extractText(item.title) || "Untitled DB";
    }
    console.log(`${type === "database" ? "🗄️" : "📄"} ${title}`);
    console.log(`   ID: ${item.id}`);
    console.log(`   URL: ${item.url}`);
    console.log();
  }
}

async function readPage(pageId) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  const titleProp = Object.values(page.properties || {}).find((p) => p.type === "title");
  const title = titleProp ? extractText(titleProp.title) : "Untitled";
  console.log(`# ${title}`);
  console.log(`URL: ${page.url}`);
  console.log(`Created: ${page.created_time}`);
  console.log(`Updated: ${page.last_edited_time}`);
  console.log("---");

  // Get blocks (content)
  const blocks = await notion.blocks.children.list({ block_id: pageId, page_size: 100 });
  for (const block of blocks.results) {
    const type = block.type;
    const content = block[type];
    if (content?.rich_text) {
      const text = extractText(content.rich_text);
      switch (type) {
        case "heading_1": console.log(`\n# ${text}`); break;
        case "heading_2": console.log(`\n## ${text}`); break;
        case "heading_3": console.log(`\n### ${text}`); break;
        case "bulleted_list_item": console.log(`• ${text}`); break;
        case "numbered_list_item": console.log(`  ${text}`); break;
        case "to_do": console.log(`${content.checked ? "☑" : "☐"} ${text}`); break;
        case "code": console.log(`\`\`\`\n${text}\n\`\`\``); break;
        default: console.log(text);
      }
    } else if (type === "divider") {
      console.log("---");
    }
  }
}

async function queryDatabase(dbId, opts) {
  const limit = parseInt(opts.limit) || 20;
  const result = await notion.databases.query({ database_id: dbId, page_size: limit });

  // Get column names from first result
  if (result.results.length === 0) { console.log("No rows found."); return; }

  for (const row of result.results) {
    const props = {};
    for (const [name, prop] of Object.entries(row.properties)) {
      switch (prop.type) {
        case "title": props[name] = extractText(prop.title); break;
        case "rich_text": props[name] = extractText(prop.rich_text); break;
        case "number": props[name] = prop.number; break;
        case "select": props[name] = prop.select?.name || ""; break;
        case "multi_select": props[name] = prop.multi_select?.map((s) => s.name).join(", "); break;
        case "date": props[name] = prop.date?.start || ""; break;
        case "checkbox": props[name] = prop.checkbox ? "✅" : "❌"; break;
        case "url": props[name] = prop.url || ""; break;
        case "email": props[name] = prop.email || ""; break;
        case "status": props[name] = prop.status?.name || ""; break;
        default: props[name] = `[${prop.type}]`;
      }
    }
    console.log(JSON.stringify(props));
  }
}

async function createPage(parentId, title, content) {
  const page = await notion.pages.create({
    parent: { page_id: parentId },
    properties: { title: { title: [{ text: { content: title } }] } },
    children: content ? [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ text: { content } }] } }] : [],
  });
  console.log(`✅ Created: ${page.url}`);
}

async function addRow(dbId, props) {
  const properties = {};
  // First, get database schema to know property types
  const db = await notion.databases.retrieve({ database_id: dbId });

  for (const propStr of props) {
    const [name, ...valueParts] = propStr.split("=");
    const value = valueParts.join("=");
    const schema = db.properties[name];
    if (!schema) { console.error(`Unknown property: ${name}`); continue; }

    switch (schema.type) {
      case "title": properties[name] = { title: [{ text: { content: value } }] }; break;
      case "rich_text": properties[name] = { rich_text: [{ text: { content: value } }] }; break;
      case "number": properties[name] = { number: parseFloat(value) }; break;
      case "select": properties[name] = { select: { name: value } }; break;
      case "checkbox": properties[name] = { checkbox: value === "true" }; break;
      case "url": properties[name] = { url: value }; break;
      case "email": properties[name] = { email: value }; break;
      case "date": properties[name] = { date: { start: value } }; break;
      case "status": properties[name] = { status: { name: value } }; break;
      default: console.error(`Unsupported type for ${name}: ${schema.type}`);
    }
  }

  const page = await notion.pages.create({ parent: { database_id: dbId }, properties });
  console.log(`✅ Row added: ${page.url}`);
}

// ── Main ──
const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];

if (!cmd || cmd === "--help") {
  console.log(`Notion CLI

Usage:
  node notion.js search "query"                                    Search pages/databases
  node notion.js page <pageId>                                     Read page content
  node notion.js db <databaseId> [--limit 20]                      Query database rows
  node notion.js create-page <parentPageId> "Title" "Content"      Create page
  node notion.js add-row <databaseId> --prop "Name=value" --prop "Status=Done"

Requires: NOTION_API_KEY env var (https://www.notion.so/my-integrations)`);
  process.exit(0);
}

try {
  notion = requireToken();
  switch (cmd) {
    case "search":      await search(args._[1] || ""); break;
    case "page":        await readPage(args._[1]); break;
    case "db":          await queryDatabase(args._[1], args); break;
    case "create-page": await createPage(args._[1], args._[2], args._[3]); break;
    case "add-row":     await addRow(args._[1], args.prop); break;
    default: console.error(`Unknown: ${cmd}`); process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
