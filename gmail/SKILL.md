---
name: gmail
description: Gmail CLI for searching emails, reading threads, sending messages, managing drafts, labels, and attachments. Use when the user needs to search, read, send, or manage Gmail emails.
---

# Gmail

Command-line Gmail operations via [gmcli](https://github.com/badlogic/pi-skills/tree/main/gmcli) by Mario Zechner.

## Setup

```bash
npm install -g @mariozechner/gmcli
```

### First-time OAuth setup

1. Check existing accounts: `gmcli accounts list`
2. If none configured, user needs a Google Cloud project:
   - [Create project](https://console.cloud.google.com/projectcreate)
   - [Enable Gmail API](https://console.cloud.google.com/apis/api/gmail.googleapis.com)
   - [Set app name](https://console.cloud.google.com/auth/branding)
   - [Add test users](https://console.cloud.google.com/auth/audience)
   - [Create OAuth Desktop client](https://console.cloud.google.com/auth/clients) → download JSON
3. Set credentials: `gmcli accounts credentials ~/path/to/credentials.json`
4. Add account: `gmcli accounts add user@gmail.com`

## Search Emails

```bash
gmcli user@gmail.com search "in:inbox is:unread"
gmcli user@gmail.com search "from:boss@company.com" --max 20
gmcli user@gmail.com search "subject:invoice after:2025/01/01"
gmcli user@gmail.com search "has:attachment filename:pdf"
```

Query syntax: `in:inbox`, `in:sent`, `is:unread`, `is:starred`, `from:`, `to:`, `subject:`, `has:attachment`, `filename:`, `after:YYYY/MM/DD`, `before:YYYY/MM/DD`, `label:Name`. Combine freely.

## Read a Thread

```bash
gmcli user@gmail.com thread <threadId>
gmcli user@gmail.com thread <threadId> --download    # save attachments
```

## Send Email

```bash
gmcli user@gmail.com send --to "a@x.com" --subject "Hello" --body "Message here"
gmcli user@gmail.com send --to "a@x.com" --cc "b@x.com" --subject "Hello" --body "Message" --attach file.pdf
```

## Reply

```bash
gmcli user@gmail.com send --to "a@x.com" --subject "Re: Topic" --body "Reply text" --reply-to <messageId>
```

## Drafts

```bash
gmcli user@gmail.com drafts list
gmcli user@gmail.com drafts get <draftId>
gmcli user@gmail.com drafts create --to "a@x.com" --subject "Draft" --body "Content"
gmcli user@gmail.com drafts send <draftId>
gmcli user@gmail.com drafts delete <draftId>
```

## Labels

```bash
gmcli user@gmail.com labels list
gmcli user@gmail.com labels <threadId> --add Work --remove UNREAD
```

System labels: INBOX, UNREAD, STARRED, IMPORTANT, TRASH, SPAM.

## Get Gmail URL

```bash
gmcli user@gmail.com url <threadId>
```

## Data Storage

- `~/.gmcli/credentials.json` — OAuth client credentials
- `~/.gmcli/accounts.json` — Account tokens
- `~/.gmcli/attachments/` — Downloaded attachments
