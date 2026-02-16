---
name: salesforce
description: Salesforce CLI for SOQL queries, SOSL search, CRUD operations on any object, and metadata inspection. Use when the user needs to interact with Salesforce CRM data.
---

# Salesforce

Salesforce operations via jsforce.

## Setup

```bash
cd {baseDir} && npm install
node {baseDir}/salesforce.js setup     # Interactive setup
```

Or set env vars:
```bash
export SF_USERNAME=user@company.com
export SF_PASSWORD=yourpassword
export SF_SECURITY_TOKEN=token         # append to password for API access
```

Or use access token directly:
```bash
export SF_INSTANCE_URL=https://your-instance.salesforce.com
export SF_ACCESS_TOKEN=your-token
```

## SOQL Query

```bash
node {baseDir}/salesforce.js query "SELECT Id, Name, Industry FROM Account LIMIT 10"
node {baseDir}/salesforce.js query "SELECT Id, Name, Amount, CloseDate FROM Opportunity WHERE StageName='Closed Won'"
node {baseDir}/salesforce.js query "SELECT Id, Subject, Status FROM Case WHERE Status='Open'"
```

## SOSL Search

```bash
node {baseDir}/salesforce.js search "FIND {Acme} IN ALL FIELDS RETURNING Account(Name), Contact(Name)"
```

## Describe Object

```bash
node {baseDir}/salesforce.js describe Account        # All fields + types
node {baseDir}/salesforce.js describe Opportunity
node {baseDir}/salesforce.js describe CustomObject__c
```

## Get Record

```bash
node {baseDir}/salesforce.js get Account 001XXXXXXXXXXXX
```

## Create Record

```bash
node {baseDir}/salesforce.js create Account --field "Name=Acme Corp" --field "Industry=Technology"
node {baseDir}/salesforce.js create Contact --field "FirstName=John" --field "LastName=Doe" --field "Email=john@acme.com"
```

## Update Record

```bash
node {baseDir}/salesforce.js update Account 001XXXXXXXXXXXX --field "Industry=Finance"
```

## List Objects

```bash
node {baseDir}/salesforce.js objects
```
