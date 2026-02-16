---
name: gdrive
description: Google Drive CLI for listing files, uploading, downloading, searching, and sharing. Supports multiple accounts. Use when the user needs to manage Google Drive files.
---

# Google Drive

Google Drive operations via [gdcli](https://github.com/badlogic/pi-skills/tree/main/gdcli) by Mario Zechner. Supports multiple accounts.

## Setup

```bash
npm install -g @mariozechner/gdcli
```

### First-time OAuth (same Google Cloud project as Gmail/Calendar)

1. `gdcli accounts list` — check existing accounts
2. If none: enable Drive API in your Google Cloud project
   - [Enable Drive API](https://console.cloud.google.com/apis/api/drive.googleapis.com)
3. `gdcli accounts credentials ~/path/to/credentials.json`
4. `gdcli accounts add user@gmail.com`

## List Files

```bash
gdcli user@gmail.com list                                # Root folder
gdcli user@gmail.com list --folder "Project Docs"        # Specific folder
gdcli user@gmail.com list --max 50
```

## Search Files

```bash
gdcli user@gmail.com search "quarterly report"
gdcli user@gmail.com search "name contains 'invoice'" --max 20
```

## Download

```bash
gdcli user@gmail.com download <fileId>
gdcli user@gmail.com download <fileId> --output ./local-file.pdf
```

## Upload

```bash
gdcli user@gmail.com upload ./report.pdf
gdcli user@gmail.com upload ./report.pdf --folder "Reports"
gdcli user@gmail.com upload ./report.pdf --name "Q1 Report 2026.pdf"
```

## Share

```bash
gdcli user@gmail.com share <fileId> --email "a@x.com" --role writer
gdcli user@gmail.com share <fileId> --email "b@x.com" --role reader
```

## Manage Accounts

```bash
gdcli accounts list
gdcli accounts add user@gmail.com
gdcli accounts remove user@gmail.com
```
