---
name: voice
description: Text-to-speech, sound effects, and voice design using ElevenLabs API. Use when you need to generate audio from text, create sound effects, or design custom voices.
---

# Voice Tools

Voice synthesis via ElevenLabs API. Text-to-speech, sound effects, custom voice design.

## Setup

```bash
python3 {baseDir}/scripts/setup.py
```

Requires `ELEVEN_API_KEY` env var or run setup wizard to configure.

## Text-to-Speech

```bash
python3 {baseDir}/scripts/tts.py "Hello world"                          # Default voice (rachel)
python3 {baseDir}/scripts/tts.py "Hello world" --voice adam              # Specific voice
python3 {baseDir}/scripts/tts.py "Hello world" --voice george --lang en  # With language
python3 {baseDir}/scripts/tts.py "Hello world" --output greeting.mp3    # Save to file
python3 {baseDir}/scripts/tts.py "Hello world" --stream                 # Stream audio
```

### Available Voices

| Voice | Accent | Gender | Best For |
|-------|--------|--------|----------|
| rachel | US | female | Conversations, tutorials |
| adam | US | male | Documentaries, audiobooks |
| bella | US | female | Business, presentations |
| george | UK | male | Audiobooks, storytelling |
| alice | UK | female | Tutorials, explanations |
| matilda | US | female | Corporate, news |
| daniel | UK | male | News, announcements |
| river | US | neutral | Inclusive, informative |

Quick presets: `default` (rachel), `narrator` (adam), `professional` (matilda), `storyteller` (george), `educator` (alice).

See `{baseDir}/voices.json` for all 18 voices with IDs.

## Sound Effects

```bash
python3 {baseDir}/scripts/sfx.py "thunderstorm with heavy rain"
python3 {baseDir}/scripts/sfx.py "office keyboard typing" --duration 5
python3 {baseDir}/scripts/sfx.py "car engine starting" --output car.mp3
```

## Voice Design

Create custom voices from text descriptions:

```bash
python3 {baseDir}/scripts/voice-design.py "warm female narrator, British accent, 30s"
```

## When to Use

- Generate voiceover for videos or presentations
- Create sound effects for content
- Design custom voice personas
- Batch convert text to audio files
- Add audio to any workflow
