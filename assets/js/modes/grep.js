/* ============================================================
 * 模式 9：grep 过滤 — Phase 6 实装
 * 大段文本按行过滤：保留命中（grep）或排除命中（grep -v）。
 * 选项：
 *   - 显示行号
 *   - 上下文行：-A（之后）/-B（之前）/-C（前后），单输入框控制
 * 结果区命中行高亮命中部分；上下文行用 dim 灰色；段与段之间插分隔条。
 * ============================================================ */
(function () {
  'use strict';

  window.Modes = window.Modes || {};
  const t = (k, v) => window.I18n.t(k, v);
  function esc(s) { return window.Highlight.escape(s); }
  function escAttr(s) { return esc(s).replace(/\n/g, '&#10;'); }

  const MAX_RESULT_LINES = 5000;

  function tpl() {
    return [
      '<div class="mode-card">',
      '  <div class="field">',
      '    <label class="field-label" for="gp-text">',
      '      ' + esc(t('grep.label')),
      '      <span class="field-hint">' + esc(t('grep.hint')) + '</span>',
      '    </label>',
      '    <textarea id="gp-text" class="test-input gp-input" spellcheck="false" autocomplete="off"',
      '      placeholder="' + escAttr(t('grep.placeholder')) + '"></textarea>',
      '  </div>',
      '  <div class="gp-opts">',
      '    <div class="gp-opt-group">',
      '      <label class="gp-opt"><input type="radio" name="gp-mode" value="keep" checked /> ' + esc(t('grep.modeKeep')) + '</label>',
      '      <label class="gp-opt"><input type="radio" name="gp-mode" value="invert" /> ' + esc(t('grep.modeInvert')) + '</label>',
      '    </div>',
      '    <label class="gp-opt"><input type="checkbox" id="gp-ln" checked /> ' + esc(t('grep.showLn')) + '</label>',
      '    <div class="gp-ctx-group">',
      '      <span class="gp-ctx-label">' + esc(t('grep.context')) + '</span>',
      '      <select id="gp-ctx-kind" class="fm-select gp-ctx-kind">',
      '        <option value="C">-C ' + esc(t('grep.contextBoth')) + '</option>',
      '        <option value="A">-A ' + esc(t('grep.contextAfter')) + '</option>',
      '        <option value="B">-B ' + esc(t('grep.contextBefore')) + '</option>',
      '      </select>',
      '      <input type="number" id="gp-ctx-n" class="fm-input gp-ctx-n" value="0" min="0" max="50" />',
      '    </div>',
      '  </div>',
      '  <div class="field">',
      '    <label class="field-label">',
      '      ' + esc(t('grep.resultLabel')),
      '      <span class="field-hint" id="gp-stat"></span>',
      '    </label>',
      '    <div id="gp-result" class="result-box gp-result"></div>',
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

  function el(id) { return panelRef ? panelRef.querySelector('#' + id) : null; }
  function schedule() { clearTimeout(timer); timer = setTimeout(run, 80); }

  function currentMode() {
    const r = panelRef && panelRef.querySelector('input[name="gp-mode"]:checked');
    return r ? r.value : 'keep';
  }

  function withFlag(flags, flag, on) {
    let f = (flags || '').split(flag).join('');
    if (on) f += flag;
    return f;
  }

  function run() {
    if (!resultBox) return;
    const App = window.App;
    const text = textarea ? textarea.value : '';
    const baseRegex = App.state.regex;
    const err = App.state.regexError;

    const showLn = el('gp-ln') ? el('gp-ln').checked : true;
    const ctxKind = el('gp-ctx-kind') ? el('gp-ctx-kind').value : 'C';
    const ctxN = el('gp-ctx-n') ? Math.max(0, Math.min(50, parseInt(el('gp-ctx-n').value, 10) || 0)) : 0;

    if (err) {
      resultBox.innerHTML = '<span class="result-hint result-error">' + esc(t('common.regexError', { msg: err })) + '</span>';
      if (statEl) statEl.textContent = '';
      App.setStats(null, null);
      return;
    }
    if (!baseRegex || !App.state.pattern) {
      resultBox.innerHTML = '<span class="result-hint">' + esc(t('grep.needRegex')) + '</span>';
      if (statEl) statEl.textContent = '';
      App.setStats(0, null);
      return;
    }
    if (!text) {
      resultBox.innerHTML = '<span class="result-hint">' + esc(t('grep.emptyHint')) + '</span>';
      if (statEl) statEl.textContent = '';
      App.setStats(0, null);
      return;
    }

    // 用 g 版正则取全部匹配（用于命中行集合 + 高亮）
    let regex;
    try { regex = new RegExp(baseRegex.source, withFlag(baseRegex.flags, 'g', true)); }
    catch (e) { regex = baseRegex; }

    const start = (performance && performance.now) ? performance.now() : Date.now();
    Engine.execWithTimeout(regex, text, 1000).then(res => {
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

      // 行起点表 + 把命中按行分桶
      const lineStarts = computeLineStarts(text);
      const lines = text.split('\n');
      const totalLines = lines.length;
      const perLineMatches = Array.from({ length: totalLines }, () => []);
      res.matches.forEach(m => {
        const startLn = lineOf(lineStarts, m.index);
        const endLn = lineOf(lineStarts, m.index + Math.max(0, m.length - 1));
        for (let ln = startLn; ln <= endLn && ln < totalLines; ln++) {
          const lnStart = lineStarts[ln];
          const lnEnd = (ln + 1 < lineStarts.length) ? (lineStarts[ln + 1] - 1) : text.length;
          const segStart = Math.max(m.index, lnStart);
          const segEnd = Math.min(m.index + m.length, lnEnd + 1);
          if (segEnd > segStart) {
            perLineMatches[ln].push({ index: segStart - lnStart, length: segEnd - segStart });
          }
        }
      });

      const mode = currentMode();
      const hitLines = new Set();
      for (let i = 0; i < totalLines; i++) {
        const isHit = perLineMatches[i].length > 0;
        if (mode === 'keep' ? isHit : !isHit) hitLines.add(i);
      }

      // 上下文：把命中行集合扩展
      const before = (ctxKind === 'C' || ctxKind === 'B') ? ctxN : 0;
      const after = (ctxKind === 'C' || ctxKind === 'A') ? ctxN : 0;
      const ctxLines = new Set();
      hitLines.forEach(ln => {
        for (let k = 1; k <= before; k++) if (ln - k >= 0 && !hitLines.has(ln - k)) ctxLines.add(ln - k);
        for (let k = 1; k <= after; k++) if (ln + k < totalLines && !hitLines.has(ln + k)) ctxLines.add(ln + k);
      });

      const allShow = new Set([...hitLines, ...ctxLines]);
      const shown = [...allShow].sort((a, b) => a - b);

      if (shown.length === 0) {
        const msg = (mode === 'keep') ? t('grep.noMatch') : t('grep.allMatched');
        resultBox.innerHTML = '<span class="result-hint">' + esc(msg) + '</span>';
        if (statEl) {
          statEl.textContent = (ctxN > 0)
            ? t('grep.statsCtx', { kept: 0, ctx: 0, total: totalLines })
            : t('grep.stats', { kept: 0, total: totalLines });
        }
        App.setStats(0, res.elapsed);
        return;
      }

      const limited = shown.slice(0, MAX_RESULT_LINES);
      const html = [];
      const maxLn = limited[limited.length - 1] + 1;
      const lnW = String(maxLn).length;
      let prev = -2;

      for (const ln of limited) {
        if (prev !== -2 && ln !== prev + 1) {
          html.push('<div class="gp-sep">' + esc(t('grep.ctxSep')) + '</div>');
        }
        prev = ln;
        const isHit = hitLines.has(ln);
        const lineText = lines[ln];
        let body;
        if (isHit && mode === 'keep') {
          body = window.Highlight.render(lineText, perLineMatches[ln]);
        } else {
          body = window.Highlight.escape(lineText);
        }
        const cls = 'gp-line' + (isHit ? ' is-hit' : ' is-ctx');
        const lnStr = String(ln + 1).padStart(lnW, ' ');
        html.push(
          '<div class="' + cls + '">' +
          (showLn ? ('<span class="gp-ln">' + esc(lnStr) + '</span>') : '') +
          '<span class="gp-code">' + (body || '&nbsp;') + '</span>' +
          '</div>'
        );
      }
      if (shown.length > MAX_RESULT_LINES) {
        html.push('<div class="gp-sep gp-more">… ' + (shown.length - MAX_RESULT_LINES) + ' more lines truncated</div>');
      }

      resultBox.innerHTML = html.join('');

      if (statEl) {
        if (ctxLines.size > 0) {
          statEl.textContent = t('grep.statsCtx', {
            kept: hitLines.size, ctx: ctxLines.size, total: totalLines,
          });
        } else {
          statEl.textContent = t('grep.stats', { kept: hitLines.size, total: totalLines });
        }
      }
      const elapsed = ((performance && performance.now) ? performance.now() : Date.now()) - start;
      App.setStats(hitLines.size, elapsed);
    });
  }

  function computeLineStarts(text) {
    const starts = [0];
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10) starts.push(i + 1);
    }
    return starts;
  }

  function lineOf(lineStarts, offset) {
    let lo = 0, hi = lineStarts.length - 1, ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lineStarts[mid] <= offset) { ans = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    return ans;
  }

  window.Modes.grep = {
    name: 'grep',
    phase: 6,

    mount(panel) {
      panelRef = panel;
      panel.innerHTML = tpl();
      textarea = panel.querySelector('#gp-text');
      resultBox = panel.querySelector('#gp-result');
      statEl = panel.querySelector('#gp-stat');

      if (window.Storage) {
        const saved = Storage.get('grep:text', '');
        if (typeof saved === 'string' && saved) textarea.value = saved;
        const opts = Storage.get('grep:opts', null);
        if (opts && typeof opts === 'object') {
          const radios = panel.querySelectorAll('input[name="gp-mode"]');
          radios.forEach(r => { if (r.value === opts.mode) r.checked = true; });
          if (typeof opts.showLn === 'boolean') el('gp-ln').checked = opts.showLn;
          if (typeof opts.ctxKind === 'string') el('gp-ctx-kind').value = opts.ctxKind;
          if (typeof opts.ctxN === 'number') el('gp-ctx-n').value = opts.ctxN;
        }
      }

      textarea.addEventListener('input', () => {
        if (window.Storage) Storage.set('grep:text', textarea.value);
        schedule();
      });

      function saveOpts() {
        if (!window.Storage) return;
        Storage.set('grep:opts', {
          mode: currentMode(),
          showLn: el('gp-ln').checked,
          ctxKind: el('gp-ctx-kind').value,
          ctxN: parseInt(el('gp-ctx-n').value, 10) || 0,
        });
      }
      panel.querySelectorAll('input[name="gp-mode"]').forEach(r => {
        r.addEventListener('change', () => { saveOpts(); schedule(); });
      });
      el('gp-ln').addEventListener('change', () => { saveOpts(); schedule(); });
      el('gp-ctx-kind').addEventListener('change', () => { saveOpts(); schedule(); });
      el('gp-ctx-n').addEventListener('input', () => { saveOpts(); schedule(); });

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
