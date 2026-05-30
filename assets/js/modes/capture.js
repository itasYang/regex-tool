/* ============================================================
 * 模式 6：捕获组 — Phase 5 实装
 * 每个捕获组（含命名捕获）用不同颜色（hl-g0..hl-g5）高亮。
 * 下方列出所有匹配的表格：序号 / 位置 / 长度 / 完整匹配 / 各组的值。
 *
 * 策略：在本模式内部把 'd' 标志强制加进 flags，以便从 m.indices
 * 拿到每个组的位置区间用于精确分色。Engine 已序列化 groupIndices。
 * ============================================================ */
(function () {
  'use strict';

  window.Modes = window.Modes || {};
  const t = (k, v) => window.I18n.t(k, v);
  function esc(s) { return window.Highlight.escape(s); }
  function escAttr(s) { return esc(s).replace(/\n/g, '&#10;'); }

  const MAX_TABLE_ROWS = 200;

  function tpl() {
    return [
      '<div class="mode-card">',
      '  <div class="field">',
      '    <label class="field-label" for="cp-text">',
      '      ' + esc(t('capture.textLabel')),
      '      <span class="field-hint">' + esc(t('capture.textHint')) + '</span>',
      '    </label>',
      '    <textarea id="cp-text" class="test-input" spellcheck="false" autocomplete="off"',
      '      placeholder="' + escAttr(t('capture.textPlaceholder')) + '"></textarea>',
      '  </div>',
      '  <div class="field">',
      '    <label class="field-label">',
      '      ' + esc(t('capture.resultLabel')),
      '      <span class="field-hint" id="cp-count"></span>',
      '    </label>',
      '    <div id="cp-result" class="result-box cp-result"></div>',
      '  </div>',
      '  <div class="field" id="cp-legend-wrap" hidden>',
      '    <label class="field-label">' + esc(t('capture.groupsLabel')) + '</label>',
      '    <div id="cp-legend" class="cp-legend"></div>',
      '  </div>',
      '  <div class="field" id="cp-table-wrap" hidden>',
      '    <label class="field-label">',
      '      ' + esc(t('capture.tableLabel')),
      '      <span class="field-hint" id="cp-table-note"></span>',
      '    </label>',
      '    <div id="cp-table" class="cp-table-scroll"></div>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  let panelRef = null;
  let textarea = null;
  let resultBox = null;
  let countEl = null;
  let legendWrap = null;
  let legendBox = null;
  let tableWrap = null;
  let tableBox = null;
  let tableNote = null;
  let onRegexChange = null;
  let timer = null;

  function schedule() { clearTimeout(timer); timer = setTimeout(run, 80); }

  function withFlag(flags, flag, on) {
    let f = (flags || '').split(flag).join('');
    if (on) f += flag;
    return f;
  }

  /**
   * 从一个正则的 source 里数出捕获组数量与命名（按出现顺序）。
   * 跳过 (?:...) (?=...) (?!...) (?<=...) (?<!...) 这些非捕获/断言。
   * 命名 (?<name>...) 也算捕获组。
   * 仅扫描语法上确实出现的"打开的捕获括号"，跳过转义 \(。
   */
  function analyzeGroups(source) {
    const out = []; // [{ index: 1-based, name?: string }]
    let i = 0;
    const n = source.length;
    let inClass = false;
    while (i < n) {
      const c = source[i];
      if (c === '\\') { i += 2; continue; } // 跳过转义
      if (inClass) {
        if (c === ']') inClass = false;
        i++; continue;
      }
      if (c === '[') { inClass = true; i++; continue; }
      if (c === '(') {
        // 检测 (?:...) (?=...) (?!...) (?<=...) (?<!...) (?<name>...)
        if (source[i + 1] === '?') {
          const c2 = source[i + 2];
          if (c2 === ':' || c2 === '=' || c2 === '!') { i += 3; continue; }
          if (c2 === '<') {
            const c3 = source[i + 3];
            if (c3 === '=' || c3 === '!') { i += 4; continue; }
            // (?<name>...) — 命名捕获
            const end = source.indexOf('>', i + 3);
            const name = end > i + 3 ? source.slice(i + 3, end) : '';
            out.push({ index: out.length + 1, name: name });
            i = end >= 0 ? end + 1 : i + 3;
            continue;
          }
          // 其它 (?xxx — 保守当成不影响捕获索引
          i += 2;
          continue;
        }
        // 普通捕获 (
        out.push({ index: out.length + 1 });
        i++;
        continue;
      }
      i++;
    }
    return out;
  }

  /**
   * 把一次匹配的各组区间合并为高亮 ranges 数组。
   * 优先按组着色（用 hl-g{(idx-1) mod 6}），未捕获到的组跳过。
   * 整体匹配本身不再额外加 mark，避免和组重叠（组覆盖匹配主体的常见部分）。
   * 但匹配里组没覆盖的字符也得高亮 —— 用 hl-g0 之外的方式？
   *   策略：先用淡色覆盖整段匹配（用 .hl 默认色），再按组覆盖局部。
   *   实现上 Highlight.render 按起点排序、嵌套时丢弃后到。所以为了让组色生效，
   *   要把组 range 放在整段 range 之前 → 但 render 不支持嵌套，会被外层吞掉。
   * 改方案：手动切分 —— 对每次匹配，按组区间切成若干片段，每片单独 mark：
   *   - 落在某组里的字符 → 该组色
   *   - 不在任何组里、但仍在整段匹配里的字符 → 默认 .hl 色
   */
  function buildHighlightHTML(text, matches) {
    if (!matches.length) return Highlight.escape(text);
    // 收集所有非空区间：{ start, end, groupIdx | null }
    // 注意：组可能嵌套，但我们按组的出现顺序优先级（外层组先到，内层组覆盖更精细），
    // 这里采用"内层优先"启发：按区间长度从大到小铺底，短的覆盖长的。
    const intervals = [];
    matches.forEach(m => {
      const start = m.index;
      const end = start + (m.length || 0);
      // 整段匹配 fallback（最底层，用 null 表示用 .hl 默认色）
      intervals.push({ start, end, groupIdx: null, priority: 0 });
      const gIdx = m.groupIndices;
      if (gIdx) {
        for (let i = 1; i < gIdx.length; i++) {
          const p = gIdx[i];
          if (!p) continue;
          const s = p[0]; const e = p[1];
          if (s == null || e == null || e <= s) continue;
          intervals.push({ start: s, end: e, groupIdx: ((i - 1) % 6), priority: i });
        }
      }
    });
    if (!intervals.length) return Highlight.escape(text);

    // 按 priority 从低到高排：低 priority 先铺，后到的高 priority 覆盖。
    intervals.sort((a, b) => a.priority - b.priority || a.start - b.start);

    // 构造像素图：对每个字符位置取最后一层覆盖。零宽匹配单独处理。
    const layer = new Array(text.length).fill(-1); // -1 表示无覆盖
    const meta = new Map(); // layerIdx → groupIdx | null
    intervals.forEach((iv, idx) => {
      meta.set(idx, iv.groupIdx);
      for (let p = iv.start; p < iv.end && p < text.length; p++) {
        layer[p] = idx;
      }
    });

    // 零宽匹配单独标记：start === end 的整段匹配
    const zeroMarks = [];
    matches.forEach(m => {
      if (!m.length) zeroMarks.push(m.index);
    });

    // 沿 layer 数组扫描，把连续相同层的字符并成一段 mark
    let html = '';
    let i = 0;
    function appendZeroIfHere(pos) {
      while (zeroMarks.length && zeroMarks[0] === pos) {
        zeroMarks.shift();
        html += '<mark class="hl hl-empty" title="zero-width"></mark>';
      }
    }
    while (i < text.length) {
      appendZeroIfHere(i);
      const cur = layer[i];
      if (cur === -1) {
        // 找一段连续无覆盖
        let j = i;
        while (j < text.length && layer[j] === -1) j++;
        html += Highlight.escape(text.slice(i, j));
        i = j;
      } else {
        let j = i;
        while (j < text.length && layer[j] === cur) j++;
        const g = meta.get(cur);
        const cls = (g == null) ? 'hl' : ('hl hl-g' + g);
        html += '<mark class="' + cls + '">' + Highlight.escape(text.slice(i, j)) + '</mark>';
        i = j;
      }
    }
    appendZeroIfHere(text.length);
    return html;
  }

  function renderLegend(groupInfo) {
    if (!groupInfo.length) {
      legendWrap.hidden = true;
      return;
    }
    legendWrap.hidden = false;
    const items = groupInfo.map(g => {
      const cls = 'hl-g' + ((g.index - 1) % 6);
      const label = t('capture.group', { n: g.index });
      const named = g.name ? ' <span class="cp-chip-name">' + esc(t('capture.named', { name: g.name })) + '</span>' : '';
      return '<span class="cp-chip">' +
             '<span class="cp-chip-swatch ' + cls + '"></span>' +
             '<span class="cp-chip-label">' + esc(label) + '</span>' +
             named +
             '</span>';
    });
    legendBox.innerHTML = items.join('');
  }

  function renderTable(matches, groupInfo) {
    if (!matches.length) {
      tableWrap.hidden = false;
      tableBox.innerHTML = '<div class="cp-table-empty">' + esc(t('capture.emptyTable')) + '</div>';
      if (tableNote) tableNote.textContent = '';
      return;
    }
    tableWrap.hidden = false;

    const shown = matches.slice(0, MAX_TABLE_ROWS);
    if (tableNote) {
      tableNote.textContent = (matches.length > MAX_TABLE_ROWS)
        ? t('capture.tableMore', { n: shown.length, total: matches.length })
        : '';
    }

    const headCells = [
      '<th class="cp-th-num">' + esc(t('capture.col.idx')) + '</th>',
      '<th class="cp-th-num">' + esc(t('capture.col.index')) + '</th>',
      '<th class="cp-th-num">' + esc(t('capture.col.length')) + '</th>',
      '<th>' + esc(t('capture.col.match')) + '</th>',
    ];
    groupInfo.forEach(g => {
      const cls = 'hl-g' + ((g.index - 1) % 6);
      const title = g.name
        ? esc(t('capture.col.group', { n: g.index })) + ' <span class="cp-chip-name">' + esc(g.name) + '</span>'
        : esc(t('capture.col.group', { n: g.index }));
      headCells.push('<th><span class="cp-chip-swatch ' + cls + '"></span> ' + title + '</th>');
    });

    const rows = shown.map((m, i) => {
      const cells = [
        '<td class="cp-td-num">' + (i + 1) + '</td>',
        '<td class="cp-td-num">' + m.index + '</td>',
        '<td class="cp-td-num">' + (m.length || 0) + '</td>',
        '<td class="cp-td-mono">' + renderCell(m.match, null) + '</td>',
      ];
      groupInfo.forEach(g => {
        const v = m.groups ? m.groups[g.index - 1] : undefined;
        cells.push('<td class="cp-td-mono">' + renderCell(v, (g.index - 1) % 6) + '</td>');
      });
      return '<tr>' + cells.join('') + '</tr>';
    });

    tableBox.innerHTML =
      '<table class="cp-table">' +
      '<thead><tr>' + headCells.join('') + '</tr></thead>' +
      '<tbody>' + rows.join('') + '</tbody>' +
      '</table>';
  }

  function renderCell(value, colorIdx) {
    if (value === undefined) return '<span class="cp-cell-undef">' + esc(t('capture.groupUndef')) + '</span>';
    if (value === '') return '<span class="cp-cell-empty">' + esc(t('capture.groupEmpty')) + '</span>';
    const cls = (colorIdx == null) ? 'hl' : ('hl hl-g' + colorIdx);
    return '<mark class="' + cls + '">' + esc(value) + '</mark>';
  }

  function run() {
    if (!resultBox) return;
    const App = window.App;
    const text = textarea ? textarea.value : '';
    const baseRegex = App.state.regex;
    const err = App.state.regexError;

    if (err) {
      resultBox.innerHTML = '<span class="result-hint result-error">' + esc(t('common.regexError', { msg: err })) + '</span>';
      if (countEl) countEl.textContent = '';
      legendWrap.hidden = true;
      tableWrap.hidden = true;
      App.setStats(null, null);
      return;
    }

    if (!baseRegex || !App.state.pattern) {
      resultBox.innerHTML = text
        ? Highlight.escape(text)
        : '<span class="result-hint">' + esc(t('capture.emptyHint')) + '</span>';
      if (countEl) countEl.textContent = '';
      legendWrap.hidden = true;
      tableWrap.hidden = true;
      App.setStats(0, null);
      return;
    }

    const groupInfo = analyzeGroups(baseRegex.source);
    if (!groupInfo.length) {
      // 没有捕获组 —— 退化为整段匹配高亮 + 提示
      runWithoutGroups(text);
      return;
    }

    // 强制加 g 和 d，前者拿到全部匹配，后者拿到组索引
    let regex;
    try {
      const flags = withFlag(withFlag(baseRegex.flags, 'g', true), 'd', true);
      regex = new RegExp(baseRegex.source, flags);
    } catch (e) {
      // 引擎不支持 'd' 标志？回退到无组索引模式
      try {
        regex = new RegExp(baseRegex.source, withFlag(baseRegex.flags, 'g', true));
      } catch (e2) {
        resultBox.innerHTML = '<span class="result-hint result-error">' + esc(t('common.regexError', { msg: e2.message })) + '</span>';
        legendWrap.hidden = true;
        tableWrap.hidden = true;
        App.setStats(null, null);
        return;
      }
    }

    Engine.execWithTimeout(regex, text, 1000).then(function (res) {
      if (!resultBox || !document.body.contains(resultBox)) return;

      if (res.error) {
        resultBox.innerHTML = '<span class="result-hint result-error">' + esc(t('common.execError', { msg: res.error })) + '</span>';
        if (countEl) countEl.textContent = '';
        legendWrap.hidden = true;
        tableWrap.hidden = true;
        App.setStats(null, null);
        return;
      }
      if (res.timedOut) {
        resultBox.innerHTML = '<span class="result-hint result-warn">' + esc(t('common.timeout')) + '</span>';
        if (countEl) countEl.textContent = t('common.aborted');
        legendWrap.hidden = true;
        tableWrap.hidden = true;
        App.setStats(null, res.elapsed);
        App.setRegexStatus('warn', t('status.timeout'));
        return;
      }

      const matches = res.matches;
      if (!text) {
        resultBox.innerHTML = '<span class="result-hint">' + esc(t('single.emptyText')) + '</span>';
      } else {
        resultBox.innerHTML = buildHighlightHTML(text, matches);
      }
      renderLegend(groupInfo);
      renderTable(matches, groupInfo);

      const n = matches.length;
      if (countEl) countEl.textContent = window.I18n.matches(n);
      App.setStats(n, res.elapsed);
    });
  }

  // 正则没有捕获组时的退化路径：只高亮整段匹配，并给出提示
  function runWithoutGroups(text) {
    const App = window.App;
    const baseRegex = App.state.regex;
    let regex;
    try { regex = new RegExp(baseRegex.source, withFlag(baseRegex.flags, 'g', true)); }
    catch (e) { regex = baseRegex; }

    Engine.execWithTimeout(regex, text, 1000).then(function (res) {
      if (!resultBox || !document.body.contains(resultBox)) return;
      if (res.error) {
        resultBox.innerHTML = '<span class="result-hint result-error">' + esc(t('common.execError', { msg: res.error })) + '</span>';
        legendWrap.hidden = true;
        tableWrap.hidden = true;
        App.setStats(null, null);
        return;
      }
      const ranges = res.matches.map(m => ({ index: m.index, length: m.length }));
      const noteHTML = '<div class="cp-no-groups">' + esc(t('capture.noGroups')) + '</div>';
      const body = text ? Highlight.render(text, ranges) : esc(t('single.emptyText'));
      resultBox.innerHTML = noteHTML + '<div class="cp-no-groups-body">' + body + '</div>';
      legendWrap.hidden = true;
      tableWrap.hidden = true;
      const n = res.matches.length;
      if (countEl) countEl.textContent = window.I18n.matches(n);
      App.setStats(n, res.elapsed);
    });
  }

  window.Modes.capture = {
    name: '捕获组',
    phase: 5,

    mount(panel) {
      panelRef = panel;
      panel.innerHTML = tpl();
      textarea = panel.querySelector('#cp-text');
      resultBox = panel.querySelector('#cp-result');
      countEl = panel.querySelector('#cp-count');
      legendWrap = panel.querySelector('#cp-legend-wrap');
      legendBox = panel.querySelector('#cp-legend');
      tableWrap = panel.querySelector('#cp-table-wrap');
      tableBox = panel.querySelector('#cp-table');
      tableNote = panel.querySelector('#cp-table-note');

      if (window.Storage) {
        const saved = Storage.get('capture:text', '');
        if (typeof saved === 'string' && saved) textarea.value = saved;
      }

      textarea.addEventListener('input', function () {
        if (window.Storage) Storage.set('capture:text', textarea.value);
        schedule();
      });

      onRegexChange = function () { schedule(); };
      window.App.events.on('regex:change', onRegexChange);

      run();
    },

    unmount() {
      if (onRegexChange) window.App.events.off('regex:change', onRegexChange);
      onRegexChange = null;
      clearTimeout(timer);
      panelRef = textarea = resultBox = countEl = null;
      legendWrap = legendBox = tableWrap = tableBox = tableNote = null;
    },
  };
})();
