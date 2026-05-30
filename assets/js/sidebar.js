/* ============================================================
 * sidebar.js — 侧边栏：速查表 / 常用库 / 历史 — Phase 8 实装
 * 数据来源：
 *   - window.RegexCheatsheet（data/cheatsheet.js）
 *   - window.RegexPresets（data/presets.js）
 *   - localStorage key 'rt:history'（自动写入，最多 50 条）
 *
 * 公开接口：
 *   Sidebar.render(container, tab)  根据 tab ('cheatsheet'|'presets'|'history') 渲染
 *   Sidebar.pushHistory(pattern, flags)  在 app.js 编译成功时调用
 * ============================================================ */
(function () {
  'use strict';

  const HISTORY_KEY = 'history';
  const HISTORY_MAX = 50;
  const PATTERN_TRUNC = 500;

  const t = (k, v) => window.I18n.t(k, v);
  const esc = (s) => window.Highlight.escape(s);
  const escAttr = (s) => esc(s).replace(/\n/g, '&#10;');

  function loadHistory() {
    if (!window.Storage) return [];
    const arr = window.Storage.get(HISTORY_KEY, []);
    return Array.isArray(arr) ? arr : [];
  }
  function saveHistory(arr) {
    if (window.Storage) window.Storage.set(HISTORY_KEY, arr);
  }

  /* ====================================================== */
  /* 渲染：速查表                                            */
  /* ====================================================== */
  function renderCheatsheet(container) {
    const data = window.RegexCheatsheet || [];
    const html = [];
    html.push('<div class="side-hint">' + esc(t('side.cs.hint')) + '</div>');
    data.forEach(cat => {
      html.push('<div class="side-section">');
      html.push('  <div class="side-cat">' + esc(t(cat.nameKey)) + '</div>');
      html.push('  <table class="cs-table">');
      cat.items.forEach(it => {
        html.push(
          '<tr class="cs-row" data-symbol="' + escAttr(it.symbol) + '">' +
          '<td class="cs-symbol"><code>' + esc(it.symbol) + '</code></td>' +
          '<td class="cs-desc">' + esc(t(it.descKey)) + '</td>' +
          '</tr>'
        );
      });
      html.push('  </table>');
      html.push('</div>');
    });
    container.innerHTML = html.join('');

    container.querySelectorAll('.cs-row').forEach(row => {
      row.addEventListener('click', () => copyToClipboard(row.dataset.symbol, row));
    });
  }

  function copyToClipboard(text, sourceEl) {
    const flash = () => {
      if (!sourceEl) return;
      sourceEl.classList.add('cs-copied');
      const toast = document.createElement('span');
      toast.className = 'cs-toast';
      toast.textContent = t('side.copied');
      sourceEl.appendChild(toast);
      setTimeout(() => {
        sourceEl.classList.remove('cs-copied');
        toast.remove();
      }, 900);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(flash).catch(() => fallbackCopy(text, flash));
    } else {
      fallbackCopy(text, flash);
    }
  }
  function fallbackCopy(text, cb) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      cb && cb();
    } catch (e) { /* ignore */ }
  }

  /* ====================================================== */
  /* 渲染：常用库                                            */
  /* ====================================================== */
  function renderPresets(container) {
    const data = window.RegexPresets || [];
    // 按 category 分组
    const groups = new Map();
    data.forEach(p => {
      if (!groups.has(p.category)) groups.set(p.category, []);
      groups.get(p.category).push(p);
    });
    const html = [];
    html.push('<div class="side-hint">' + esc(t('side.presets.hint')) + '</div>');
    groups.forEach((items, cat) => {
      html.push('<div class="side-section">');
      html.push('  <div class="side-cat">' + esc(t('pr.cat.' + cat)) + '</div>');
      items.forEach(p => {
        html.push(
          '<div class="pr-row" data-id="' + esc(p.id) + '">' +
          '  <div class="pr-row-head">' +
          '    <span class="pr-name">' + esc(t(p.nameKey)) + '</span>' +
          '    <button class="pr-use">' + esc(t('side.presets.use')) + '</button>' +
          '  </div>' +
          (p.descKey ? '  <div class="pr-desc">' + esc(t(p.descKey)) + '</div>' : '') +
          '  <code class="pr-pat" title="' + escAttr('/' + p.pattern + '/' + (p.flags || '')) + '">' +
                esc(truncate(p.pattern, 80)) + '</code>' +
          '</div>'
        );
      });
      html.push('</div>');
    });
    container.innerHTML = html.join('');

    container.querySelectorAll('.pr-row').forEach(row => {
      const id = row.dataset.id;
      const preset = data.find(p => p.id === id);
      if (!preset) return;
      const apply = () => applyPattern(preset.pattern, preset.flags || 'g');
      row.querySelector('.pr-use').addEventListener('click', apply);
      row.querySelector('.pr-pat').addEventListener('click', () => copyToClipboard(preset.pattern, row));
    });
  }

  function truncate(s, n) {
    s = String(s == null ? '' : s);
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  function applyPattern(pattern, flags) {
    const pin = document.getElementById('regex-pattern');
    const fin = document.getElementById('regex-flags');
    if (!pin) return;
    pin.value = pattern;
    if (fin) fin.value = flags;
    // 触发 App 的 syncFlagButtons + recompile
    if (window.App && typeof window.App.syncFlagButtons === 'function') {
      window.App.syncFlagButtons();
      window.App.recompile();
    }
    pin.focus();
  }

  /* ====================================================== */
  /* 渲染：历史                                              */
  /* ====================================================== */
  function renderHistory(container) {
    const arr = loadHistory();
    if (!arr.length) {
      container.innerHTML = '<div class="side-empty">' + esc(t('side.history.empty')) + '</div>';
      return;
    }
    const html = [];
    html.push(
      '<div class="side-hist-head">' +
      '  <span class="side-hint">' + arr.length + ' / ' + HISTORY_MAX + '</span>' +
      '  <button id="hist-clear" class="hist-clear">' + esc(t('side.history.clear')) + '</button>' +
      '</div>'
    );
    arr.forEach((entry, i) => {
      const ts = entry.ts ? new Date(entry.ts).toLocaleString() : '';
      html.push(
        '<div class="hist-row" data-idx="' + i + '">' +
        '  <div class="hist-row-head">' +
        '    <code class="hist-pat" title="' + escAttr('/' + entry.pattern + '/' + (entry.flags || '')) + '">' +
                esc(truncate(entry.pattern, 60)) + '</code>' +
        '    <span class="hist-flags">' + esc(entry.flags || '') + '</span>' +
        '  </div>' +
        '  <div class="hist-row-foot">' +
        '    <span class="hist-ts">' + esc(ts) + '</span>' +
        '    <span class="hist-actions">' +
        '      <button class="hist-use">' + esc(t('side.history.use')) + '</button>' +
        '      <button class="hist-del" title="' + escAttr(t('side.history.delete')) + '">×</button>' +
        '    </span>' +
        '  </div>' +
        '</div>'
      );
    });
    container.innerHTML = html.join('');

    container.querySelectorAll('.hist-row').forEach(row => {
      const i = parseInt(row.dataset.idx, 10);
      row.querySelector('.hist-use').addEventListener('click', () => {
        const e = arr[i];
        if (e) applyPattern(e.pattern, e.flags || '');
      });
      row.querySelector('.hist-del').addEventListener('click', () => {
        const next = loadHistory();
        next.splice(i, 1);
        saveHistory(next);
        renderHistory(container);
      });
      row.querySelector('.hist-pat').addEventListener('click', () => {
        const e = arr[i];
        if (e) copyToClipboard(e.pattern, row);
      });
    });
    const clearBtn = container.querySelector('#hist-clear');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      const n = arr.length;
      if (!confirm(t('side.history.confirmClear', { n: n }))) return;
      saveHistory([]);
      renderHistory(container);
    });
  }

  /* ====================================================== */
  /* 公开：pushHistory                                       */
  /* ====================================================== */
  function pushHistory(pattern, flags) {
    if (!pattern) return;
    const p = String(pattern).slice(0, PATTERN_TRUNC);
    const f = String(flags || '');
    let arr = loadHistory();
    // 去重：相同 pattern+flags 时把旧的删掉，新的放最前
    arr = arr.filter(e => !(e.pattern === p && (e.flags || '') === f));
    arr.unshift({ pattern: p, flags: f, ts: Date.now() });
    if (arr.length > HISTORY_MAX) arr = arr.slice(0, HISTORY_MAX);
    saveHistory(arr);
    // 如果当前侧边栏正显示 history，重新渲染
    if (window.App && window.App.state && window.App.state.sidebar === 'history') {
      const box = document.querySelector('.sidebar-content');
      if (box) renderHistory(box);
    }
  }

  const Sidebar = {
    render(container, tab) {
      if (!container) return;
      container.classList.remove('side-cheatsheet', 'side-presets', 'side-history');
      if (tab === 'cheatsheet') { container.classList.add('side-cheatsheet'); renderCheatsheet(container); }
      else if (tab === 'presets') { container.classList.add('side-presets'); renderPresets(container); }
      else if (tab === 'history') { container.classList.add('side-history'); renderHistory(container); }
    },
    pushHistory: pushHistory,
  };

  window.Sidebar = Sidebar;
})();
