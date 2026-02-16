# loop-skills

Skills for [pi-coding-agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent), compatible with Claude Code, Codex CLI, Amp, and Droid.

Built by [DeltaXY](https://deltaxy.ai) for Loop Server agents and general-purpose AI coding.

## Installation

### pi-coding-agent

```bash
# User-level (available in all projects)
git clone https://github.com/deltaxy/loop-skills ~/.pi/agent/skills/loop-skills

# Or project-level
git clone https://github.com/deltaxy/loop-skills .pi/skills/loop-skills
```

### Claude Code

```bash
git clone https://github.com/deltaxy/loop-skills ~/loop-skills
mkdir -p ~/.claude/skills
ln -s ~/loop-skills/web ~/.claude/skills/web
ln -s ~/loop-skills/browser ~/.claude/skills/browser
ln -s ~/loop-skills/voice ~/.claude/skills/voice
```

### Codex CLI

```bash
git clone https://github.com/deltaxy/loop-skills ~/.codex/skills/loop-skills
```

## Available Skills

| Skill | Description | Scripts |
|-------|-------------|---------|
| **web** | Web search, content extraction, entity discovery, and monitoring via Parallel AI | `search.js`, `extract.js`, `findall.js`, `monitor.js` |
| **browser** | Browser automation via [@playwright/cli](https://github.com/microsoft/playwright-cli) — 50+ commands, element refs, sessions, network mocking | `playwright-cli` (global install) |
| **voice** | Text-to-speech, sound effects, and voice design via ElevenLabs | `tts.py`, `sfx.py`, `voice-design.py` |
| **firecrawl** | Web crawling, scraping, and structured extraction via Firecrawl API | `search.py`, `scrape.py`, `crawl.py` |

## Design Principles

Following [Mario Zechner's](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/) skill philosophy:

1. **One skill = one domain, multiple scripts.** Not one script per capability.
2. **CLI over MCP.** Progressive disclosure — agent reads SKILL.md only when needed (~200 tokens), not 13K tokens dumped into every session.
3. **Composable.** Pipe outputs, chain commands. `search.js "topic" | extract.js --full`
4. **Self-contained.** Each skill has its own dependencies. `npm install` in the skill folder.
5. **Agent-readable.** SKILL.md is the only file the agent needs to read. Everything else is implementation.

## License

MIT
