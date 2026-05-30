/* ============================================================
 * 模式 7：批量正则对比 — Phase 5 实装
 * 共享一段测试文本，下方 2-4 行小正则输入，每行独立标志位。
 * 每行右边显示该正则的命中数 + 高亮预览；不同正则用不同颜色 (hl-g0..g5)。
 * 另外提供"叠加视图"：所有正则在同一段文本上同时高亮。
 * ============================================================ */
(function () {
  'use strict';

  window.Modes = window.Modes || {};
  const t = (k, v) => window.I18n.t(k, v);
  function esc(s) { return window.Highlight.escape(s); }
  function escAttr(s) { return esc(s).replace(/\n/g, '&#10;'); }

  const MIN_ROWS = 2;
  const MAX_ROWS = 4;

  function tpl() {
    return [
      '<div class="mode-card">',
      '  <div class="field">',
      '    <label class="field-label" for="cmp-text">',
      '      ' + esc(t('compare.textLabel')),
      '      <span class="field-hint">' + esc(t('compare.textHint')) + '</span>',
      '    </label>',
      '    <textarea id="cmp-text" class="test-input cmp-text" spellcheck="false" autocomplete="off"',
      '      placeholder="' + escAttr(t('compare.textPlaceholder')) + '"></textarea>',
      '  </div>',
      '  <div class="field">',
      '    <div class="cmp-rows-head">',
      '      <span class="field-label" style="display:inline">' + esc(t('compare.rowsLabel')) + '</span>',
      '      <button id="cmp-add" class="fm-btn cmp-add-btn">' + esc(t('compare.add')) + '</button>',
      '    </div>',
      '    <div id="cmp-rows" class="cmp-rows"></div>',
      '  </div>',
      '  <div class="field">',
      '    <label class="field-label">',
      '      ' + esc(t('compare.combined')),
      '      <span class="field-hint">' + esc(t('compare.combinedHint')) + '</span>',
      '    </label>',
      '    <div id="cmp-combined" class="result-box cmp-combined"></div>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  function rowTpl(idx) {
    const colorCls = 'hl-g' + (idx % 6);
    return [
      '<div class="cmp-row" data-row="' + idx + '">',
      '  <div class="cmp-row-head">',
      '    <span class="cp-chip-swatch ' + colorCls + '"></span>',
      '    <div class="cmp-regex-input">',
      '      <span class="delim">/</span>',
      '      <input type="text" class="cmp-pattern" spellcheck="false" autocomplete="off"',
      '        placeholder="' + escAttr(t('compare.regexPlaceholder')) + '" />',
      '      <span class="delim">/</span>',
      '      <input type="text" class="cmp-flags" spellcheck="false" autocomplete="off"',
      '        value="g" placeholder="' + escAttr(t('compare.flagsPlaceholder')) + '" />',
      '    </div>',
      '    <span class="cmp-count"></span>',
      '    <button class="cmp-remove icon-btn" data-i18n-title="compare.remove" title="' + escAttr(t('compare.remove')) + '">×</button>',
      '  </div>',
      '  <div class="cmp-preview result-box"></div>',
      '</div>',
    ].join('');
  }

  let panelRef = null;
  let textarea = null;
  let rowsContainer = null;
  let combinedBox = null;
  let addBtn = null;
  let onRegexChange = null;
  let timer = null;
  // 每行的状态（持久化用）
  let rowsState = []; // [{ pattern, flags }]

  function el(id) { return panelRef ? panelRef.querySelector('#' + id) : null; }
  function schedule() { clearTimeout(timer); timer = setTimeout(run, 100); }

  function loadState() {
    let saved = null;
    if (window.Storage) saved = Storage.get('compare:rows', null);
    if (Array.isArray(saved) && saved.length >= MIN_ROWS) {
      rowsState = saved.slice(0, MAX_ROWS).map(r => ({
        pattern: typeof r.pattern === 'string' ? r.pattern : '',
        flags: typeof r.flags === 'string' ? r.flags : 'g',
      }));
    } else {
      rowsState = [
        { pattern: '', flags: 'g' },
        { pattern: '', flags: 'g' },
      ];
    }
  }

  function saveState() {
    if (window.Storage) Storage.set('compare:rows', rowsState);
  }

  function renderRows() {
    rowsContainer.innerHTML = rowsState.map((_, i) => rowTpl(i)).join('');
    // 填值 + 绑定事件
    rowsState.forEach((r, i) => {
      const row = rowsContainer.querySelector('.cmp-row[data-row="' + i + '"]');
      if (!row) return;
      const pi = row.querySelector('.cmp-pattern');
      const fi = row.querySelector('.cmp-flags');
      const rm = row.querySelector('.cmp-remove');
      pi.value = r.pattern;
      fi.value = r.flags;
      pi.addEventListener('input', () => {
        rowsState[i].pattern = pi.value;
        saveState();
        schedule();
        // 实时反映正则有效性边框
        validateRow(row);
      });
      fi.addEventListener('input', () => {
        rowsState[i].flags = fi.value;
        saveState();
        schedule();
        validateRow(row);
      });
      rm.addEventListener('click', () => removeRow(i));
      rm.disabled = (rowsState.length <= MIN_ROWS);
      rm.style.opacity = rm.disabled ? '0.4' : '';
      validateRow(row);
    });
    updateAddBtn();
  }

  function validateRow(row) {
    const pat = row.querySelector('.cmp-pattern').value;
    const flg = row.querySelector('.cmp-flags').value;
    const wrap = row.querySelector('.cmp-regex-input');
    if (!pat) {
      wrap.classList.remove('has-error');
      return;
    }
    try { new RegExp(pat, flg); wrap.classList.remove('has-error'); }
    catch (e) { wrap.classList.add('has-error'); }
  }

  function addRow() {
    if (rowsState.length >= MAX_ROWS) return;
    rowsState.push({ pattern: '', flags: 'g' });
    saveState();
    renderRows();
    schedule();
  }

  function removeRow(i) {
    if (rowsState.length <= MIN_ROWS) return;
    rowsState.splice(i, 1);
    saveState();
    renderRows();
    schedule();
  }

  function updateAddBtn() {
    if (!addBtn) return;
    addBtn.disabled = (rowsState.length >= MAX_ROWS);
    addBtn.style.opacity = addBtn.disabled ? '0.5' : '';
  }

  function withFlag(flags, flag, on) {
    let f = (flags || '').split(flag).join('');
    if (on) f += flag;
    return f;
  }

  function setRowState(rowEl, state, content) {
    const cnt = rowEl.querySelector('.cmp-count');
    const prev = rowEl.querySelector('.cmp-preview');
    cnt.className = 'cmp-count cmp-count-' + state;
    cnt.textContent = '';
    prev.innerHTML = content;
  }

  function run() {
    if (!panelRef) return;
    const App = window.App;
    const text = textarea ? textarea.value : '';

    const rows = Array.from(rowsContainer.querySelectorAll('.cmp-row'));
    if (!text) {
      rows.forEach(r => setRowState(r, 'idle', '<span class="result-hint">' + esc(t('compare.empty')) + '</span>'));
      combinedBox.innerHTML = '<span class="result-hint">' + esc(t('compare.empty')) + '</span>';
      App.setStats(0, null);
      return;
    }

    // 逐行编译 + 执行（execWithTimeout 是并发安全的，可以并行 Promise.all）
    const startTotal = performance && performance.now ? performance.now() : Date.now();
    const promises = rows.map((rowEl, i) => {
      const st = rowsState[i] || { pattern: '', flags: 'g' };
      if (!st.pattern) {
        setRowState(rowEl, 'idle',
          '<span class="result-hint">' + esc(t('compare.emptyRegex')) + '</span>');
        return Promise.resolve({ matches: [], ok: true, empty: true });
      }
      let regex;
      try { regex = new RegExp(st.pattern, withFlag(st.flags, 'g', true)); }
      catch (e) {
        setRowState(rowEl, 'error',
          '<span class="result-hint result-error">' + esc(t('compare.invalidRegex', { msg: e.message })) + '</span>');
        return Promise.resolve({ matches: [], ok: false });
      }
      return Engine.execWithTimeout(regex, text, 1000).then(res => {
        if (res.error) {
          setRowState(rowEl, 'error',
            '<span class="result-hint result-error">' + esc(t('common.execError', { msg: res.error })) + '</span>');
          return { matches: [], ok: false };
        }
        if (res.timedOut) {
          setRowState(rowEl, 'warn',
            '<span class="result-hint result-warn">' + esc(t('common.timeout')) + '</span>');
          return { matches: [], ok: false };
        }
        const ranges = res.matches.map(m => ({ index: m.index, length: m.length, groupIdx: i % 6 }));
        const cntEl = rowEl.querySelector('.cmp-count');
        cntEl.textContent = window.I18n.matches(res.matches.length);
        cntEl.className = 'cmp-count cmp-count-ok';
        rowEl.querySelector('.cmp-preview').innerHTML = Highlight.render(text, ranges);
        return { matches: res.matches, ok: true, groupIdx: i % 6 };
      });
    });

    Promise.all(promises).then(results => {
      // 叠加视图：把每行的 ranges 合并，按颜色着色
      const all = [];
      let totalCount = 0;
      results.forEach((r, i) => {
        if (!r || !r.ok || !r.matches) return;
        totalCount += r.matches.length;
        r.matches.forEach(m => {
          all.push({ index: m.index, length: m.length, groupIdx: i % 6 });
        });
      });
      combinedBox.innerHTML = all.length
        ? Highlight.render(text, all)
        : Highlight.escape(text);

      const elapsed = (performance && performance.now ? performance.now() : Date.now()) - startTotal;
      App.setStats(totalCount, elapsed);
    });
  }

  window.Modes.compare = {
    name: '批量对比',
    phase: 5,

    mount(panel) {
      panelRef = panel;
      panel.innerHTML = tpl();
      textarea = panel.querySelector('#cmp-text');
      rowsContainer = panel.querySelector('#cmp-rows');
      combinedBox = panel.querySelector('#cmp-combined');
      addBtn = panel.querySelector('#cmp-add');

      // 还原共享文本
      if (window.Storage) {
        const saved = Storage.get('compare:text', '');
        if (typeof saved === 'string' && saved) textarea.value = saved;
      }
      textarea.addEventListener('input', () => {
        if (window.Storage) Storage.set('compare:text', textarea.value);
        schedule();
      });

      loadState();
      renderRows();

      addBtn.addEventListener('click', addRow);

      // 顶部全局正则的变化不影响本模式（compare 自己管 2-4 个正则），
      // 但还是接一下事件方便日后扩展（例如"把全局正则带入到行 1"等）
      onRegexChange = function () { /* no-op */ };
      window.App.events.on('regex:change', onRegexChange);

      run();
    },

    unmount() {
      if (onRegexChange) window.App.events.off('regex:change', onRegexChange);
      onRegexChange = null;
      clearTimeout(timer);
      panelRef = textarea = rowsContainer = combinedBox = addBtn = null;
      rowsState = [];
    },
  };
})();
