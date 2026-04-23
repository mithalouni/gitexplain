#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_JS = path.resolve(__dirname, '..', '..', 'server.js');
const SERVER_INSTRUCTIONS = `GitExplain lets you create a narrated slide-video lesson that explains code or concepts to a user.

Use create_lesson when the user asks to "explain", "walk me through", "teach me", or "make a lesson about" code or a concept. Especially good for: explaining an unfamiliar codebase, onboarding, teaching a framework concept visually, or turning a long technical answer into a scannable video.

=== FIRST-RUN SETUP (never ask for the API key in chat) ===
If the create_lesson response includes a setup URL, tell the user to open that URL in their browser and paste their key into the form. The key never enters the chat. After they save, they're redirected to the lesson. Do NOT ask them to paste the key to you — strict clients like Codex will block the conversation if a secret appears in chat.

=== SLIDE COUNT ===
- Default: 6 slides. Acceptable range: 4-10. Hard max: 14.
- Simple topic (single function, one concept): 4-5 slides.
- Medium topic (feature walkthrough): 6-8 slides.
- Big topic (whole codebase): 9-12 slides. Only go bigger if the user explicitly asks.
- First slide MUST be type "title". Last slide MUST be type "summary".

=== NARRATION STYLE ===
- 1-3 sentences per slide. Hard max: 500 characters.
- Conversational — talk to the user as a peer. No "as you can see", "in this slide", "let's take a look at".
- The narration should REINFORCE what's on screen with insight or context, not just read it aloud.
- Match pacing: a code slide gets "Notice how X — that's what makes Y work", not a line-by-line read.

=== VISUAL COMPOSITION RULES ===
- MIX slide types — never 3+ of the same type in a row. Alternate text, code, diagrams, callouts.
- flowDiagram: MAX 8 nodes, ideally 4-6. Labels under 36 chars. If the flow has more steps, split into two slides or use "steps" instead.
- architecture: 2-4 layers, each with 2-5 nodes. Keep node labels short (2-5 words).
- fileTree: keep to 6-12 entries. Use depth:0 for root, depth:1 for children, etc — FLAT array, no nesting.
- comparison: 3-6 rows. Label column + 2 value columns.
- code: under 15 lines per block. Highlight 1-3 key lines.
- bullets: 3-6 items, each under 80 chars.

=== SCHEMA — EVERY SLIDE MUST MATCH THESE EXACT FIELD NAMES ===
The server validates field names and rejects mismatches. Field names are case-sensitive. The most common agent mistakes are marked [COMMON MISTAKE].

Every slide: { type, narration, data }

1. title — data: { title: string, subtitle?: string }
   [COMMON MISTAKE] Do NOT add "bullets" — title has no bullet list.

2. bullets — data: { heading?: string, style?: "dot"|"check"|"number", items: string[] }

3. code — data: { heading?: string, caption?: string, language: string, code: string, highlight?: number[] }

4. codeCompare — data: { leftLabel?: string, leftKind?: "bad"|"good", leftLanguage?: string, leftCode: string, rightLabel?: string, rightKind?: "bad"|"good", rightLanguage?: string, rightCode: string }

5. fileTree — data: { heading?: string, entries: Array<{ name: string, depth?: number, kind?: "dir"|"file", highlight?: boolean, dim?: boolean, note?: string }> }
   [COMMON MISTAKE] entries is a FLAT array. Do NOT nest with "children". Use depth:0 for root, depth:1 for one-indent, etc. Example: [{name:"src/", depth:0, kind:"dir"}, {name:"app/", depth:1, kind:"dir"}, {name:"page.tsx", depth:2}]

6. flowDiagram — data: { heading?: string, direction?: "LR"|"TB", nodes: Array<{ id: string, label: string }>, edges: Array<{ from: string, to: string, label?: string }> }
   [COMMON MISTAKE] Use "heading" NOT "title". Max 8 nodes.

7. sequenceDiagram — data: { heading?: string, actors: string[], messages: Array<{ from: string, to: string, text: string }> }

8. architecture — data: { heading?: string, layers: Array<{ name: string, nodes: string[] }> }
   [COMMON MISTAKE] Each layer uses "nodes" (array of strings), NOT "items". Use "heading" NOT "title". Empty nodes arrays render as empty boxes.

9. callout — data: { kind?: "info"|"tip"|"warning"|"success", title: string, body: string }

10. definition — data: { term: string, definition: string, also?: string }

11. twoColumn — data: { leftHeading: string, leftBody: string, rightHeading: string, rightBody: string }

12. stats — data: { heading?: string, items: Array<{ value: string, label: string }> }

13. terminal — data: { prompt?: string, command: string, output?: string[] }

14. steps — data: { heading?: string, steps: Array<{ title: string, detail?: string }> }
   [COMMON MISTAKE] Use "detail" NOT "description". Use "heading" NOT "title" at the top level.

15. timeline — data: { heading?: string, events: Array<{ time: string, event: string }> }

16. warning — data: { title?: string, pitfalls: string[] }

17. quiz — data: { question: string, choices: string[], answerIndex: number, explanation?: string }

18. summary — data: { heading?: string, points: string[] }
   [COMMON MISTAKE] Use "points" NOT "bullets". Use "heading" NOT "title".

19. image — data: { url: string, alt?: string, caption?: string }

20. comparison — data: { heading?: string, leftLabel: string, rightLabel: string, rows: Array<{ label: string, left: string, right: string }> }
   [COMMON MISTAKE] Use "leftLabel"/"rightLabel" NOT "leftTitle"/"rightTitle". Use "heading" NOT "title".

=== IF THE TOOL RETURNS A VALIDATION ERROR ===
The error says exactly which field is wrong. Fix that field and call create_lesson again. Do NOT give up or ask the user — the fix is almost always renaming a field name.

=== ON SUCCESS ===
Tell the user to click the returned URL. The lesson plays in their browser with synced narration streamed from ElevenLabs.`;
const SLIDE_TYPES_GUIDE = `# GitExplain slide types — schema reference

Every slide has this shape:
\`\`\`
{ "type": "<one of below>", "narration": "voice-over text", "data": { ...type-specific } }
\`\`\`

## 1. title
Use for the opening slide only.
\`data: { title: string, subtitle?: string }\`

## 2. bullets
A list. Pick style based on content.
\`data: { heading?: string, style?: "dot"|"check"|"number", items: string[] }\`

## 3. code
Syntax-highlighted code block. Highlight is 1-indexed line numbers.
\`data: { heading?: string, caption?: string, language: string, code: string, highlight?: number[] }\`

## 4. codeCompare
Side-by-side before/after.
\`data: { leftLabel?, leftKind?: "bad"|"good", leftLanguage?, leftCode, rightLabel?, rightKind?, rightLanguage?, rightCode }\`

## 5. fileTree
Directory tree. depth is 0-based indent. kind "dir" shows folder icon.
\`data: { heading?, entries: [{ name, depth?: number, kind?: "dir"|"file", highlight?: boolean, dim?: boolean, note?: string }] }\`

## 6. flowDiagram
Node-edge diagram. direction LR (default) or TB.
\`data: { heading?, direction?: "LR"|"TB", nodes: [{ id, label }], edges: [{ from, to, label? }] }\`

## 7. sequenceDiagram
Actor interactions, top-down.
\`data: { heading?, actors: string[], messages: [{ from, to, text }] }\`

## 8. architecture
Stacked layers with labeled nodes.
\`data: { heading?, layers: [{ name, nodes: string[] }] }\`

## 9. callout
Highlighted fact or insight.
\`data: { kind?: "info"|"tip"|"warning"|"success", title, body }\`

## 10. definition
One-term glossary.
\`data: { term, definition, also?: string }\`

## 11. twoColumn
Two parallel ideas.
\`data: { leftHeading, leftBody, rightHeading, rightBody }\`

## 12. stats
Headline numbers.
\`data: { heading?, items: [{ value: string, label: string }] }\`

## 13. terminal
Command + output mock.
\`data: { prompt?: string, command: string, output?: string[] }\`

## 14. steps
Ordered numbered procedure.
\`data: { heading?, steps: [{ title, detail?: string }] }\`

## 15. timeline
Chronological events.
\`data: { heading?, events: [{ time: string, event: string }] }\`

## 16. warning
Pitfalls list.
\`data: { title?, pitfalls: string[] }\`

## 17. quiz
Multiple choice check. answerIndex is 0-based.
\`data: { question, choices: string[], answerIndex: number, explanation?: string }\`

## 18. summary
Closing takeaway list. Use as last slide.
\`data: { heading?, points: string[] }\`

## 19. image
Image slide. url can be a data URI.
\`data: { url: string, alt?: string, caption?: string }\`

## 20. comparison
Multi-row comparison table.
\`data: { heading?, leftLabel, rightLabel, rows: [{ label, left, right }] }\`

# Composition tips
- Sequence diagrams shine for "what happens when X". Flow diagrams for data transformations.
- code slides: keep under ~15 lines. Highlight 1-3 key lines.
- Architecture is great for explaining a 3-layer system (frontend/backend/external services).
- codeCompare turns "old way vs new way" into the punchline.`;
let serverProc = null;
let baseUrl = null;
function startServer() {
    return new Promise((resolve, reject) => {
        const proc = spawn(process.execPath, [SERVER_JS], {
            env: { ...process.env, PORT: '0' },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        serverProc = proc;
        let settled = false;
        const done = (err, url) => {
            if (settled)
                return;
            settled = true;
            if (err)
                reject(err);
            else
                resolve(url);
        };
        proc.stdout.on('data', (chunk) => {
            const s = chunk.toString();
            process.stderr.write(`[gitexplain-server] ${s}`);
            const m = s.match(/http:\/\/localhost:(\d+)/);
            if (m)
                done(null, `http://localhost:${m[1]}`);
        });
        proc.stderr.on('data', (chunk) => {
            process.stderr.write(`[gitexplain-server] ${chunk.toString()}`);
        });
        proc.on('exit', (code) => {
            serverProc = null;
            baseUrl = null;
            done(new Error(`GitExplain server exited with code ${code} before ready`));
        });
        setTimeout(() => done(new Error('GitExplain server did not start within 8s')), 8000);
    });
}
async function hasKey() {
    if (!baseUrl)
        return false;
    try {
        const r = await fetch(`${baseUrl}/api/key-status`);
        if (!r.ok)
            return false;
        const body = (await r.json());
        return !!body.hasKey;
    }
    catch {
        return false;
    }
}
async function createLesson(args) {
    if (!baseUrl)
        throw new Error('GitExplain server not ready');
    const res = await fetch(`${baseUrl}/api/lessons`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(args),
    });
    if (!res.ok) {
        const detail = await res.text();
        throw new Error(`GitExplain server ${res.status}: ${detail}`);
    }
    const body = (await res.json());
    return { viewUrl: `${baseUrl}/view/${body.id}`, lessonId: body.id };
}
const mcp = new Server({ name: 'gitexplain', version: '0.2.0' }, {
    capabilities: { tools: {}, prompts: {} },
    instructions: SERVER_INSTRUCTIONS,
});
mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: 'create_lesson',
            description: 'Create a narrated slide-video lesson that plays in the browser with synced ElevenLabs voice. Use when the user asks to "explain", "walk through", "teach", or "make a lesson about" code or a concept. ' +
                'SLIDE COUNT: default 6, range 4-10, hard max 14. First slide must be type "title", last must be "summary". Mix types — never 3+ of the same type in a row. ' +
                'NARRATION: 1-3 sentences per slide (max 500 chars), conversational, no "as you can see". ' +
                'SCHEMA (field names are exact, case-sensitive — the server rejects mismatches with an error). Each slide = { type, narration, data }. data shapes:\n' +
                '• title: { title, subtitle? }\n' +
                '• bullets: { heading?, style?: "dot"|"check"|"number", items: string[] }\n' +
                '• code: { heading?, caption?, language, code, highlight?: number[] }\n' +
                '• codeCompare: { leftLabel?, leftKind?: "bad"|"good", leftLanguage?, leftCode, rightLabel?, rightKind?, rightLanguage?, rightCode }\n' +
                '• fileTree: { heading?, entries: [{ name, depth?, kind?: "dir"|"file", highlight?, dim?, note? }] } — FLAT array, no nested "children". depth: 0=root, 1=one indent.\n' +
                '• flowDiagram: { heading?, direction?: "LR"|"TB", nodes: [{ id, label }], edges: [{ from, to, label? }] } — max 8 nodes, labels under 36 chars. Use "heading" not "title".\n' +
                '• sequenceDiagram: { heading?, actors: string[], messages: [{ from, to, text }] }\n' +
                '• architecture: { heading?, layers: [{ name, nodes: string[] }] } — use "nodes" NOT "items". 2-4 layers, 2-5 nodes each. Use "heading" not "title".\n' +
                '• callout: { kind?: "info"|"tip"|"warning"|"success", title, body }\n' +
                '• definition: { term, definition, also? }\n' +
                '• twoColumn: { leftHeading, leftBody, rightHeading, rightBody }\n' +
                '• stats: { heading?, items: [{ value, label }] }\n' +
                '• terminal: { prompt?, command, output?: string[] }\n' +
                '• steps: { heading?, steps: [{ title, detail? }] } — use "detail" NOT "description". Use "heading" NOT "title" at top.\n' +
                '• timeline: { heading?, events: [{ time, event }] }\n' +
                '• warning: { title?, pitfalls: string[] }\n' +
                '• quiz: { question, choices: string[], answerIndex: number, explanation? }\n' +
                '• summary: { heading?, points: string[] } — use "points" NOT "bullets". Use "heading" NOT "title".\n' +
                '• image: { url, alt?, caption? }\n' +
                '• comparison: { heading?, leftLabel, rightLabel, rows: [{ label, left, right }] } — use "leftLabel"/"rightLabel" NOT "leftTitle"/"rightTitle". 3-6 rows.\n\n' +
                'If the tool returns a validation error, the message names the exact field to fix — rename it and retry. If no ElevenLabs key is saved, the response includes a setup URL — tell the user to open it in the browser (do NOT ask for the key in chat).',
            inputSchema: {
                type: 'object',
                properties: {
                    title: {
                        type: 'string',
                        description: 'The lesson title shown on the player start screen. Keep it short (under 40 chars).',
                    },
                    slides: {
                        type: 'array',
                        minItems: 1,
                        description: 'Ordered array of slide objects. Each slide has { type, narration, data }. Start with a "title" slide and end with a "summary" slide. See the slide_types_guide prompt for the exact data schema per type.',
                        items: {
                            type: 'object',
                            required: ['type', 'narration', 'data'],
                            properties: {
                                type: {
                                    type: 'string',
                                    description: 'One of: title, bullets, code, codeCompare, fileTree, flowDiagram, sequenceDiagram, architecture, callout, definition, twoColumn, stats, terminal, steps, timeline, warning, quiz, summary, image, comparison.',
                                },
                                narration: {
                                    type: 'string',
                                    description: 'Voice-over text spoken by ElevenLabs. Conversational, 1-3 sentences. Reinforces the visual — do not just read it aloud.',
                                },
                                data: {
                                    type: 'object',
                                    description: 'Type-specific data. See slide_types_guide prompt for the schema of each slide type.',
                                },
                            },
                        },
                    },
                },
                required: ['title', 'slides'],
            },
        },
    ],
}));
mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (req.params.name !== 'create_lesson') {
        throw new Error(`Unknown tool: ${req.params.name}`);
    }
    const args = req.params.arguments;
    if (!args || !Array.isArray(args.slides) || args.slides.length === 0) {
        return {
            isError: true,
            content: [{ type: 'text', text: 'create_lesson requires { title, slides: [...] } with at least one slide.' }],
        };
    }
    try {
        const { viewUrl, lessonId } = await createLesson(args);
        const keySet = await hasKey();
        if (!keySet) {
            const setupUrl = `${baseUrl}/setup?return=${encodeURIComponent(`/view/${lessonId}`)}`;
            return {
                content: [
                    {
                        type: 'text',
                        text: `Lesson created (${args.slides.length} slides), but no ElevenLabs key is saved yet so narration won't play.\n\n` +
                            `Tell the user — do NOT ask for their key in chat — to open this URL in their browser:\n\n${setupUrl}\n\n` +
                            `They paste their key once into the form (get one free at https://elevenlabs.io/app/settings/api-keys), click Save, and the page redirects them to the lesson with narration working. The key is saved to ~/.gitexplain/config.json so every future lesson just works.`,
                    },
                ],
            };
        }
        return {
            content: [
                {
                    type: 'text',
                    text: `Lesson created. Tell the user to open this URL in their browser to play it:\n\n${viewUrl}\n\n(${args.slides.length} slides. Narration streams on demand.)`,
                },
            ],
        };
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
            isError: true,
            content: [{ type: 'text', text: `Failed to create lesson: ${msg}` }],
        };
    }
});
mcp.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [
        {
            name: 'slide_types_guide',
            description: 'Full schema reference for all 20 GitExplain slide types. Fetch this before calling create_lesson so you know exactly what data shape each slide type expects.',
        },
    ],
}));
mcp.setRequestHandler(GetPromptRequestSchema, async (req) => {
    if (req.params.name !== 'slide_types_guide') {
        throw new Error(`Unknown prompt: ${req.params.name}`);
    }
    return {
        description: 'GitExplain slide types schema reference',
        messages: [
            {
                role: 'user',
                content: { type: 'text', text: SLIDE_TYPES_GUIDE },
            },
        ],
    };
});
function shutdown() {
    if (serverProc && !serverProc.killed)
        serverProc.kill();
    process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
async function main() {
    baseUrl = await startServer();
    console.error(`[gitexplain-mcp] GitExplain server ready at ${baseUrl}`);
    const transport = new StdioServerTransport();
    await mcp.connect(transport);
    console.error('[gitexplain-mcp] MCP stdio transport connected');
}
main().catch((e) => {
    console.error('[gitexplain-mcp] fatal:', e?.message || e);
    if (serverProc && !serverProc.killed)
        serverProc.kill();
    process.exit(1);
});
