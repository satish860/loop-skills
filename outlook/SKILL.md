---
name: outlook
description: Outlook/Microsoft 365 email via Microsoft Graph API. Supports multiple accounts. Search, read, send, reply, and manage emails. Use when the user needs to interact with Outlook or Microsoft 365 email.
---

# Outlook Email

Outlook/Microsoft 365 email operations via Microsoft Graph API. Supports multiple accounts.

## Setup

```bash
cd {baseDir} && npm install
```

### Azure AD app registration (one-time, shared across accounts)

1. Go to [Azure AD App Registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps)
2. New registration → Name: "outlook-cli" → Supported account types: Personal + org
3. Platform: Mobile and desktop → Redirect URI: `http://localhost`
4. API permissions → Add: `Mail.Read`, `Mail.Send`, `Mail.ReadWrite`, `User.Read`
5. Create JSON file: `{ "clientId": "your-app-id", "tenantId": "common" }`
6. Set credentials: `node {baseDir}/outlook.js accounts credentials ~/creds.json`

### Add accounts

```bash
node {baseDir}/outlook.js accounts add satish@deltaxy.ai
node {baseDir}/outlook.js accounts add john@company.com
node {baseDir}/outlook.js accounts list
```

## List Recent Emails

```bash
node {baseDir}/outlook.js satish@deltaxy.ai list
node {baseDir}/outlook.js satish@deltaxy.ai list --folder inbox --top 20
node {baseDir}/outlook.js john@company.com list --folder sentitems
```

## Search Emails

```bash
node {baseDir}/outlook.js satish@deltaxy.ai search "subject:invoice"
node {baseDir}/outlook.js john@company.com search "from:boss@company.com" --top 20
```

## Read an Email

```bash
node {baseDir}/outlook.js satish@deltaxy.ai read <messageId>
```

## Send Email

```bash
node {baseDir}/outlook.js satish@deltaxy.ai send --to "a@x.com" --subject "Hello" --body "Message"
node {baseDir}/outlook.js satish@deltaxy.ai send --to "a@x.com" --cc "b@x.com" --subject "Hi" --body "Msg"
```

## Reply to Email

```bash
node {baseDir}/outlook.js satish@deltaxy.ai reply <messageId> --body "Thanks"
```

## List Folders

```bash
node {baseDir}/outlook.js satish@deltaxy.ai folders
```

## Manage Accounts

```bash
node {baseDir}/outlook.js accounts list                        # List all accounts
node {baseDir}/outlook.js accounts add <email>                 # Add (device code auth)
node {baseDir}/outlook.js accounts remove <email>              # Remove account
node {baseDir}/outlook.js accounts credentials <file.json>     # Set Azure AD credentials
```

## Data Storage

- `~/.outlook-cli/credentials.json` — Azure AD app credentials (shared)
- `~/.outlook-cli/accounts.json` — Per-account tokens
