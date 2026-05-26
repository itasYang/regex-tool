/* ============================================================
 * 模式 2：多行文本测试 — Phase 3 实装（Phase 4 接入 i18n）
 * 大段文本/日志全文匹配，结果带行号显示，命中高亮。
 * 点击行号可把光标跳到原文本框对应行。
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
      '    <label class="field-label" for="ml-text">',
      '      ' + esc(t('multiline.label')),
      '      <span class="field-hint">' + esc(t('multiline.hint')) + '</span>',
      '    </label>',
      '    <textarea id="ml-text" class="test-input ml-input" spellcheck="false" autocomplete="off"',
      '      placeholder="' + escAttr(t('multiline.placeholder')) + '"></textarea>',
      '  </div>',
      '  <div class="field">',
      '    <label class="field-label">',
      '      ' + esc(t('multiline.resultLabel')),
      '      <span class="field-hint" id="ml-stat"></span>',
      '    </label>',
      '    <div id="ml-result" class="result-box ml-result"></div>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  let textarea = null;
  let resultBox = null;
  let statEl = null;
  let onRegexChange = null;
  let timer = null;
  let lineStarts = [];
  let lastLineCount = 0;

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(run, 80);
  }

  function lineOf(offset) {
    let lo = 0, hi = lineStarts.length - 1, ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lineStarts[mid] <= offset) { ans = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    return ans;
  }

  function computeLineStarts(text) {
    const starts = [0];
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10) starts.push(i + 1);
    }
    return starts;
  }

  function renderLines(text, matches) {
    lineStarts = computeLineStarts(text);
    const lines = text.split('\n');
    lastLineCount = lines.length;

    const perLine = [];
    let hitLineSet = null;
    if (matches && matches.length) {
      hitLineSet = Object.create(null);
      for (const m of matches) {
        const start = m.index;
        const end = m.index + m.length;
        let ln = lineOf(start);
        while (ln < lines.length) {
          const ls = lineStarts[ln];
          const le = ls + lines[ln].length;
          const segStart = Math.max(start, ls);
          const segEnd = Math.min(end, le);
          if (segStart <= le && segEnd >= ls) {
            (perLine[ln] = perLine[ln] || []).push({
              index: segStart - ls,
              length: Math.max(0, segEnd - segStart),
            });
            hitLineSet[ln] = true;
          }
          if (end <= le) break;
          ln++;
          if (lineStarts[ln] > end) break;
        }
      }
    }

    const gutterWidth = String(lines.length).length;
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const hit = hitLineSet && hitLineSet[i];
      const lnLabel = String(i + 1).padStart(gutterWidth, ' ');
      const content = perLine[i]
        ? Highlight.render(lines[i], perLine[i])
        : Highlight.escape(lines[i]);
      out.push(
        '<div class="ml-line' + (hit ? ' is-hit' : '') + '">' +
        '<span class="ml-ln" data-line="' + i + '" title="' + escAttr(t('multiline.jump', { n: i + 1 })) + '">' +
        Highlight.escape(lnLabel) + '</span>' +
        '<span class="ml-code">' + (content || '&nbsp;') + '</span>' +
        '</div>'
      );
    }
    return out.join('');
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

    if (!text) {
      resultBox.innerHTML = '<span class="result-hint">' + esc(t('multiline.emptyHint')) + '</span>';
      if (statEl) statEl.textContent = '';
      App.setStats(0, null);
      return;
    }

    if (!regex || !App.state.pattern) {
      resultBox.innerHTML = renderLines(text, null);
      const lc = text.split('\n').length;
      if (statEl) statEl.textContent = t('multiline.lines', { n: lc }) + ' · ' + t('multiline.noRegex');
      App.setStats(0, null);
      return;
    }

    Engine.execWithTimeout(regex, text, 1000).then(function (res) {
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

      resultBox.innerHTML = renderLines(text, res.matches);
      const n = res.matches.length;
      if (statEl) statEl.textContent = t('multiline.lines', { n: lastLineCount }) + ' · ' + window.I18n.matches(n);
      App.setStats(n, res.elapsed);
    });
  }

  function onResultClick(e) {
    const ln = e.target.closest('.ml-ln');
    if (!ln || !textarea) return;
    const idx = parseInt(ln.dataset.line, 10);
    if (isNaN(idx) || idx >= lineStarts.length) return;
    const start = lineStarts[idx];
    const lineText = (textarea.value.split('\n')[idx] || '');
    textarea.focus();
    textarea.setSelectionRange(start, start + lineText.length);
    const ratio = lineStarts.length > 1 ? idx / (lineStarts.length - 1) : 0;
    textarea.scrollTop = Math.max(0, ratio * (textarea.scrollHeight - textarea.clientHeight));
  }

  window.Modes.multiline = {
    name: '多行',
    phase: 3,

    mount(panel) {
      panel.innerHTML = tpl();
      textarea = panel.querySelector('#ml-text');
      resultBox = panel.querySelector('#ml-result');
      statEl = panel.querySelector('#ml-stat');

      if (window.Storage) {
        const saved = Storage.get('multiline:text', '');
        if (typeof saved === 'string' && saved) textarea.value = saved;
      }

      textarea.addEventListener('input', function () {
        if (window.Storage) Storage.set('multiline:text', textarea.value);
        schedule();
      });
      resultBox.addEventListener('click', onResultClick);

      onRegexChange = function () { schedule(); };
      window.App.events.on('regex:change', onRegexChange);

      run();
    },

    unmount() {
      if (onRegexChange) window.App.events.off('regex:change', onRegexChange);
      onRegexChange = null;
      clearTimeout(timer);
      if (resultBox) resultBox.removeEventListener('click', onResultClick);
      textarea = resultBox = statEl = null;
      lineStarts = [];
    },
  };
})();
