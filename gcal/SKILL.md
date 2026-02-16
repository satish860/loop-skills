---
name: gcal
description: Google Calendar CLI for listing events, creating events, checking availability, and managing calendars. Supports multiple accounts. Use when the user needs to check schedule, create meetings, or manage calendar events.
---

# Google Calendar

Google Calendar operations via [gccli](https://github.com/badlogic/pi-skills/tree/main/gccli) by Mario Zechner. Supports multiple accounts.

## Setup

```bash
npm install -g @mariozechner/gccli
```

### First-time OAuth (same as Gmail — shared Google Cloud project)

1. `gccli accounts list` — check existing accounts
2. If none: set up Google Cloud project with Calendar API enabled
   - [Enable Calendar API](https://console.cloud.google.com/apis/api/calendar-json.googleapis.com)
   - Use same OAuth Desktop client as Gmail
3. `gccli accounts credentials ~/path/to/credentials.json`
4. `gccli accounts add user@gmail.com`

## List Events

```bash
gccli user@gmail.com events                              # Today's events
gccli user@gmail.com events --from 2026-02-17 --to 2026-02-21   # Date range
gccli user@gmail.com events --max 20                     # More results
gccli user@gmail.com events --calendar "Work"            # Specific calendar
```

## Create Event

```bash
gccli user@gmail.com create --title "Team Standup" --start "2026-02-17T10:00" --end "2026-02-17T10:30"
gccli user@gmail.com create --title "Lunch" --start "2026-02-17T12:00" --end "2026-02-17T13:00" --location "Cafe"
gccli user@gmail.com create --title "Review" --start "2026-02-17T14:00" --end "2026-02-17T15:00" --attendees "a@x.com,b@x.com"
```

## Check Availability

```bash
gccli user@gmail.com freebusy --start "2026-02-17T09:00" --end "2026-02-17T17:00"
gccli user@gmail.com freebusy --start "2026-02-17T09:00" --end "2026-02-17T17:00" --attendees "a@x.com"
```

## List Calendars

```bash
gccli user@gmail.com calendars
```

## Manage Accounts

```bash
gccli accounts list
gccli accounts add user@gmail.com
gccli accounts remove user@gmail.com
```
