/* ============================================================
 * 模式 4：替换 — Phase 4 实装
 * 原文 + 替换串（支持 $1 $2 $<name>），三栏对比：
 *   原文（命中高亮） / 替换串模板 / 替换结果。
 * 可切「全部替换」(强制 g) 与「逐个替换」(去掉 g，只替第一处)。
 * ============================================================ */
(function () {
  'use strict';

  window.Modes = window.Modes || {};
  const t = (k, v) => window.I18n.t(k, v);
  function esc(s) { return window.Highlight.escape(s); }
  function escAttr(s) { return esc(s).replace(/\n/g, '&#10;'); }

  function tpl() {
    return [
      '<div class="mode-card">',
      '  <div class="field">',
      '    <label class="field-label" for="rp-src">',
      '      ' + esc(t('replace.srcLabel')),
      '      <span class="field-hint">' + esc(t('replace.srcHint')) + '</span>',
      '    </label>',
      '    <textarea id="rp-src" class="test-input" spellcheck="false" autocomplete="off"',
      '      placeholder="' + escAttr(t('replace.srcPlaceholder')) + '"></textarea>',
      '  </div>',
      '  <div class="field">',
      '    <label class="field-label" for="rp-repl">',
      '      ' + esc(t('replace.replLabel')),
      '      <span class="field-hint">' + esc(t('replace.replHint')) + '</span>',
      '    </label>',
      '    <input type="text" id="rp-repl" class="fm-input rp-repl" spellcheck="false" autocomplete="off"',
      '      placeholder="' + escAttr(t('replace.replPlaceholder')) + '" />',
      '  </div>',
      '  <div class="rp-modes">',
      '    <label class="rp-mode"><input type="radio" name="rp-mode" value="all" checked /> ' + esc(t('replace.modeAll')) + '</label>',
      '    <label class="rp-mode"><input type="radio" name="rp-mode" value="first" /> ' + esc(t('replace.modeFirst')) + '</label>',
      '    <span class="field-hint" id="rp-count"></span>',
      '  </div>',
      '  <div class="rp-cols">',
      '    <div class="rp-col">',
      '      <div class="rp-col-head">' + esc(t('replace.colOriginal')) + '</div>',
      '      <div id="rp-original" class="result-box rp-box"></div>',
      '    </div>',
      '    <div class="rp-col">',
      '      <div class="rp-col-head">' + esc(t('replace.colTemplate')) + '</div>',
      '      <div id="rp-template" class="result-box rp-box"></div>',
      '    </div>',
      '    <div class="rp-col">',
      '      <div class="rp-col-head">' + esc(t('replace.colResult')) + '</div>',
      '      <div id="rp-result" class="result-box rp-box"></div>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  let panelRef = null;
  let onRegexChange = null;
  let timer = null;

  function el(id) { return panelRef ? panelRef.querySelector('#' + id) : null; }
  function schedule() { clearTimeout(timer); timer = setTimeout(run, 80); }

  function currentMode() {
    const r = panelRef && panelRef.querySelector('input[name="rp-mode"]:checked');
    return r ? r.value : 'all';
  }

  function withFlag(flags, flag, on) {
    let f = flags.split(flag).join('');
    if (on) f += flag;
    return f;
  }

  function run() {
    if (!panelRef) return;
    const App = window.App;
    const orig = el('rp-original');
    const tmpl = el('rp-template');
    const out = el('rp-result');
    const countEl = el('rp-count');
    if (!orig || !tmpl || !out) return;

    const src = (el('rp-src') || {}).value || '';
    const repl = (el('rp-repl') || {}).value || '';
    const regex = App.state.regex;
    const err = App.state.regexError;

    tmpl.textContent = repl;
    if (countEl) countEl.textContent = '';

    if (err) {
      orig.innerHTML = '<span class="result-hint result-error">' + esc(t('common.regexError', { msg: err })) + '</span>';
      out.innerHTML = '';
      App.setStats(null, null);
      return;
    }

    if (!regex || !App.state.pattern || !src) {
      orig.innerHTML = src ? Highlight.escape(src)
        : '<span class="result-hint">' + esc(t('replace.emptyHint')) + '</span>';
      out.innerHTML = src ? Highlight.escape(src) : '';
      App.setStats(0, null);
      return;
    }

    const mode = currentMode();
    // 用 g 版正则取全部命中（用于高亮与计数）
    const gFlags = withFlag(regex.flags, 'g', true);
    let gRegex;
    try { gRegex = new RegExp(regex.source, gFlags); }
    catch (e) { gRegex = regex; }

    Engine.execWithTimeout(gRegex, src, 1000).then(function (res) {
      if (!orig || !document.body.contains(orig)) return;

      if (res.error) {
        orig.innerHTML = '<span class="result-hint result-error">' + esc(t('common.execError', { msg: res.error })) + '</span>';
        out.innerHTML = '';
        App.setStats(null, null);
        return;
      }
      if (res.timedOut) {
        orig.innerHTML = '<span class="result-hint result-warn">' + esc(t('common.timeout')) + '</span>';
        out.innerHTML = '';
        App.setStats(null, res.elapsed);
        App.setRegexStatus('warn', t('status.timeout'));
        return;
      }

      const all = res.matches;
      const highlightRanges = (mode === 'first' ? all.slice(0, 1) : all)
        .map(m => ({ index: m.index, length: m.length }));
      orig.innerHTML = Highlight.render(src, highlightRanges);

      // 实际替换：all → 强制 g；first → 去掉 g（只替第一处）
      let replaced = src;
      try {
        const effFlags = withFlag(regex.flags, 'g', mode === 'all');
        const effRegex = new RegExp(regex.source, effFlags);
        replaced = src.replace(effRegex, repl);
      } catch (e) {
        out.innerHTML = '<span class="result-hint result-error">' + esc(t('common.execError', { msg: e.message })) + '</span>';
        App.setStats(null, res.elapsed);
        return;
      }
      out.innerHTML = Highlight.escape(replaced);

      const n = (mode === 'first') ? Math.min(1, all.length) : all.length;
      if (countEl) {
        countEl.textContent = (window.I18n.lang === 'en' && n === 1)
          ? t('replace.replaced1', { n: n })
          : t('replace.replacedN', { n: n });
      }
      App.setStats(n, res.elapsed);
    });
  }

  window.Modes.replace = {
    name: '替换',
    phase: 4,

    mount(panel) {
      panelRef = panel;
      panel.innerHTML = tpl();

      const src = el('rp-src');
      const repl = el('rp-repl');
      if (window.Storage) {
        const s = Storage.get('replace:src', '');
        const r = Storage.get('replace:repl', '');
        if (typeof s === 'string' && s) src.value = s;
        if (typeof r === 'string' && r) repl.value = r;
      }

      src.addEventListener('input', () => {
        if (window.Storage) Storage.set('replace:src', src.value);
        schedule();
      });
      repl.addEventListener('input', () => {
        if (window.Storage) Storage.set('replace:repl', repl.value);
        schedule();
      });
      panel.querySelectorAll('input[name="rp-mode"]').forEach(r => {
        r.addEventListener('change', schedule);
      });

      onRegexChange = function () { schedule(); };
      window.App.events.on('regex:change', onRegexChange);

      run();
    },

    unmount() {
      if (onRegexChange) window.App.events.off('regex:change', onRegexChange);
      onRegexChange = null;
      clearTimeout(timer);
      panelRef = null;
    },
  };
})();
