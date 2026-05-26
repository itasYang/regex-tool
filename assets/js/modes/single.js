/* ============================================================
 * 模式 1：单句测试 — Phase 2 实装（Phase 4 接入 i18n）
 * 在一段测试文本里跑当前正则，把命中部分高亮出来。
 * ============================================================ */
(function () {
  'use strict';

  window.Modes = window.Modes || {};
  const t = (k, v) => window.I18n.t(k, v);

  function tpl() {
    return [
      '<div class="mode-card">',
      '  <div class="field">',
      '    <label class="field-label" for="single-text">',
      '      ' + esc(t('single.textLabel')),
      '      <span class="field-hint">' + esc(t('single.textHint')) + '</span>',
      '    </label>',
      '    <textarea id="single-text" class="test-input" spellcheck="false" autocomplete="off"',
      '      placeholder="' + escAttr(t('single.textPlaceholder')) + '"></textarea>',
      '  </div>',
      '  <div class="field">',
      '    <label class="field-label">',
      '      ' + esc(t('single.resultLabel')),
      '      <span class="field-hint" id="single-count"></span>',
      '    </label>',
      '    <div id="single-result" class="result-box"></div>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  function esc(s) { return window.Highlight.escape(s); }
  function escAttr(s) { return esc(s).replace(/\n/g, '&#10;'); }

  let textarea = null;
  let resultBox = null;
  let countEl = null;
  let onRegexChange = null;
  let timer = null;

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(run, 60);
  }

  function setResult(html) { if (resultBox) resultBox.innerHTML = html; }
  function setCount(text) { if (countEl) countEl.textContent = text || ''; }

  function run() {
    if (!resultBox) return;
    const App = window.App;
    const text = textarea ? textarea.value : '';
    const regex = App.state.regex;
    const err = App.state.regexError;

    if (err) {
      setResult('<span class="result-hint result-error">' + esc(t('common.regexError', { msg: err })) + '</span>');
      setCount('');
      App.setStats(null, null);
      return;
    }

    if (!regex || !App.state.pattern) {
      if (!text) {
        setResult('<span class="result-hint">' + esc(t('single.emptyHint')) + '</span>');
      } else {
        setResult(Highlight.escape(text));
      }
      setCount('');
      App.setStats(0, null);
      return;
    }

    Engine.execWithTimeout(regex, text, 1000).then(function (res) {
      if (!resultBox || !document.body.contains(resultBox)) return;

      if (res.error) {
        setResult('<span class="result-hint result-error">' + esc(t('common.execError', { msg: res.error })) + '</span>');
        setCount('');
        App.setStats(null, null);
        return;
      }
      if (res.timedOut) {
        setResult('<span class="result-hint result-warn">' + esc(t('common.timeout')) + '</span>');
        setCount(t('common.aborted'));
        App.setStats(null, res.elapsed);
        App.setRegexStatus('warn', t('status.timeout'));
        return;
      }

      const ranges = res.matches.map(function (m) {
        return { index: m.index, length: m.length };
      });

      if (!text) {
        setResult('<span class="result-hint">' + esc(t('single.emptyText')) + '</span>');
      } else {
        setResult(Highlight.render(text, ranges));
      }

      const n = res.matches.length;
      setCount(window.I18n.matches(n));
      App.setStats(n, res.elapsed);
    });
  }

  window.Modes.single = {
    name: '单句测试',
    phase: 2,

    mount(panel) {
      panel.innerHTML = tpl();
      textarea = panel.querySelector('#single-text');
      resultBox = panel.querySelector('#single-result');
      countEl = panel.querySelector('#single-count');

      if (window.Storage) {
        const saved = Storage.get('single:text', '');
        if (typeof saved === 'string' && saved) textarea.value = saved;
      }

      textarea.addEventListener('input', function () {
        if (window.Storage) Storage.set('single:text', textarea.value);
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
      textarea = resultBox = countEl = null;
    },
  };
})();
