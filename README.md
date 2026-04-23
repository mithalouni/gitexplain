# GitExplain — narrated code lessons

GitExplain explains your codebase with voice, diagrams, and code, so you actually understand what you vibe-coded a week ago. It's an MCP server you install into Kiro. Ask your agent to explain any repo or flow, and it generates a slide-video lesson powered by ElevenLabs text-to-speech. Built with Kiro's spec-driven workflow across 20 purpose-designed slide templates, runs locally, open source, your code never leaves your machine.

## Install

```bash
npm install
```

Requires Node **20+**.

## Run

You need an ElevenLabs API key. Get one at https://elevenlabs.io.

```bash
export ELEVENLABS_API_KEY=sk_...
npm run sample
```

Open the `http://localhost:4178/view/...` URL printed in the terminal. Press **Start lesson**.

### Environment

| Var | Default | Purpose |
| --- | --- | --- |
| `ELEVENLABS_API_KEY` | — (required) | ElevenLabs key |
| `ELEVENLABS_VOICE_ID` | `21m00Tcm4TlvDq8ikWAM` (Rachel) | any voice from your ElevenLabs library |
| `ELEVENLABS_OUTPUT_FORMAT` | `mp3_44100_64` | smaller = faster time-to-first-byte |
| `PORT` | `4178` | server port |

## Authoring a lesson

A lesson is JSON with a `title` and a `slides` array. Each slide has a `type`, a `narration` string (what the voice says), and a `data` object specific to the type.

```json
{
  "title": "How hooks work",
  "voiceId": "21m00Tcm4TlvDq8ikWAM",
  "slides": [
    { "type": "title", "narration": "...", "data": { "title": "..." } }
  ]
}
```

POST it to the server:

```bash
curl -sX POST http://localhost:4178/api/lessons \
  -H 'content-type: application/json' \
  -d @my-lesson.json
# → {"id":"abc123","url":"/view/abc123"}
```

Then open `http://localhost:4178/view/abc123`.

## The 20 slide types

Pick the type that matches the point you want to make. Each type has a small JSON shape.

| # | Type | Use for |
| - | - | - |
| 1 | `title` | intro, section headers |
| 2 | `bullets` | short lists (`style`: `dot` \| `check` \| `number`) |
| 3 | `code` | one code block, with `highlight` line numbers |
| 4 | `codeCompare` | before/after, bad/good, old/new code |
| 5 | `fileTree` | directory layout, which files to look at |
| 6 | `flowDiagram` | nodes + edges, LR or TB direction |
| 7 | `sequenceDiagram` | actor interactions over time |
| 8 | `architecture` | layers with boxes (client / server / db) |
| 9 | `callout` | key insight card (`kind`: info / tip / warning / success) |
| 10 | `definition` | a term + a crisp definition |
| 11 | `twoColumn` | compare two ideas side by side |
| 12 | `stats` | a few big numbers with labels |
| 13 | `terminal` | a shell command + output |
| 14 | `steps` | numbered recipe |
| 15 | `timeline` | events with timestamps |
| 16 | `warning` | list of pitfalls |
| 17 | `quiz` | question + choices, one marked correct |
| 18 | `summary` | recap at the end |
| 19 | `image` | an image URL (any `src`, including `data:`) |
| 20 | `comparison` | table: rows × two labeled columns |

Shapes are documented inline in [`public/player.js`](public/player.js) (each renderer's JSX makes the fields obvious) and fully exercised in [`sample-lesson.json`](sample-lesson.json).

## How it streams

1. Browser requests slide 0's audio: `GET /audio/:id/0.mp3`
2. Server streams `POST /v1/text-to-speech/{voice}/stream?output_format=mp3_44100_64` from ElevenLabs with `model_id: eleven_flash_v2_5`.
3. Response is teed — streamed to the browser **and** cached in memory.
4. As the first slide plays, the player prefetches slide 1 and 2 in the background.
5. When slide 0's audio ends, slide 1 is already cached → instant.

Flash v2.5 is the fastest ElevenLabs model (≈75 ms server-side time-to-first-byte). Combined with the smaller `mp3_44100_64` format and background prefetch, slide transitions feel instant after the first one.

## Keyboard

- `Space` — play/pause
- `←` / `→` — prev / next slide
- `R` — restart
- `C` — toggle captions
- `Esc` — pause

## MCP server

`gitexplain-mcp` is the MCP binary. It spawns the local server on a free port and exposes one tool:

```
create_lesson(title: string, slides: Slide[]) → { url: string }
```

Plus one prompt `slide_types_guide` that gives the agent the full schema reference for all 20 slide types. There is intentionally **no** `set_api_key` tool — the key is entered out-of-band via the browser form at `/setup`, so no secret ever transits the chat transcript.

### Install into Kiro

Paste into Kiro → Settings → MCP servers:

```json
{
  "mcpServers": {
    "gitexplain": {
      "command": "npx",
      "args": ["-y", "gitexplain-mcp"]
    }
  }
}
```

### Install into Claude Code

```bash
claude mcp add gitexplain -- npx -y gitexplain-mcp
```

### Install into Cursor / Windsurf

Add to the client's MCP config:

```json
{
  "mcpServers": {
    "gitexplain": {
      "command": "npx",
      "args": ["-y", "gitexplain-mcp"]
    }
  }
}
```

No API key config needed. The first time the agent makes a lesson, the tool returns a **setup URL** (e.g. `http://localhost:PORT/setup?return=/view/...`) alongside the lesson link. Open that URL in your browser, paste your ElevenLabs key into the form (get one free at https://elevenlabs.io/app/settings/api-keys), click **Save**, and the page redirects you to the lesson with narration working. The key is validated against ElevenLabs and saved to `~/.gitexplain/config.json` (0600 perms) — you only paste it once, ever.

The key never touches the chat, so strict clients like Codex won't block the flow. The agent just relays the URL; you paste in the browser.

After the first setup, the agent can say "explain this codebase" and will emit a `create_lesson` call; the tool returns a `http://localhost:.../view/...` URL to open directly.

### Local build

```bash
npm install
npm run build    # compiles mcp/src/index.ts → mcp/dist/index.js
npm run mcp      # runs the MCP on stdio (for debugging)
```

## License

MIT
