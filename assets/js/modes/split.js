/* ============================================================
 * 模式 5：分割 — Phase 4 实装
 * 用正则切分文本，把每个分段显示成卡片，分隔符以分隔条显示。
 * 统计「分成 N 段」。
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
      '    <label class="field-label" for="sp-text">',
      '      ' + esc(t('split.label')),
      '      <span class="field-hint">' + esc(t('split.hint')) + '</span>',
      '    </label>',
      '    <textarea id="sp-text" class="test-input" spellcheck="false" autocomplete="off"',
      '      placeholder="' + escAttr(t('split.placeholder')) + '"></textarea>',
      '  </div>',
      '  <div class="field">',
      '    <label class="field-label">',
      '      ' + esc(t('split.resultLabel')),
      '      <span class="field-hint" id="sp-stat"></span>',
      '    </label>',
      '    <div id="sp-result" class="result-box sp-result"></div>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  let panelRef = null;
  let textarea = null;
  let resultBox = null;
  let statEl = null;
  let onRegexChange = null;
  let timer = null;

  function schedule() { clearTimeout(timer); timer = setTimeout(run, 80); }

  function renderSegments(text, matches) {
    const out = [];
    let pos = 0;
    let segCount = 0;

    const pushSeg = (s) => {
      segCount++;
      const body = s ? Highlight.escape(s) : '<span class="sp-empty">' + esc(t('split.empty')) + '</span>';
      out.push('<div class="sp-seg">' + body + '</div>');
    };
    const pushSep = (s) => {
      out.push('<div class="sp-sep" title="' + escAttr(t('split.sepTitle')) + '">' +
        (s ? Highlight.escape(s) : '∅') + '</div>');
    };

    for (const m of matches) {
      pushSeg(text.slice(pos, m.index));
      pushSep(text.slice(m.index, m.index + m.length));
      pos = m.index + m.length;
    }
    pushSeg(text.slice(pos));

    return { html: out.join(''), count: segCount };
  }

  function run() {
    if (!resultBox) return;
    const App = window.App;
    const text = textarea ? textarea.value : '';
    const regex = App.state.regex;
    const err = App.state.regexError;

    if (err) {
      resultBox.innerHTML = '<span class="result-hint result-error">' + esc(t('common.regexError', { msg: err })) + '</span>';
      if (statEl) statEl.textContent = '';
      App.setStats(null, null);
      return;
    }

    if (!regex || !App.state.pattern) {
      resultBox.innerHTML = '<span class="result-hint">' + esc(t('split.needRegex')) + '</span>';
      if (statEl) statEl.textContent = '';
      App.setStats(0, null);
      return;
    }

    if (!text) {
      resultBox.innerHTML = '<span class="result-hint">' + esc(t('split.emptyHint')) + '</span>';
      if (statEl) statEl.textContent = '';
      App.setStats(0, null);
      return;
    }

    // 用 g 版正则拿到所有分隔位置
    let gRegex;
    try { gRegex = new RegExp(regex.source, regex.flags.split('g').join('') + 'g'); }
    catch (e) { gRegex = regex; }

    Engine.execWithTimeout(gRegex, text, 1000).then(function (res) {
      if (!resultBox || !document.body.contains(resultBox)) return;

      if (res.error) {
        resultBox.innerHTML = '<span class="result-hint result-error">' + esc(t('common.execError', { msg: res.error })) + '</span>';
        if (statEl) statEl.textContent = '';
        App.setStats(null, null);
        return;
      }
      if (res.timedOut) {
        resultBox.innerHTML = '<span class="result-hint result-warn">' + esc(t('common.timeout')) + '</span>';
        if (statEl) statEl.textContent = t('common.aborted');
        App.setStats(null, res.elapsed);
        App.setRegexStatus('warn', t('status.timeout'));
        return;
      }

      const r = renderSegments(text, res.matches);
      resultBox.innerHTML = r.html;
      if (statEl) statEl.textContent = t('split.segments', { n: r.count });
      App.setStats(res.matches.length, res.elapsed);
    });
  }

  window.Modes.split = {
    name: '分割',
    phase: 4,

    mount(panel) {
      panelRef = panel;
      panel.innerHTML = tpl();
      textarea = panel.querySelector('#sp-text');
      resultBox = panel.querySelector('#sp-result');
      statEl = panel.querySelector('#sp-stat');

      if (window.Storage) {
        const saved = Storage.get('split:text', '');
        if (typeof saved === 'string' && saved) textarea.value = saved;
      }

      textarea.addEventListener('input', function () {
        if (window.Storage) Storage.set('split:text', textarea.value);
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
      panelRef = textarea = resultBox = statEl = null;
    },
  };
})();
