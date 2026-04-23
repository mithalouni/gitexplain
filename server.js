import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  const envPath = path.join(__dirname, '.env');
  const envText = fs.readFileSync(envPath, 'utf8');
  for (const line of envText.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
    if (!m) continue;
    const key = m[1];
    if (process.env[key]) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
} catch {}

const PORT = process.env.PORT !== undefined ? Number(process.env.PORT) : 4178;
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
const DEFAULT_MODEL = 'eleven_flash_v2_5';
const OUTPUT_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_64';

const CONFIG_DIR = path.join(os.homedir(), '.gitexplain');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

function readKey() {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (cfg.elevenLabsKey) return cfg.elevenLabsKey;
  } catch {}
  return process.env.ELEVENLABS_API_KEY || null;
}

function writeKey(key) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch {}
  cfg.elevenLabsKey = key;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const lessons = new Map();
const audioCache = new Map();
const inflight = new Map();

function newId() {
  return crypto.randomBytes(6).toString('hex');
}

const SLIDE_TYPES = new Set([
  'title', 'bullets', 'code', 'codeCompare', 'fileTree', 'flowDiagram',
  'sequenceDiagram', 'architecture', 'callout', 'definition', 'twoColumn',
  'stats', 'terminal', 'steps', 'timeline', 'warning', 'quiz', 'summary',
  'image', 'comparison',
]);

function validateSlideData(type, data, idx) {
  const d = data || {};
  const loc = `slide ${idx} (${type})`;
  const has = (k) => Object.prototype.hasOwnProperty.call(d, k);
  const wrong = (bad, good) => has(bad) && !has(good)
    ? `${loc}: use "${good}" not "${bad}" — the renderer only reads "${good}".`
    : null;
  const missing = (k) => !has(k) ? `${loc}: missing required field "${k}".` : null;
  const notArr = (k) => has(k) && !Array.isArray(d[k]) ? `${loc}: "${k}" must be an array.` : null;
  const first = (...errs) => errs.find((e) => e) || null;

  switch (type) {
    case 'title':
      return missing('title');
    case 'bullets':
      return first(notArr('items'), missing('items'));
    case 'code':
      return first(missing('language'), missing('code'));
    case 'codeCompare':
      return first(missing('leftCode'), missing('rightCode'));
    case 'fileTree': {
      if (has('nodes') && !has('entries')) {
        return `${loc}: use "entries" not "nodes". Entries is a FLAT array (no "children") where each item has { name, depth } — depth is a number (0 = root). Example: [{name:"src/", depth:0, kind:"dir"}, {name:"index.ts", depth:1}].`;
      }
      if (has('rootLabel')) {
        return `${loc}: "rootLabel" is not a field. Put the root in entries[0] with depth:0 and kind:"dir".`;
      }
      const e = missing('entries');
      if (e) return e;
      if (!Array.isArray(d.entries)) return `${loc}: "entries" must be an array.`;
      for (let i = 0; i < d.entries.length; i++) {
        const en = d.entries[i];
        if (!en || typeof en !== 'object') return `${loc}: entries[${i}] must be an object.`;
        if (en.children) return `${loc}: entries are flat — do NOT nest with "children". Use depth:0/1/2/… on each entry.`;
        if (typeof en.name !== 'string') return `${loc}: entries[${i}] missing "name".`;
      }
      return null;
    }
    case 'flowDiagram': {
      if (has('title') && !has('heading')) return `${loc}: use "heading" not "title".`;
      const err = first(missing('nodes'), notArr('nodes'), missing('edges'), notArr('edges'));
      if (err) return err;
      if (d.nodes.length > 8) {
        return `${loc}: ${d.nodes.length} nodes is too many for one diagram — max 8, ideally 4-6. Either drop less-important steps or split across two flowDiagram slides.`;
      }
      for (let i = 0; i < d.nodes.length; i++) {
        const n = d.nodes[i];
        if (!n.id || !n.label) return `${loc}: nodes[${i}] needs both "id" and "label".`;
        if (n.label.length > 36) return `${loc}: nodes[${i}] label is ${n.label.length} chars — keep labels under 36 or the text won't fit.`;
      }
      return null;
    }
    case 'sequenceDiagram':
      return first(missing('actors'), notArr('actors'), missing('messages'), notArr('messages'));
    case 'architecture': {
      if (has('title') && !has('heading')) return `${loc}: use "heading" not "title".`;
      const err = first(missing('layers'), notArr('layers'));
      if (err) return err;
      for (let i = 0; i < d.layers.length; i++) {
        const l = d.layers[i];
        if (!l || typeof l !== 'object') return `${loc}: layers[${i}] must be an object.`;
        if (!l.name) return `${loc}: layers[${i}] missing "name".`;
        if (l.items && !l.nodes) return `${loc}: layers[${i}] uses "items" but the renderer reads "nodes". Rename "items" to "nodes" (array of strings).`;
        if (!Array.isArray(l.nodes)) return `${loc}: layers[${i}].nodes must be an array of strings.`;
        if (l.nodes.length === 0) return `${loc}: layers[${i}] has no nodes — each layer must have at least one node.`;
      }
      return null;
    }
    case 'callout':
      return first(missing('title'), missing('body'));
    case 'definition':
      return first(missing('term'), missing('definition'));
    case 'twoColumn':
      return first(missing('leftHeading'), missing('leftBody'), missing('rightHeading'), missing('rightBody'));
    case 'stats':
      return first(notArr('items'), missing('items'));
    case 'terminal':
      return missing('command');
    case 'steps': {
      if (has('title') && !has('heading')) return `${loc}: use "heading" not "title".`;
      const err = first(missing('steps'), notArr('steps'));
      if (err) return err;
      for (let i = 0; i < d.steps.length; i++) {
        const s = d.steps[i];
        if (!s || typeof s !== 'object') return `${loc}: steps[${i}] must be an object.`;
        if (!s.title) return `${loc}: steps[${i}] missing "title".`;
        if (s.description && !s.detail) return `${loc}: steps[${i}] uses "description" but the renderer reads "detail". Rename "description" to "detail".`;
      }
      return null;
    }
    case 'timeline':
      return first(missing('events'), notArr('events'));
    case 'warning':
      return first(missing('pitfalls'), notArr('pitfalls'));
    case 'quiz':
      return first(missing('question'), missing('choices'), notArr('choices'), missing('answerIndex'));
    case 'summary': {
      if (has('title') && !has('heading')) return `${loc}: use "heading" not "title".`;
      if (has('bullets') && !has('points')) return `${loc}: use "points" not "bullets" (summary slides read "points").`;
      return first(missing('points'), notArr('points'));
    }
    case 'image':
      return missing('url');
    case 'comparison': {
      if (has('title') && !has('heading')) return `${loc}: use "heading" not "title".`;
      if (has('leftTitle') && !has('leftLabel')) return `${loc}: use "leftLabel" not "leftTitle".`;
      if (has('rightTitle') && !has('rightLabel')) return `${loc}: use "rightLabel" not "rightTitle".`;
      return first(missing('leftLabel'), missing('rightLabel'), missing('rows'), notArr('rows'));
    }
    default:
      return null;
  }
}

