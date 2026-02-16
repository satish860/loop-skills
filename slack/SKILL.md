---
name: slack
description: Slack CLI for listing channels, reading messages, sending messages, replying in threads, searching, and managing users. Use when the user needs to interact with Slack.
---

# Slack

Slack operations via Slack Web API.

## Setup

```bash
cd {baseDir} && npm install
export SLACK_BOT_TOKEN=xoxb-your-token
```

Create a Slack app at https://api.slack.com/apps with Bot Token Scopes:
`channels:read`, `channels:history`, `chat:write`, `search:read`, `users:read`, `files:write`

## List Channels

```bash
node {baseDir}/slack.js channels
```

## Read Messages

```bash
node {baseDir}/slack.js history <channelId> --limit 20
```

## Send Message

```bash
node {baseDir}/slack.js send <channelId> "Hello team!"
node {baseDir}/slack.js send C01234ABCDE "Deploy complete ✅"
```

## Reply in Thread

```bash
node {baseDir}/slack.js reply <channelId> <threadTs> "Got it, thanks"
```

## Search

```bash
node {baseDir}/slack.js search "deployment issue" --limit 10
```

## List Users

```bash
node {baseDir}/slack.js users
```

## Direct Message

```bash
node {baseDir}/slack.js dm <userId> "Hey, quick question"
```

## Upload File

```bash
node {baseDir}/slack.js upload <channelId> ./report.pdf
```
