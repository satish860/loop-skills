---
name: outlook
description: Outlook/Microsoft 365 email via Microsoft Graph API. Search, read, send, reply, and manage emails. Use when the user needs to interact with Outlook or Microsoft 365 email.
---

# Outlook Email

Outlook/Microsoft 365 email operations via Microsoft Graph API.

## Setup

```bash
cd {baseDir} && npm install
node {baseDir}/outlook.js setup     # Configure Azure AD credentials
node {baseDir}/outlook.js auth      # Authenticate (device code flow)
```

### Azure AD app registration (one-time)

1. Go to [Azure AD App Registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps)
2. New registration → Name: "outlook-cli" → Supported account types: Personal + org
3. Platform: Mobile and desktop → Redirect URI: `http://localhost`
4. API permissions → Add: `Mail.Read`, `Mail.Send`, `Mail.ReadWrite`, `User.Read`
5. Copy the Application (client) ID → use in `setup`

## List Recent Emails

```bash
node {baseDir}/outlook.js list                       # inbox, 10 most recent
node {baseDir}/outlook.js list --folder inbox --top 20
node {baseDir}/outlook.js list --folder sentitems
```

## Search Emails

```bash
node {baseDir}/outlook.js search "subject:invoice"
node {baseDir}/outlook.js search "from:boss@company.com" --top 20
node {baseDir}/outlook.js search "hasAttachments:true"
```

## Read an Email

```bash
node {baseDir}/outlook.js read <messageId>
```

Shows: from, to, cc, date, subject, body (plain text), attachments.

## Send Email

```bash
node {baseDir}/outlook.js send --to "a@x.com" --subject "Hello" --body "Message"
node {baseDir}/outlook.js send --to "a@x.com" --cc "b@x.com" --subject "Hi" --body "Message"
```

## Reply to Email

```bash
node {baseDir}/outlook.js reply <messageId> --body "Thanks for the update"
```

## List Folders

```bash
node {baseDir}/outlook.js folders
```

## Data Storage

- `~/.outlook-cli/config.json` — Azure AD app credentials (client ID, tenant ID)
- `~/.outlook-cli/token.json` — Access token (auto-refreshed)
