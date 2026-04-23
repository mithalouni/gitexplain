(() => {
  const match = location.pathname.match(/^\/view\/([^/]+)/);
  const lessonId = match && match[1];
  if (!lessonId) return;

  const stage = document.getElementById('stage');
  const progress = document.getElementById('progress');
  const counter = document.getElementById('counter');
  const docTitle = document.getElementById('title');
  const caption = document.getElementById('caption');
  const errBanner = document.getElementById('audio-error');
  const gate = document.getElementById('gate');
  const gateSub = document.getElementById('gate-sub');
  const gateTitle = document.getElementById('gate-title');
  const startBtn = document.getElementById('start');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const playBtn = document.getElementById('playpause');
  const restartBtn = document.getElementById('restart');
  const ccBtn = document.getElementById('cc');

  const audio = new Audio();
  audio.preload = 'auto';

  let lesson = null;
  let current = 0;
  let captionsOn = false;
  const warmed = new Set();

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  function warmAudio(idx) {
    if (idx < 0 || idx >= lesson.slides.length || warmed.has(idx)) return;
    warmed.add(idx);
    fetch(`/audio/${lessonId}/${idx}.mp3`, { method: 'GET' }).catch(() => {});
  }

  function renderSlide(idx) {
    if (!lesson) return;
    if (idx < 0 || idx >= lesson.slides.length) return;
    current = idx;
    const slide = lesson.slides[idx];
    const r = RENDERERS[slide.type] || RENDERERS._unknown;
    stage.innerHTML = r(slide.data || {}, slide);
    stage.querySelectorAll('pre code').forEach((el) => {
      try { window.hljs && window.hljs.highlightElement(el); } catch {}
    });
    counter.textContent = `${idx + 1} / ${lesson.slides.length}`;
    progress.style.width = `${((idx + 1) / lesson.slides.length) * 100}%`;
    caption.textContent = slide.narration;
    caption.hidden = !captionsOn;

    audio.src = `/audio/${lessonId}/${idx}.mp3`;
    audio.currentTime = 0;
    audio.play().then(() => {
      playBtn.textContent = '❚❚';
    }).catch(() => {
      playBtn.textContent = '▶';
    });
    warmAudio(idx + 1);
    warmAudio(idx + 2);
  }

  function togglePlay() {
    if (audio.paused) { audio.play(); playBtn.textContent = '❚❚'; }
    else { audio.pause(); playBtn.textContent = '▶'; }
  }

  audio.addEventListener('ended', () => {
    if (current + 1 < lesson.slides.length) renderSlide(current + 1);
    else playBtn.textContent = '▶';
  });
  audio.addEventListener('play', () => { playBtn.textContent = '❚❚'; });
  audio.addEventListener('pause', () => { playBtn.textContent = '▶'; });
  function hideErr() { errBanner.hidden = true; }
  function showErr(html) {
    errBanner.innerHTML = html + ' <button onclick="this.parentElement.hidden=true">dismiss</button>';
    errBanner.hidden = false;
  }

  audio.addEventListener('error', async () => {
    try {
      const r = await fetch(audio.src);
      if (r.status === 503) {
        const body = await r.json().catch(() => ({}));
        if (body.error === 'no_key' && body.setupUrl) {
          showErr(`<b>No narration yet.</b> <a href="${esc(body.setupUrl)}" target="_self">Set up your ElevenLabs key</a> — takes one paste, then this lesson plays with voice.`);
          return;
        }
      }
      if (!r.ok) {
        const txt = (await r.text()).slice(0, 400);
        if (/invalid[_ ]?api[_ ]?key/i.test(txt)) {
          showErr(`<b>No narration:</b> the saved ElevenLabs key is invalid. <a href="/setup?return=${encodeURIComponent(location.pathname)}" target="_self">Replace it here</a>.`);
        } else {
          showErr(`<b>Audio failed (HTTP ${r.status}):</b> ${esc(txt)}`);
        }
        return;
      }
    } catch (_) {}
    showErr(`<b>Audio failed.</b> Check the server log.`);
  });
  audio.addEventListener('loadstart', hideErr);

  prevBtn.addEventListener('click', () => renderSlide(Math.max(0, current - 1)));
  nextBtn.addEventListener('click', () => renderSlide(Math.min(lesson.slides.length - 1, current + 1)));
  playBtn.addEventListener('click', togglePlay);
  restartBtn.addEventListener('click', () => renderSlide(0));
  ccBtn.addEventListener('click', () => {
    captionsOn = !captionsOn;
    caption.hidden = !captionsOn;
    ccBtn.style.opacity = captionsOn ? '1' : '0.55';
  });
  ccBtn.style.opacity = '0.55';

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    else if (e.key === 'ArrowRight') nextBtn.click();
    else if (e.key === 'ArrowLeft') prevBtn.click();
    else if (e.key === 'r' || e.key === 'R') restartBtn.click();
    else if (e.key === 'c' || e.key === 'C') ccBtn.click();
    else if (e.key === 'Escape') audio.pause();
  });

  startBtn.addEventListener('click', async () => {
    gate.classList.add('hidden');
    renderSlide(0);
  });

  async function init() {
    try {
      const res = await fetch(`/api/lessons/${lessonId}`);
      if (!res.ok) throw new Error(`lesson not found (${res.status})`);
      lesson = await res.json();
      docTitle.textContent = lesson.title || '';
      gateTitle.textContent = lesson.title || 'Lesson';
      document.title = lesson.title ? `${lesson.title} · GitExplain` : 'GitExplain lesson';
      counter.textContent = `0 / ${lesson.slides.length}`;
      warmAudio(0);
    } catch (e) {
      stage.innerHTML = `<div class="slide-err">Failed to load lesson: ${esc(e.message)}</div>`;
      gate.classList.add('hidden');
    }
  }

  init();

  // ============================================================
  //  20 slide renderers
  //  Each takes the slide.data object + full slide, returns HTML.
  // ============================================================
  const RENDERERS = {
    // 1. title
    title: (d) => `
      <section class="s-title">
        <h1>${esc(d.title || '')}</h1>
        ${d.subtitle ? `<p>${esc(d.subtitle)}</p>` : ''}
      </section>`,

    // 2. bullets
    bullets: (d) => {
      const items = d.items || [];
      const style = d.style || 'dot';
      const marks = {
        dot: () => '•', check: () => '✓', number: (i) => `${i + 1}.`,
      };
      return `
        <section class="s-bullets ${style}">
          ${d.heading ? `<h2>${esc(d.heading)}</h2>` : ''}
          <ul>${items.map((it, i) =>
            `<li><span class="mark">${marks[style](i)}</span><span>${esc(it)}</span></li>`
          ).join('')}</ul>
        </section>`;
    },

    // 3. code
    code: (d) => {
      const lang = d.language || 'plaintext';
      const lines = (d.code || '').split('\n');
      const hl = new Set(d.highlight || []);
      const rendered = lines.map((ln, i) =>
        hl.has(i + 1) ? `<span class="hl">${esc(ln)}</span>` : esc(ln)
      ).join('\n');
      return `
        <section class="s-code">
          ${d.caption ? `<div class="cap">${esc(d.caption)}</div>` : ''}
          ${d.heading ? `<h2>${esc(d.heading)}</h2>` : ''}
          <pre><code class="language-${esc(lang)}">${rendered}</code></pre>
        </section>`;
    },

    // 4. codeCompare
    codeCompare: (d) => `
      <section class="s-compare">
        <div class="pane">
          <div class="label ${d.leftKind || 'bad'}">${esc(d.leftLabel || 'Before')}</div>
          <pre><code class="language-${esc(d.leftLanguage || 'plaintext')}">${esc(d.leftCode || '')}</code></pre>
        </div>
        <div class="pane">
          <div class="label ${d.rightKind || 'good'}">${esc(d.rightLabel || 'After')}</div>
          <pre><code class="language-${esc(d.rightLanguage || d.leftLanguage || 'plaintext')}">${esc(d.rightCode || '')}</code></pre>
        </div>
      </section>`,

    // 5. fileTree
    fileTree: (d) => {
      const entries = d.entries || [];
      return `
        <section class="s-tree">
          ${d.heading ? `<h2>${esc(d.heading)}</h2>` : ''}
          <div class="tree">
            ${entries.map((e) => {
              const depth = e.depth || 0;
              const pad = '  '.repeat(depth);
              const icon = e.kind === 'dir' ? '📁' : '📄';
              const cls = e.highlight ? 'row hi' : (e.dim ? 'row dim' : 'row');
              return `<div class="${cls}">${pad}${icon} ${esc(e.name)}${e.note ? `<span class="note">— ${esc(e.note)}</span>` : ''}</div>`;
            }).join('')}
          </div>
        </section>`;
    },

    // 6. flowDiagram — grid layout. Wraps to rows to keep labels readable.
    flowDiagram: (d) => {
      const nodes = d.nodes || [];
      const edges = d.edges || [];
      const dir = d.direction || 'LR';
      const nodeW = 180, nodeH = 64, gapX = 60, gapY = 54;
      const maxPerRow = 4;
      const positions = {};
      let cols, rows, width, height;

      if (dir === 'LR') {
        rows = Math.ceil(nodes.length / maxPerRow);
        cols = Math.min(nodes.length, maxPerRow);
        nodes.forEach((n, i) => {
          const row = Math.floor(i / maxPerRow);
          const idxInRow = i % maxPerRow;
          const col = row % 2 === 0 ? idxInRow : (maxPerRow - 1 - idxInRow);
          positions[n.id] = {
            x: 20 + col * (nodeW + gapX),
            y: 20 + row * (nodeH + gapY),
            row,
          };
        });
        width = 40 + cols * nodeW + (cols - 1) * gapX;
        height = 40 + rows * nodeH + (rows - 1) * gapY;
      } else {
        nodes.forEach((n, i) => {
          positions[n.id] = { x: 30, y: 20 + i * (nodeH + gapY), row: i };
        });
        width = nodeW + 60;
        height = 40 + nodes.length * nodeH + (nodes.length - 1) * gapY;
      }

      const wrapLabel = (s, max) => {
        if (s.length <= max) return [s];
        const words = s.split(' ');
        const lines = []; let cur = '';
        for (const w of words) {
          if ((cur + ' ' + w).trim().length > max) {
            if (cur) lines.push(cur);
            cur = w;
          } else cur = (cur ? cur + ' ' : '') + w;
        }
        if (cur) lines.push(cur);
        return lines.slice(0, 3);
      };

      const nodeSvg = nodes.map((n) => {
        const p = positions[n.id];
        const lines = wrapLabel(String(n.label || ''), 22);
        const startY = p.y + nodeH / 2 + 5 - (lines.length - 1) * 7;
        const texts = lines.map((ln, i) =>
          `<text x="${p.x + nodeW / 2}" y="${startY + i * 14}" text-anchor="middle">${esc(ln)}</text>`
        ).join('');
        return `<g class="node"><rect x="${p.x}" y="${p.y}" width="${nodeW}" height="${nodeH}" rx="10"/>${texts}</g>`;
      }).join('');

      const edgeSvg = edges.map((e) => {
        const a = positions[e.from]; const b = positions[e.to];
        if (!a || !b) return '';
        let x1, y1, x2, y2, path;
        if (dir === 'LR') {
          if (a.row === b.row) {
            const leftToRight = a.x < b.x;
            x1 = leftToRight ? a.x + nodeW : a.x;
            y1 = a.y + nodeH / 2;
            x2 = leftToRight ? b.x : b.x + nodeW;
            y2 = b.y + nodeH / 2;
            const mx = (x1 + x2) / 2;
            path = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
          } else {
            x1 = a.x + nodeW / 2; y1 = a.y + nodeH;
            x2 = b.x + nodeW / 2; y2 = b.y;
            const my = (y1 + y2) / 2;
            path = `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
          }
        } else {
          x1 = a.x + nodeW / 2; y1 = a.y + nodeH;
          x2 = b.x + nodeW / 2; y2 = b.y;
          path = `M ${x1} ${y1} L ${x2} ${y2}`;
        }
        const lx = (x1 + x2) / 2, ly = (y1 + y2) / 2 - 8;
        return `<g class="edge"><path d="${path}" marker-end="url(#ah)"/>${e.label ? `<text x="${lx}" y="${ly}" text-anchor="middle">${esc(e.label)}</text>` : ''}</g>`;
      }).join('');

      return `
        <section class="s-flow">
          ${d.heading ? `<h2>${esc(d.heading)}</h2>` : ''}
          <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
            <defs><marker id="ah" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path class="arrowhead" d="M0,0 L0,6 L9,3 z"/></marker></defs>
            ${edgeSvg}${nodeSvg}
          </svg>
        </section>`;
    },

    // 7. sequenceDiagram
    sequenceDiagram: (d) => {
      const actors = d.actors || [];
      const messages = d.messages || [];
      const colGap = 100 / Math.max(1, actors.length - 1);
      const w = 900, h = 60 + messages.length * 46;
      const actorX = (name) => {
        const i = actors.indexOf(name);
        return i < 0 ? 0 : (actors.length === 1 ? w / 2 : 60 + (i * (w - 120)) / (actors.length - 1));
      };
      const lanes = actors.map((a) => {
        const x = actorX(a);
        return `<line class="lane" x1="${x}" y1="20" x2="${x}" y2="${h - 20}"/>`;
      }).join('');
      const msgs = messages.map((m, i) => {
        const x1 = actorX(m.from), x2 = actorX(m.to);
        const y = 40 + i * 46;
        const midX = (x1 + x2) / 2;
        return `<g class="msg"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" marker-end="url(#sarr)"/><text x="${midX}" y="${y - 6}" text-anchor="middle">${esc(m.text)}</text></g>`;
      }).join('');
      return `
        <section class="s-seq">
          ${d.heading ? `<h2>${esc(d.heading)}</h2>` : ''}
          <div class="actors">${actors.map((a) => `<div class="actor">${esc(a)}</div>`).join('')}</div>
          <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
            <defs><marker id="sarr" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path fill="#7c9cff" d="M0,0 L0,6 L9,3 z"/></marker></defs>
            ${lanes}${msgs}
          </svg>
        </section>`;
    },

    // 8. architecture
    architecture: (d) => `
      <section class="s-arch">
        ${d.heading ? `<h2>${esc(d.heading)}</h2>` : ''}
        <div class="layers">
          ${(d.layers || []).map((l) => `
            <div class="layer">
              <div class="layer-name">${esc(l.name)}</div>
              <div class="boxes">${(l.nodes || []).map((n) => `<div class="box">${esc(n)}</div>`).join('')}</div>
            </div>`).join('')}
        </div>
      </section>`,

    // 9. callout
    callout: (d) => {
      const kind = d.kind || 'info';
      const icons = { info: '💡', tip: '✨', warning: '⚠️', success: '✅' };
      return `
        <section class="s-callout ${kind}">
          <div class="card">
            <div class="icon">${icons[kind] || icons.info}</div>
            <div>
              <h3>${esc(d.title || '')}</h3>
              <p>${esc(d.body || '')}</p>
            </div>
          </div>
        </section>`;
    },

    // 10. definition
    definition: (d) => `
      <section class="s-def">
        <div class="term">${esc(d.term || '')}</div>
        <div class="definition">${esc(d.definition || '')}</div>
        ${d.also ? `<div class="also">See also: ${esc(d.also)}</div>` : ''}
      </section>`,

    // 11. twoColumn
    twoColumn: (d) => `
      <section class="s-two">
        <div class="col">
          <h3>${esc(d.leftHeading || '')}</h3>
          <p>${esc(d.leftBody || '')}</p>
        </div>
        <div class="col">
          <h3>${esc(d.rightHeading || '')}</h3>
          <p>${esc(d.rightBody || '')}</p>
        </div>
      </section>`,

    // 12. stats
    stats: (d) => `
      <section class="s-stats">
        ${d.heading ? `<h2>${esc(d.heading)}</h2>` : ''}
        <div class="grid">
          ${(d.items || []).map((it) => `
            <div class="cell"><div class="val">${esc(it.value)}</div><div class="lab">${esc(it.label)}</div></div>
          `).join('')}
        </div>
      </section>`,

    // 13. terminal
    terminal: (d) => `
      <section class="s-term">
        <div class="frame">
          <div class="bar"><div class="dot r"></div><div class="dot y"></div><div class="dot g"></div></div>
          <div class="body">
            <div><span class="prompt">${esc(d.prompt || '$')}</span> <span class="cmd">${esc(d.command || '')}</span></div>
            ${(d.output && d.output.length) ? `<div class="out">${(d.output || []).map(esc).join('\n')}</div>` : ''}
          </div>
        </div>
      </section>`,

    // 14. steps
    steps: (d) => `
      <section class="s-steps">
        ${d.heading ? `<h2>${esc(d.heading)}</h2>` : ''}
        <ol>${(d.steps || []).map((s) => `
          <li><div><div class="t">${esc(s.title)}</div>${s.detail ? `<div class="d">${esc(s.detail)}</div>` : ''}</div></li>
        `).join('')}</ol>
      </section>`,

    // 15. timeline
    timeline: (d) => `
      <section class="s-time">
        ${d.heading ? `<h2>${esc(d.heading)}</h2>` : ''}
        <ul>${(d.events || []).map((e) => `
          <li><span class="t">${esc(e.time)}</span><span class="e">${esc(e.event)}</span></li>
        `).join('')}</ul>
      </section>`,

    // 16. warning
    warning: (d) => `
      <section class="s-warn">
        <div class="head"><span class="icon">⚠️</span><h2>${esc(d.title || 'Watch out')}</h2></div>
        <ul>${(d.pitfalls || []).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      </section>`,

    // 17. quiz
    quiz: (d) => {
      const ans = Number.isInteger(d.answerIndex) ? d.answerIndex : -1;
      return `
        <section class="s-quiz">
          <h2>${esc(d.question || '')}</h2>
          <div class="choices">
            ${(d.choices || []).map((c, i) => `
              <div class="choice ${i === ans ? 'good' : ''}">${String.fromCharCode(65 + i)}. ${esc(c)}</div>
            `).join('')}
          </div>
          ${d.explanation ? `<div class="answer">${esc(d.explanation)}</div>` : ''}
        </section>`;
    },

    // 18. summary
    summary: (d) => `
      <section class="s-sum">
        <h2>${esc(d.heading || 'In summary')}</h2>
        <ul>${(d.points || []).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      </section>`,

    // 19. image
    image: (d) => `
      <section class="s-image">
        <img src="${esc(d.url || '')}" alt="${esc(d.alt || '')}" />
        ${d.caption ? `<div class="cap">${esc(d.caption)}</div>` : ''}
      </section>`,

    // 20. comparison
    comparison: (d) => `
      <section class="s-cmp">
        ${d.heading ? `<h2>${esc(d.heading)}</h2>` : ''}
        <table>
          <thead><tr><th></th><th>${esc(d.leftLabel || 'A')}</th><th>${esc(d.rightLabel || 'B')}</th></tr></thead>
          <tbody>
            ${(d.rows || []).map((r) => `<tr><td class="row-label">${esc(r.label)}</td><td>${esc(r.left)}</td><td>${esc(r.right)}</td></tr>`).join('')}
          </tbody>
        </table>
      </section>`,

    _unknown: (_d, slide) => `<div class="slide-err">Unknown slide type: <code>${esc(slide.type)}</code></div>`,
  };
})();
