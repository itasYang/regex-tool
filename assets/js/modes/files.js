/* ============================================================
 * 模式 3：多文件名测试 — Phase 3 实装（Phase 4 接入 i18n）
 * 输入一组文件名，测试当前正则能命中哪些。
 * 5 种来源（子 tab）：逐行输入 / 示例集 / 文件夹 / 粘贴 ls·dir·tree / 批量生成。
 * 结果分「命中 / 未命中」两栏，顶部显示统计。
 * ============================================================ */
(function () {
  'use strict';

  window.Modes = window.Modes || {};
  const t = (k, v) => window.I18n.t(k, v);
  function esc(s) { return window.Highlight.escape(s); }
  function escAttr(s) { return esc(s).replace(/\n/g, '&#10;'); }

  const LIST_CAP = 2000;
  const GEN_CAP = 2000;
  const FILES_CAP = 8000;

  function tpl() {
    return [
      '<div class="mode-card">',
      '  <div class="fm-sources">',
      '    <div class="fm-srctabs" id="fm-srctabs">',
      '      <button class="fm-srctab active" data-src="text">' + esc(t('files.src.text')) + '</button>',
      '      <button class="fm-srctab" data-src="preset">' + esc(t('files.src.preset')) + '</button>',
      '      <button class="fm-srctab" data-src="folder">' + esc(t('files.src.folder')) + '</button>',
      '      <button class="fm-srctab" data-src="listing">' + esc(t('files.src.listing')) + '</button>',
      '      <button class="fm-srctab" data-src="generator">' + esc(t('files.src.generator')) + '</button>',
      '    </div>',

      '    <div class="fm-srcpanel is-active" data-src="text">',
      '      <textarea id="fm-text" class="test-input" spellcheck="false" autocomplete="off"',
      '        placeholder="' + escAttr(t('files.text.placeholder')) + '"></textarea>',
      '      <div class="fm-srcnote" id="fm-note-text"></div>',
      '    </div>',

      '    <div class="fm-srcpanel" data-src="preset">',
      '      <label class="field-label" for="fm-preset">' + esc(t('files.preset.label')) + '</label>',
      '      <select id="fm-preset" class="fm-select"></select>',
      '      <div class="fm-srcnote" id="fm-note-preset"></div>',
      '    </div>',

      '    <div class="fm-srcpanel" data-src="folder">',
      '      <div id="fm-drop" class="fm-drop">',
      '        <p>' + esc(t('files.folder.prompt')) + '</p>',
      '        <label class="fm-btn"><input type="file" id="fm-folder" webkitdirectory directory multiple hidden />' + esc(t('files.folder.choose')) + '</label>',
      '        <p class="fm-srcnote">' + esc(t('files.folder.note')) + '</p>',
      '      </div>',
      '      <div class="fm-srcnote" id="fm-note-folder"></div>',
      '    </div>',

      '    <div class="fm-srcpanel" data-src="listing">',
      '      <textarea id="fm-listing" class="test-input" spellcheck="false" autocomplete="off"',
      '        placeholder="' + escAttr(t('files.listing.placeholder')) + '"></textarea>',
      '      <div class="fm-row">',
      '        <button class="fm-btn" id="fm-parse-listing">' + esc(t('files.listing.parse')) + '</button>',
      '        <span class="fm-srcnote">' + esc(t('files.listing.hint')) + '</span>',
      '      </div>',
      '      <div class="fm-srcnote" id="fm-note-listing"></div>',
      '    </div>',

      '    <div class="fm-srcpanel" data-src="generator">',
      '      <label class="field-label" for="fm-gen">' + esc(t('files.gen.label')) + '</label>',
      '      <div class="fm-row">',
      '        <input type="text" id="fm-gen" class="fm-input" spellcheck="false"',
      '          placeholder="IMG_{0001-0020}.{jpg,png}" value="IMG_{0001-0020}.{jpg,png}" />',
      '        <button class="fm-btn" id="fm-gen-run">' + esc(t('files.gen.run')) + '</button>',
      '      </div>',
      '      <div class="fm-srcnote" id="fm-note-generator"></div>',
      '    </div>',
      '  </div>',

      '  <div class="field">',
      '    <div class="fm-stats" id="fm-stats"></div>',
      '    <div class="fm-cols">',
      '      <div class="fm-col">',
      '        <div class="fm-col-head fm-head-hit">' + esc(t('files.col.hit')) + ' <span id="fm-hit-n">0</span></div>',
      '        <div class="fm-list" id="fm-hit-list"></div>',
      '      </div>',
      '      <div class="fm-col">',
      '        <div class="fm-col-head fm-head-miss">' + esc(t('files.col.miss')) + ' <span id="fm-miss-n">0</span></div>',
      '        <div class="fm-list" id="fm-miss-list"></div>',
      '      </div>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  let panelRef = null;
  let currentFiles = [];
  let onRegexChange = null;
  let textTimer = null;

  /* ---------- 解析辅助 ---------- */

  function dedupe(arr) {
    const seen = Object.create(null);
    const out = [];
    for (const x of arr) {
      if (x && !seen[x]) { seen[x] = 1; out.push(x); }
    }
    return out;
  }

  function cleanName(s) {
    s = s.trim();
    const arrow = s.indexOf(' -> ');
    if (arrow !== -1) s = s.slice(0, arrow);
    s = s.replace(/[\/*@=|>]$/, '');
    s = s.replace(/^["']|["']$/g, '');
    return s.trim();
  }

  function parseLines(text) {
    return dedupe(text.split(/\r?\n/).map(s => s.trim()).filter(Boolean));
  }

  function parseListing(text) {
    const names = [];
    const lines = text.split(/\r?\n/);
    const isTreeLine = (l) => /[─-╿]/.test(l) || /(`--|\|--|\+--)/.test(l);

    for (const raw of lines) {
      if (!raw.trim()) continue;
      const line = raw;

      if (/^total\s+\d+/i.test(line)) continue;
      if (/Volume in drive|Volume Serial|Directory of|个目录|个文件|File\(s\)|Dir\(s\)|bytes free|可用字节/i.test(line)) continue;

      if (isTreeLine(line)) {
        const stripped = line.replace(/^[\s─-╿`|+\\.-]+/, '').trim();
        if (stripped) names.push(cleanName(stripped));
        continue;
      }

      const ls = line.match(/^[-dlbcps][rwxsStT.+-]{9,}\s+\d+\s+\S+\s+\S+\s+[\d.,]+\s+\S+\s+\S+\s+\S+\s+(.+)$/);
      if (ls) { names.push(cleanName(ls[1])); continue; }

      const dir = line.match(/^\d{2,4}[\/-]\d{2}[\/-]\d{2,4}\s+\d{1,2}:\d{2}(?:\s*[APap][Mm])?\s+(?:<DIR>|<JUNCTION>|[\d.,]+)\s+(.+)$/);
      if (dir) {
        const nm = cleanName(dir[1]);
        if (nm !== '.' && nm !== '..') names.push(nm);
        continue;
      }

      const nm = cleanName(line.trim());
      if (nm && nm !== '.' && nm !== '..') names.push(nm);
    }
    return dedupe(names);
  }

  function expandGroup(g) {
    let m = g.match(/^(\d+)-(\d+)$/);
    if (m) {
      const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
      const pad = m[1].length;
      const out = [];
      const step = a <= b ? 1 : -1;
      for (let i = a; step > 0 ? i <= b : i >= b; i += step) {
        out.push(String(i).padStart(pad, '0'));
        if (out.length > 100000) break;
      }
      return out;
    }
    m = g.match(/^([a-zA-Z])-([a-zA-Z])$/);
    if (m) {
      const a = m[1].charCodeAt(0), b = m[2].charCodeAt(0);
      const out = [];
      const step = a <= b ? 1 : -1;
      for (let i = a; step > 0 ? i <= b : i >= b; i += step) out.push(String.fromCharCode(i));
      return out;
    }
    if (g.indexOf(',') !== -1) return g.split(',');
    return [g];
  }

  function expandTemplate(tplStr, cap) {
    cap = cap || GEN_CAP;
    const parts = [];
    const re = /\{([^}]*)\}/g;
    let last = 0, m;
    while ((m = re.exec(tplStr)) !== null) {
      if (m.index > last) parts.push([tplStr.slice(last, m.index)]);
      parts.push(expandGroup(m[1]));
      last = m.index + m[0].length;
    }
    if (last < tplStr.length) parts.push([tplStr.slice(last)]);
    if (!parts.length) return { files: [], truncated: false };

    let results = [''];
    let truncated = false;
    for (const arr of parts) {
      const next = [];
      for (const prefix of results) {
        for (const s of arr) {
          next.push(prefix + s);
          if (next.length >= cap) { truncated = true; break; }
        }
        if (truncated) break;
      }
      results = next;
      if (truncated) break;
    }
    return { files: results, truncated };
  }

  /* ---------- 匹配 ---------- */

  function matchRanges(regex, name) {
    if (!regex) return [];
    try {
      const g = regex.global ? regex : new RegExp(regex.source, regex.flags + 'g');
      g.lastIndex = 0;
      const out = [];
      let m, guard = 0;
      while ((m = g.exec(name)) !== null) {
        out.push({ index: m.index, length: m[0].length });
        if (m.index === g.lastIndex) g.lastIndex++;
        if (++guard > 1000) break;
      }
      return out;
    } catch (e) {
      return [];
    }
  }

  function el(id) { return panelRef ? panelRef.querySelector('#' + id) : null; }

  function setFiles(arr, sourceId, extraNote) {
    currentFiles = dedupe(arr).slice(0, FILES_CAP);
    const note = el('fm-note-' + sourceId);
    if (note) {
      let txt = t('files.loaded', { n: currentFiles.length });
      if (arr.length > FILES_CAP) txt += t('files.truncatedAt', { cap: FILES_CAP });
      if (extraNote) txt += '　' + extraNote;
      note.textContent = txt;
    }
    runMatch();
  }

  function listHtml(items, container, withHighlight) {
    const frag = [];
    const shown = Math.min(items.length, LIST_CAP);
    for (let i = 0; i < shown; i++) {
      const it = items[i];
      const body = withHighlight
        ? Highlight.render(it.name, it.ranges)
        : Highlight.escape(it.name);
      frag.push('<div class="fm-item">' + body + '</div>');
    }
    if (items.length > shown) {
      frag.push('<div class="fm-more">' + esc(t('files.more', { n: items.length - shown })) + '</div>');
    }
    if (!items.length) frag.push('<div class="fm-empty">—</div>');
    container.innerHTML = frag.join('');
  }

  function runMatch() {
    if (!panelRef) return;
    const App = window.App;
    const stats = el('fm-stats');
    const hitList = el('fm-hit-list');
    const missList = el('fm-miss-list');
    const hitN = el('fm-hit-n');
    const missN = el('fm-miss-n');
    if (!stats || !hitList || !missList) return;

    const total = currentFiles.length;
    const regex = App.state.regex;
    const err = App.state.regexError;

    if (!total) {
      stats.textContent = t('files.stats.empty');
      hitList.innerHTML = '<div class="fm-empty">—</div>';
      missList.innerHTML = '<div class="fm-empty">—</div>';
      hitN.textContent = '0'; missN.textContent = '0';
      App.setStats(0, null);
      return;
    }

    if (err) {
      stats.innerHTML = '<span class="result-error">' + esc(t('common.regexError', { msg: err })) + '</span>';
      hitList.innerHTML = '<div class="fm-empty">—</div>';
      missList.innerHTML = '';
      listHtml(currentFiles.map(n => ({ name: n })), missList, false);
      hitN.textContent = '0'; missN.textContent = String(total);
      App.setStats(null, null);
      return;
    }

    if (!regex) {
      stats.innerHTML = esc(t('files.stats.total', { n: total }));
      hitList.innerHTML = '<div class="fm-empty">' + esc(t('files.notApplied')) + '</div>';
      listHtml(currentFiles.map(n => ({ name: n })), missList, false);
      hitN.textContent = '0'; missN.textContent = String(total);
      App.setStats(0, null);
      return;
    }

    const t0 = (performance && performance.now) ? performance.now() : Date.now();
    const hits = [], misses = [];
    for (const name of currentFiles) {
      const ranges = matchRanges(regex, name);
      if (ranges.length) hits.push({ name: name, ranges: ranges });
      else misses.push({ name: name });
    }
    const elapsed = ((performance && performance.now) ? performance.now() : Date.now()) - t0;

    stats.innerHTML =
      '<b class="fm-stat-hit">' + hits.length + '</b> ' + esc(t('files.word.hit')) + ' / ' +
      '<b class="fm-stat-miss">' + misses.length + '</b> ' + esc(t('files.word.miss')) + ' / ' +
      esc(t('files.word.total')) + ' <b>' + total + '</b>';
    hitN.textContent = String(hits.length);
    missN.textContent = String(misses.length);
    listHtml(hits, hitList, true);
    listHtml(misses, missList, false);
    App.setStats(hits.length, elapsed);
  }

  /* ---------- 来源 UI 绑定 ---------- */

  function bindSourceTabs() {
    const tabs = panelRef.querySelectorAll('.fm-srctab');
    const panels = panelRef.querySelectorAll('.fm-srcpanel');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(x => x.classList.remove('active'));
        tab.classList.add('active');
        const src = tab.dataset.src;
        panels.forEach(p => p.classList.toggle('is-active', p.dataset.src === src));
      });
    });
  }

  function bindText() {
    const ta = el('fm-text');
    if (!ta) return;
    if (window.Storage) {
      const saved = Storage.get('files:text', '');
      if (typeof saved === 'string' && saved) ta.value = saved;
    }
    ta.addEventListener('input', () => {
      clearTimeout(textTimer);
      textTimer = setTimeout(() => {
        if (window.Storage) Storage.set('files:text', ta.value);
        setFiles(parseLines(ta.value), 'text');
      }, 200);
    });
    if (ta.value) setFiles(parseLines(ta.value), 'text');
  }

  function bindPreset() {
    const sel = el('fm-preset');
    if (!sel) return;
    const samples = window.FileSamples || [];
    let html = '<option value="">' + esc(t('files.preset.choose')) + '</option>';
    samples.forEach(s => {
      const nm = window.I18n.dict[window.I18n.lang]['files.sample.' + s.id] ? t('files.sample.' + s.id) : s.name;
      html += '<option value="' + esc(s.id) + '">' + esc(nm) + '（' + s.files.length + '）</option>';
    });
    sel.innerHTML = html;
    sel.addEventListener('change', () => {
      const s = samples.find(x => x.id === sel.value);
      if (s) setFiles(s.files.slice(), 'preset');
    });
  }

  function bindFolder() {
    const input = el('fm-folder');
    const drop = el('fm-drop');
    if (input) {
      input.addEventListener('change', () => {
        const out = [];
        const files = input.files || [];
        for (let i = 0; i < files.length; i++) {
          out.push(files[i].webkitRelativePath || files[i].name);
        }
        setFiles(out, 'folder');
      });
    }
    if (drop) {
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
      drop.addEventListener('drop', (e) => {
        e.preventDefault();
        drop.classList.remove('is-over');
        const dt = e.dataTransfer;
        const items = dt && dt.items;
        const entries = [];
        if (items) {
          for (let i = 0; i < items.length; i++) {
            const en = items[i].webkitGetAsEntry && items[i].webkitGetAsEntry();
            if (en) entries.push(en);
          }
        }
        if (entries.length) {
          const out = [];
          Promise.all(entries.map(en => traverseEntry(en, '', out)))
            .then(() => setFiles(out, 'folder'));
        } else if (dt && dt.files && dt.files.length) {
          const out = [];
          for (let i = 0; i < dt.files.length; i++) out.push(dt.files[i].name);
          setFiles(out, 'folder');
        }
      });
    }
  }

  function traverseEntry(entry, path, out) {
    return new Promise((resolve) => {
      if (out.length >= FILES_CAP) { resolve(); return; }
      if (entry.isFile) {
        out.push(path + entry.name);
        resolve();
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const all = [];
        const readBatch = () => {
          reader.readEntries((batch) => {
            if (!batch.length) {
              Promise.all(all.map(e => traverseEntry(e, path + entry.name + '/', out))).then(resolve);
            } else {
              for (let i = 0; i < batch.length; i++) all.push(batch[i]);
              readBatch();
            }
          }, () => resolve());
        };
        readBatch();
      } else {
        resolve();
      }
    });
  }

  function bindListing() {
    const btn = el('fm-parse-listing');
    const ta = el('fm-listing');
    if (btn && ta) {
      btn.addEventListener('click', () => setFiles(parseListing(ta.value), 'listing'));
    }
  }

  function bindGenerator() {
    const btn = el('fm-gen-run');
    const input = el('fm-gen');
    if (btn && input) {
      const gen = () => {
        const res = expandTemplate(input.value, GEN_CAP);
        const note = res.truncated ? t('files.gen.truncated', { cap: GEN_CAP }) : '';
        setFiles(res.files, 'generator', note);
      };
      btn.addEventListener('click', gen);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') gen(); });
    }
  }

  window.Modes.files = {
    name: '文件名',
    phase: 3,

    mount(panel) {
      panelRef = panel;
      panel.innerHTML = tpl();
      currentFiles = [];

      bindSourceTabs();
      bindText();
      bindPreset();
      bindFolder();
      bindListing();
      bindGenerator();

      onRegexChange = function () { runMatch(); };
      window.App.events.on('regex:change', onRegexChange);

      runMatch();
    },

    unmount() {
      if (onRegexChange) window.App.events.off('regex:change', onRegexChange);
      onRegexChange = null;
      clearTimeout(textTimer);
      panelRef = null;
      currentFiles = [];
    },
  };
})();
