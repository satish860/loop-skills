---
name: dynamics
description: Microsoft Dynamics 365 CLI for OData queries, CRUD operations on any entity, and metadata inspection via Dataverse Web API. Use when the user needs to interact with Dynamics 365 CRM data.
---

# Microsoft Dynamics 365

Dynamics 365 operations via Dataverse Web API.

## Setup

```bash
cd {baseDir} && npm install
node {baseDir}/dynamics.js setup     # Interactive — needs org URL + Azure AD app
node {baseDir}/dynamics.js auth      # Authenticate (device code flow)
```

Azure AD app needs `Dynamics CRM → user_impersonation` permission.

## OData Query

```bash
node {baseDir}/dynamics.js query "accounts?\$select=name,revenue&\$top=10"
node {baseDir}/dynamics.js query "contacts?\$filter=emailaddress1 ne null&\$top=20"
node {baseDir}/dynamics.js query "opportunities?\$filter=statecode eq 0&\$select=name,estimatedvalue"
```

## Get Record

```bash
node {baseDir}/dynamics.js get accounts <recordId>
```

## Create Record

```bash
node {baseDir}/dynamics.js create accounts --field "name=Acme Corp" --field "revenue=5000000"
node {baseDir}/dynamics.js create contacts --field "firstname=John" --field "lastname=Doe" --field "emailaddress1=john@acme.com"
```

## Update Record

```bash
node {baseDir}/dynamics.js update accounts <recordId> --field "revenue=6000000"
```

## Delete Record

```bash
node {baseDir}/dynamics.js delete accounts <recordId>
```

## List Entities

```bash
node {baseDir}/dynamics.js entities
```

## Entity Metadata

```bash
node {baseDir}/dynamics.js metadata account
node {baseDir}/dynamics.js metadata opportunity
node {baseDir}/dynamics.js metadata my_custom_entity
```
