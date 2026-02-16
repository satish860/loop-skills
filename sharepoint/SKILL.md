---
name: sharepoint
description: SharePoint CLI for listing sites, browsing document libraries, uploading/downloading files, and searching. Shares auth with outlook skill. Use when the user needs to interact with SharePoint.
---

# SharePoint

SharePoint operations via Microsoft Graph API. Shares Azure AD auth with outlook skill.

## Setup

```bash
cd {baseDir} && npm install
```

Uses same Azure AD credentials as outlook (`~/.outlook-cli/credentials.json`).
Add these API permissions to your Azure AD app: `Sites.Read.All`, `Sites.ReadWrite.All`, `Files.ReadWrite.All`

First run will trigger device code auth for SharePoint permissions.

## List Sites

```bash
node {baseDir}/sharepoint.js sites
node {baseDir}/sharepoint.js search "project"
```

## Browse Document Libraries

```bash
node {baseDir}/sharepoint.js lists <siteId>                    # List libraries/drives
node {baseDir}/sharepoint.js files <siteId>                    # Root files (default drive)
node {baseDir}/sharepoint.js files <siteId> <driveId>          # Specific drive
node {baseDir}/sharepoint.js files <siteId> <driveId> --path /Documents/Reports
```

## Download File

```bash
node {baseDir}/sharepoint.js read <siteId> <driveId> <itemId>              # Metadata
node {baseDir}/sharepoint.js download <siteId> <driveId> <itemId>          # Download
node {baseDir}/sharepoint.js download <siteId> <driveId> <itemId> --output report.pdf
```

## Upload File

```bash
node {baseDir}/sharepoint.js upload <siteId> <driveId> ./report.pdf
node {baseDir}/sharepoint.js upload <siteId> <driveId> ./report.pdf --path /Documents/Reports
```