function validateLesson(lesson) {
  if (!lesson || typeof lesson !== 'object') return 'lesson must be an object';
  if (!Array.isArray(lesson.slides) || lesson.slides.length === 0) return 'slides must be a non-empty array';
  if (lesson.slides.length > 20) return `too many slides (${lesson.slides.length}) — max 20. Aim for 6-10.`;
  for (let i = 0; i < lesson.slides.length; i++) {
    const s = lesson.slides[i];
    if (!s || typeof s !== 'object') return `slide ${i} is not an object`;
    if (!s.type || typeof s.type !== 'string') return `slide ${i} missing type`;
    if (!SLIDE_TYPES.has(s.type)) return `slide ${i}: unknown type "${s.type}". Must be one of: ${[...SLIDE_TYPES].join(', ')}.`;
    if (!s.narration || typeof s.narration !== 'string') return `slide ${i} missing narration`;
    if (s.narration.length > 500) return `slide ${i}: narration is ${s.narration.length} chars — keep under 500 (2-3 sentences). Long narrations kill pacing.`;
    const dataErr = validateSlideData(s.type, s.data, i);
    if (dataErr) return dataErr;
  }
  return null;
}

app.post('/api/lessons', (req, res) => {
  const err = validateLesson(req.body);
  if (err) return res.status(400).json({ error: err });
  const id = newId();
  lessons.set(id, req.body);
  res.json({ id, url: `/view/${id}` });
});

app.get('/api/lessons/:id', (req, res) => {
  const lesson = lessons.get(req.params.id);
  if (!lesson) return res.status(404).json({ error: 'not found' });
  res.json(lesson);
});

