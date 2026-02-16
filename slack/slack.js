#!/usr/bin/env node

/**
 * Slack CLI via Slack Web API
 *
 * Usage:
 *   node slack.js channels                              # List channels
 *   node slack.js history <channel> [--limit 20]        # Channel messages
 *   node slack.js send <channel> "message"              # Send message
 *   node slack.js reply <channel> <threadTs> "message"  # Reply in thread
 *   node slack.js search "query" [--limit 10]           # Search messages
 *   node slack.js users                                 # List users
 *   node slack.js dm <userId> "message"                 # Direct message
 *   node slack.js upload <channel> <file>               # Upload file
 */

import pkg from "@slack/web-api";
const { WebClient } = pkg;

const TOKEN = process.env.SLACK_BOT_TOKEN || "";

function requireToken() {
  if (!TOKEN) {
    console.error("Error: SLACK_BOT_TOKEN not set.\nCreate a Slack app at https://api.slack.com/apps and add Bot Token Scopes:\n  channels:read, channels:history, chat:write, search:read, users:read, files:write\nThen: export SLACK_BOT_TOKEN=xoxb-your-token");
    process.exit(1);
  }
  return new WebClient(TOKEN);
}

let client;

function parseArgs(args) {
  const result = { _: [] };
  let i = 0;
  while (i < args.length) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        result[key] = args[i + 1]; i += 2;
      } else { result[key] = true; i += 1; }
    } else { result._.push(args[i]); i += 1; }
  }
  return result;
}

async function listChannels() {
  const result = await client.conversations.list({ types: "public_channel,private_channel", limit: 100 });
  for (const ch of result.channels) {
    const members = ch.num_members || 0;
    const priv = ch.is_private ? "🔒" : "  ";
    console.log(`${priv} #${ch.name} (${members} members) — ${ch.purpose?.value || ""}`);
    console.log(`   ID: ${ch.id}`);
  }
}

async function channelHistory(channelId, opts) {
  const limit = parseInt(opts.limit) || 20;
  const result = await client.conversations.history({ channel: channelId, limit });
  for (const msg of result.messages.reverse()) {
    const user = msg.user || "bot";
    const time = new Date(parseFloat(msg.ts) * 1000).toLocaleString();
    const thread = msg.reply_count ? ` [${msg.reply_count} replies]` : "";
    console.log(`${time}  <${user}>${thread}`);
    console.log(`  ${msg.text}`);
    console.log(`  ts: ${msg.ts}`);
    console.log();
  }
}

async function sendMessage(channel, text) {
  const result = await client.chat.postMessage({ channel, text });
  console.log(`✅ Sent to ${channel} (ts: ${result.ts})`);
}

async function replyMessage(channel, threadTs, text) {
  const result = await client.chat.postMessage({ channel, text, thread_ts: threadTs });
  console.log(`✅ Reply sent (ts: ${result.ts})`);
}

async function searchMessages(query, opts) {
  const count = parseInt(opts.limit) || 10;
  const result = await client.search.messages({ query, count });
  if (!result.messages?.matches?.length) {
    console.log(`No results for: ${query}`);
    return;
  }
  for (const msg of result.messages.matches) {
    const ch = msg.channel?.name || "unknown";
    const user = msg.username || msg.user || "unknown";
    console.log(`#${ch}  <${user}>`);
    console.log(`  ${msg.text?.slice(0, 200)}`);
    console.log(`  ts: ${msg.ts}`);
    console.log();
  }
}

async function listUsers() {
  const result = await client.users.list();
  for (const u of result.members) {
    if (u.deleted || u.is_bot) continue;
    const name = u.real_name || u.name;
    const status = u.profile?.status_emoji ? ` ${u.profile.status_emoji} ${u.profile.status_text}` : "";
    console.log(`${name} (@${u.name})${status}`);
    console.log(`  ID: ${u.id}  Email: ${u.profile?.email || "n/a"}`);
  }
}

async function directMessage(userId, text) {
  const conv = await client.conversations.open({ users: userId });
  const result = await client.chat.postMessage({ channel: conv.channel.id, text });
  console.log(`✅ DM sent to ${userId} (ts: ${result.ts})`);
}

async function uploadFile(channel, filePath) {
  const { createReadStream } = await import("fs");
  const { basename } = await import("path");
  // Use files.uploadV2
  await client.filesUploadV2({
    channel_id: channel,
    file: createReadStream(filePath),
    filename: basename(filePath),
  });
  console.log(`✅ Uploaded ${filePath} to ${channel}`);
}

// ── Main ──
const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];

if (!cmd || cmd === "--help" || cmd === "-h") {
  console.log(`Slack CLI

Usage:
  node slack.js channels                              List channels
  node slack.js history <channel> [--limit 20]        Channel messages
  node slack.js send <channel> "message"              Send message
  node slack.js reply <channel> <threadTs> "message"  Reply in thread
  node slack.js search "query" [--limit 10]           Search messages
  node slack.js users                                 List users
  node slack.js dm <userId> "message"                 Direct message
  node slack.js upload <channel> <file>               Upload file

Requires: SLACK_BOT_TOKEN env var`);
  process.exit(0);
}

try {
  client = requireToken();
  switch (cmd) {
    case "channels": await listChannels(); break;
    case "history":  await channelHistory(args._[1], args); break;
    case "send":     await sendMessage(args._[1], args._[2]); break;
    case "reply":    await replyMessage(args._[1], args._[2], args._[3]); break;
    case "search":   await searchMessages(args._[1], args); break;
    case "users":    await listUsers(); break;
    case "dm":       await directMessage(args._[1], args._[2]); break;
    case "upload":   await uploadFile(args._[1], args._[2]); break;
    default: console.error(`Unknown: ${cmd}`); process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
