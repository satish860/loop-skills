---
name: browser
description: Open URLs in a real browser, interact with web pages, take screenshots, and automate browser tasks using Playwright. Use when the user wants to open a website, click buttons, fill forms, take screenshots, or do any browser automation.
---

# Browser Tools

Browser automation via Playwright. Opens real browsers, takes screenshots, records actions.

## Setup

```bash
cd {baseDir} && npm install
npx playwright install chromium
```

## Quick Commands

```bash
npx playwright open "https://example.com"              # Open URL (visible)
npx playwright cr "https://example.com"                 # Chromium
npx playwright ff "https://example.com"                 # Firefox
npx playwright screenshot "https://example.com" out.png # Screenshot
npx playwright pdf "https://example.com" out.pdf        # Save as PDF
npx playwright codegen "https://example.com"            # Record actions as code
```

## Multi-Step Automation

For complex flows (fill forms, navigate, click through pages), create and run a script:

```bash
node {baseDir}/run.js <script-description>
```

Scripts use `headless: false` so the user can see the browser.

## Rules

- Always use `headless: false` — user must SEE the browser
- For checkout/payment: automate UP TO payment, then STOP
- Never enter payment details or passwords automatically
- Leave browser open for user to take over