async function streamFromElevenLabs(text, voiceId, apiKey) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=${OUTPUT_FORMAT}`;
  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: DEFAULT_MODEL,
      voice_settings: { stability: 0.4, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
    }),
  });
  if (!upstream.ok) {
    const detail = await upstream.text();
    const err = new Error(`ElevenLabs ${upstream.status}: ${detail}`);
    err.status = upstream.status;
    throw err;
  }
  return upstream;
}

app.get('/api/key-status', (_req, res) => {
  res.json({ hasKey: !!readKey() });
});

app.post('/api/key', async (req, res) => {
  const key = (req.body?.key || '').trim();
  if (!key || key.length < 10) {
    return res.status(400).json({ error: 'Key too short or missing' });
  }
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/user', { headers: { 'xi-api-key': key } });
    if (!r.ok) {
      const body = await r.text();
      return res.status(400).json({ error: `ElevenLabs rejected this key (${r.status}): ${body.slice(0, 200)}` });
    }
    writeKey(key);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/setup', (req, res) => {
  const returnTo = typeof req.query.return === 'string' ? req.query.return : '';
  res.type('html').send(renderSetupPage(returnTo, !!readKey()));
});

function renderSetupPage(returnTo, alreadyHasKey) {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>GitExplain — set up narration</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" />
  <link rel="stylesheet" href="/player.css" />
</head>
<body class="landing">
  <div class="bg-fx" aria-hidden="true"></div>
  <main>
    <div class="logo">GitExplain</div>
    <h1>Set up narration</h1>
    <p class="sub">Paste your ElevenLabs API key. It's saved to <code>~/.gitexplain/config.json</code> on this machine and never leaves it.</p>
    ${alreadyHasKey ? '<p class="sub" style="color:var(--cyan)">✓ A key is already saved. Paste again to replace it.</p>' : ''}
    <form id="f" class="setup-form">
      <input id="key" type="password" name="key" placeholder="sk_..." autocomplete="off" required />
      <button type="submit" class="btn btn-primary btn-big">Save key</button>
    </form>
    <div id="status" class="setup-status" hidden></div>
    <p class="footnote">Need a key? <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noopener">Create one at elevenlabs.io</a> — the free tier works.</p>
  </main>
  <script>
    const form = document.getElementById('f');
    const status = document.getElementById('status');
    const returnTo = ${JSON.stringify(esc(returnTo))};
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      status.hidden = false;
      status.className = 'setup-status';
      status.textContent = 'Validating with ElevenLabs…';
      try {
        const res = await fetch('/api/key', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ key: document.getElementById('key').value.trim() }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          status.className = 'setup-status bad';
          status.textContent = body.error || ('Failed (' + res.status + ')');
          return;
        }
        status.className = 'setup-status good';
        status.textContent = 'Saved ✓ — ' + (returnTo ? 'opening lesson…' : 'you can close this tab now.');
        if (returnTo) setTimeout(() => { location.href = returnTo; }, 700);
      } catch (err) {
        status.className = 'setup-status bad';
        status.textContent = 'Failed: ' + err.message;
      }
    });
  </script>
</body>
</html>`;
}

app.get('/audio/:id/:idx.mp3', async (req, res) => {
  const { id, idx } = req.params;
  const slideIdx = Number(idx);
  const lesson = lessons.get(id);
  if (!lesson) return res.status(404).end('lesson not found');
  const slide = lesson.slides[slideIdx];
  if (!slide) return res.status(404).end('slide not found');

  const apiKey = readKey();
  if (!apiKey) {
    res.status(503).type('application/json').end(JSON.stringify({
      error: 'no_key',
      setupUrl: `/setup?return=${encodeURIComponent(`/view/${id}`)}`,
    }));
    return;
  }

  const cacheKey = `${id}:${slideIdx}`;
  const cached = audioCache.get(cacheKey);
  if (cached) {
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Length', cached.length);
    return res.end(cached);
  }

  if (inflight.has(cacheKey)) {
    try {
      const buf = await inflight.get(cacheKey);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', buf.length);
      return res.end(buf);
    } catch (e) {
      return res.status(502).end(String(e.message || e));
    }
  }

  let resolveBuf, rejectBuf;
  const pending = new Promise((resolve, reject) => { resolveBuf = resolve; rejectBuf = reject; });
  pending.catch(() => {});
  inflight.set(cacheKey, pending);

  try {
    const voiceId = lesson.voiceId || DEFAULT_VOICE_ID;
    const upstream = await streamFromElevenLabs(slide.narration, voiceId, apiKey);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const chunks = [];
    const reader = upstream.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      chunks.push(chunk);
      res.write(chunk);
    }
    res.end();
    const buf = Buffer.concat(chunks);
    audioCache.set(cacheKey, buf);
    resolveBuf(buf);
  } catch (e) {
    console.error('[audio]', e.message);
    rejectBuf(e);
    if (!res.headersSent) res.status(e.status || 502).end(String(e.message || e));
    else res.end();
  } finally {
    inflight.delete(cacheKey);
  }
});

app.get('/view/:id', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player.html'));
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, () => {
  const actualPort = server.address().port;
  const file = process.argv[2];
  console.log(`\n  GitExplain lesson player running on http://localhost:${actualPort}`);
  console.log(`  voice=${DEFAULT_VOICE_ID}  model=${DEFAULT_MODEL}  format=${OUTPUT_FORMAT}`);
  if (file) {
    try {
      const raw = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
      const lesson = JSON.parse(raw);
      const err = validateLesson(lesson);
      if (err) {
        console.error(`\n  ✗ ${file}: ${err}\n`);
      } else {
        const id = newId();
        lessons.set(id, lesson);
        console.log(`\n  ▶ ${lesson.title || 'Lesson'} (${lesson.slides.length} slides)`);
        console.log(`    http://localhost:${actualPort}/view/${id}\n`);
      }
    } catch (e) {
      console.error(`\n  ✗ failed to load ${file}: ${e.message}\n`);
    }
  } else {
    console.log(`\n  POST a lesson to http://localhost:${actualPort}/api/lessons`);
    console.log(`  or start with: node server.js sample-lesson.json\n`);
  }
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e?.message || e));
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e?.message || e));
