/* ============================================================
 * 模式 3：多文件名测试 — Phase 3 实装
 * 输入一组文件名，测试当前正则能命中哪些。
 * 5 种来源（子 tab 切换）：
 *   1. 逐行输入        2. 预置示例集      3. 拖拽/选择文件夹
 *   4. 粘贴 ls/dir/tree 5. 批量生成器
 * 结果分「命中」「未命中」两栏，顶部显示统计。
 * ============================================================ */
(function () {
  'use strict';

  window.Modes = window.Modes || {};

  const LIST_CAP = 2000;   // 每栏最多渲染条数
  const GEN_CAP = 2000;    // 生成器最多产出
  const FILES_CAP = 8000;  // 文件夹/列表导入上限

  const TPL = [
    '<div class="mode-card">',
    '  <div class="fm-sources">',
    '    <div class="fm-srctabs" id="fm-srctabs">',
    '      <button class="fm-srctab active" data-src="text">逐行输入</button>',
    '      <button class="fm-srctab" data-src="preset">示例集</button>',
    '      <button class="fm-srctab" data-src="folder">文件夹</button>',
    '      <button class="fm-srctab" data-src="listing">粘贴 ls/dir/tree</button>',
    '      <button class="fm-srctab" data-src="generator">批量生成</button>',
    '    </div>',

    '    <div class="fm-srcpanel is-active" data-src="text">',
    '      <textarea id="fm-text" class="test-input" spellcheck="false" autocomplete="off"',
    '        placeholder="每行一个文件名，例如：\nApp.tsx\nindex.html\nREADME.md"></textarea>',
    '      <div class="fm-srcnote" id="fm-note-text"></div>',
    '    </div>',

    '    <div class="fm-srcpanel" data-src="preset">',
    '      <label class="field-label" for="fm-preset">选择一套示例文件集</label>',
    '      <select id="fm-preset" class="fm-select"></select>',
    '      <div class="fm-srcnote" id="fm-note-preset"></div>',
    '    </div>',

    '    <div class="fm-srcpanel" data-src="folder">',
    '      <div id="fm-drop" class="fm-drop">',
    '        <p>把文件夹拖到这里，或</p>',
    '        <label class="fm-btn"><input type="file" id="fm-folder" webkitdirectory directory multiple hidden />选择文件夹</label>',
    '        <p class="fm-srcnote">只读取文件名，不读取文件内容。</p>',
    '      </div>',
    '      <div class="fm-srcnote" id="fm-note-folder"></div>',
    '    </div>',

    '    <div class="fm-srcpanel" data-src="listing">',
    '      <textarea id="fm-listing" class="test-input" spellcheck="false" autocomplete="off"',
    '        placeholder="粘贴 ls -l / Windows dir / tree 的输出，自动提取文件名…"></textarea>',
    '      <div class="fm-row">',
    '        <button class="fm-btn" id="fm-parse-listing">解析</button>',
    '        <span class="fm-srcnote">支持 ls -l、dir、tree 三种格式（尽力解析）。</span>',
    '      </div>',
    '      <div class="fm-srcnote" id="fm-note-listing"></div>',
    '    </div>',

    '    <div class="fm-srcpanel" data-src="generator">',
    '      <label class="field-label" for="fm-gen">生成模板（{0001-9999} 数字区间、{a,b,c} 枚举）</label>',
    '      <div class="fm-row">',
    '        <input type="text" id="fm-gen" class="fm-input" spellcheck="false"',
    '          placeholder="IMG_{0001-0020}.{jpg,png}" value="IMG_{0001-0020}.{jpg,png}" />',
    '        <button class="fm-btn" id="fm-gen-run">生成</button>',
    '      </div>',
    '      <div class="fm-srcnote" id="fm-note-generator"></div>',
    '    </div>',
    '  </div>',

    '  <div class="field">',
    '    <div class="fm-stats" id="fm-stats">尚无文件名。</div>',
    '    <div class="fm-cols">',
    '      <div class="fm-col">',
    '        <div class="fm-col-head fm-head-hit">命中 <span id="fm-hit-n">0</span></div>',
    '        <div class="fm-list" id="fm-hit-list"></div>',
    '      </div>',
    '      <div class="fm-col">',
    '        <div class="fm-col-head fm-head-miss">未命中 <span id="fm-miss-n">0</span></div>',
    '        <div class="fm-list" id="fm-miss-list"></div>',
    '      </div>',
    '    </div>',
    '  </div>',
    '</div>',
  ].join('\n');

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
    const arrow = s.indexOf(' -> ');           // ls 软链接 link -> target
    if (arrow !== -1) s = s.slice(0, arrow);
    s = s.replace(/[\/*@=|>]$/, '');            // ls -F 后缀指示符
    s = s.replace(/^["']|["']$/g, '');          // 去除外层引号
    return s.trim();
  }

  function parseLines(text) {
    return dedupe(
      text.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    );
  }

  // 解析 ls -l / dir / tree 输出
  function parseListing(text) {
    const names = [];
    const lines = text.split(/\r?\n/);
    const isTreeLine = (l) => /[─-╿]/.test(l) || /(`--|\|--|\+--)/.test(l);

    for (const raw of lines) {
      if (!raw.trim()) continue;
      const line = raw;

      // 跳过明显的头部/汇总行
      if (/^total\s+\d+/i.test(line)) continue;
      if (/Volume in drive|Volume Serial|Directory of|个目录|个文件|File\(s\)|Dir\(s\)|bytes free|可用字节/i.test(line)) continue;

      // tree：剥离前缀连接符
      if (isTreeLine(line)) {
        const stripped = line.replace(/^[\s─-╿`|+\\.-]+/, '').trim();
        if (stripped) names.push(cleanName(stripped));
        continue;
      }

      // ls -l：权限位开头，名字在第 8 个字段之后
      const ls = line.match(/^[-dlbcps][rwxsStT.+-]{9,}\s+\d+\s+\S+\s+\S+\s+[\d.,]+\s+\S+\s+\S+\s+\S+\s+(.+)$/);
      if (ls) { names.push(cleanName(ls[1])); continue; }

      // Windows dir：日期 时间 <DIR>|大小 名字
      const dir = line.match(/^\d{2,4}[\/-]\d{2}[\/-]\d{2,4}\s+\d{1,2}:\d{2}(?:\s*[APap][Mm])?\s+(?:<DIR>|<JUNCTION>|[\d.,]+)\s+(.+)$/);
      if (dir) {
        const nm = cleanName(dir[1]);
        if (nm !== '.' && nm !== '..') names.push(nm);
        continue;
      }

      // 兜底：整行当作一个文件名
      const nm = cleanName(line.trim());
      if (nm && nm !== '.' && nm !== '..') names.push(nm);
    }
    return dedupe(names);
  }

  // 批量生成器
  function expandGroup(g) {
    let m = g.match(/^(\d+)-(\d+)$/);            // 数字区间（含补零）
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
    m = g.match(/^([a-zA-Z])-([a-zA-Z])$/);      // 字母区间
    if (m) {
      const a = m[1].charCodeAt(0), b = m[2].charCodeAt(0);
      const out = [];
      const step = a <= b ? 1 : -1;
      for (let i = a; step > 0 ? i <= b : i >= b; i += step) out.push(String.fromCharCode(i));
      return out;
    }
    if (g.indexOf(',') !== -1) return g.split(',');  // 枚举
    return [g];                                       // 字面量
  }

  function expandTemplate(tpl, cap) {
    cap = cap || GEN_CAP;
    const parts = [];
    const re = /\{([^}]*)\}/g;
    let last = 0, m;
    while ((m = re.exec(tpl)) !== null) {
      if (m.index > last) parts.push([tpl.slice(last, m.index)]);
      parts.push(expandGroup(m[1]));
      last = m.index + m[0].length;
    }
    if (last < tpl.length) parts.push([tpl.slice(last)]);
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

  // 返回名字内的命中区间数组；空数组表示未命中
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
      let t = '已载入 ' + currentFiles.length + ' 个文件名';
      if (arr.length > FILES_CAP) t += '（超过 ' + FILES_CAP + ' 已截断）';
      if (extraNote) t += '　' + extraNote;
      note.textContent = t;
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
      frag.push('<div class="fm-more">… 还有 ' + (items.length - shown) + ' 个</div>');
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
      stats.textContent = '尚无文件名。请在上方任一来源里提供文件名。';
      hitList.innerHTML = '<div class="fm-empty">—</div>';
      missList.innerHTML = '<div class="fm-empty">—</div>';
      hitN.textContent = '0'; missN.textContent = '0';
      App.setStats(0, null);
      return;
    }

    if (err) {
      stats.innerHTML = '<span class="result-error">正则有误：' + Highlight.escape(err) + '</span>';
      hitList.innerHTML = '<div class="fm-empty">—</div>';
      missList.innerHTML = '';
      listHtml(currentFiles.map(n => ({ name: n })), missList, false);
      hitN.textContent = '0'; missN.textContent = String(total);
      App.setStats(null, null);
      return;
    }

    if (!regex) {
      stats.innerHTML = '总计 <b>' + total + '</b> 个文件名 · 输入正则后区分命中 / 未命中';
      hitList.innerHTML = '<div class="fm-empty">（未应用正则）</div>';
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
      '<b class="fm-stat-hit">' + hits.length + '</b> 命中 / ' +
      '<b class="fm-stat-miss">' + misses.length + '</b> 未命中 / 总计 <b>' + total + '</b>';
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
        tabs.forEach(t => t.classList.remove('active'));
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
    const handler = () => {
      clearTimeout(textTimer);
      textTimer = setTimeout(() => {
        if (window.Storage) Storage.set('files:text', ta.value);
        setFiles(parseLines(ta.value), 'text');
      }, 200);
    };
    ta.addEventListener('input', handler);
    if (ta.value) setFiles(parseLines(ta.value), 'text');
  }

  function bindPreset() {
    const sel = el('fm-preset');
    if (!sel) return;
    const samples = window.FileSamples || [];
    let html = '<option value="">— 请选择 —</option>';
    samples.forEach(s => {
      html += '<option value="' + Highlight.escape(s.id) + '">' +
        Highlight.escape(s.name) + '（' + s.files.length + '）</option>';
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
        const note = res.truncated ? ('已达上限 ' + GEN_CAP + ' 条，已截断') : '';
        setFiles(res.files, 'generator', note);
      };
      btn.addEventListener('click', gen);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') gen(); });
    }
  }

  /* ---------- 模式接口 ---------- */

  window.Modes.files = {
    name: '文件名',
    phase: 3,

    mount(panel) {
      panelRef = panel;
      panel.innerHTML = TPL;
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
