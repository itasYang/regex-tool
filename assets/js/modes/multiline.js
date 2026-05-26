/* ============================================================
 * 模式 2：多行文本测试 — Phase 3 实装
 * 大段文本/日志全文匹配，结果带行号显示，命中高亮。
 * 点击行号可把光标跳到原文本框对应行。
 * 性能：对全文先取匹配区间，再按行映射，innerHTML 一次性写入。
 * ============================================================ */
(function () {
  'use strict';

  window.Modes = window.Modes || {};

  const TPL = [
    '<div class="mode-card">',
    '  <div class="field">',
    '    <label class="field-label" for="ml-text">',
    '      多行文本 / 日志',
    '      <span class="field-hint">粘贴多行内容，全文匹配并按行号定位</span>',
    '    </label>',
    '    <textarea id="ml-text" class="test-input ml-input" spellcheck="false" autocomplete="off"',
    '      placeholder="在这里粘贴多行文本…\n例如一段日志，每行一条记录"></textarea>',
    '  </div>',
    '  <div class="field">',
    '    <label class="field-label">',
    '      匹配结果',
    '      <span class="field-hint" id="ml-stat"></span>',
    '    </label>',
    '    <div id="ml-result" class="result-box ml-result"></div>',
    '  </div>',
    '</div>',
  ].join('\n');

  let textarea = null;
  let resultBox = null;
  let statEl = null;
  let onRegexChange = null;
  let timer = null;
  let lineStarts = [];   // 每行在全文中的起始偏移
  let lastLineCount = 0;

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(run, 80);
  }

  // 二分查找：给定全文偏移，返回所在行号（0 基）
  function lineOf(offset) {
    let lo = 0, hi = lineStarts.length - 1, ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lineStarts[mid] <= offset) { ans = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    return ans;
  }

  // 计算行起始偏移表
  function computeLineStarts(text) {
    const starts = [0];
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10 /* \n */) starts.push(i + 1);
    }
    return starts;
  }

  function renderLines(text, matches) {
    lineStarts = computeLineStarts(text);
    const lines = text.split('\n');
    lastLineCount = lines.length;

    // 把全局匹配区间分配到各行（相对行内偏移）
    const perLine = []; // perLine[lineIdx] = [{index,length}]
    let hitLineSet = null;
    if (matches && matches.length) {
      hitLineSet = Object.create(null);
      for (const m of matches) {
        const start = m.index;
        const end = m.index + m.length;
        let ln = lineOf(start);
        // 一个匹配可能跨多行
        while (ln < lines.length) {
          const ls = lineStarts[ln];
          const le = ls + lines[ln].length; // 不含换行符
          const segStart = Math.max(start, ls);
          const segEnd = Math.min(end, le);
          if (segStart <= le && segEnd >= ls) {
            (perLine[ln] = perLine[ln] || []).push({
              index: segStart - ls,
              length: Math.max(0, segEnd - segStart),
            });
            hitLineSet[ln] = true;
          }
          if (end <= le) break;       // 匹配在本行结束
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
        '<span class="ml-ln" data-line="' + i + '" title="跳到第 ' + (i + 1) + ' 行">' +
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
      resultBox.innerHTML = '<span class="result-hint result-error">正则有误：' + Highlight.escape(err) + '</span>';
      if (statEl) statEl.textContent = '';
      App.setStats(null, null);
      return;
    }

    if (!text) {
      resultBox.innerHTML = '<span class="result-hint">在上方粘贴多行文本后，这里按行号显示匹配结果。</span>';
      if (statEl) statEl.textContent = '';
      App.setStats(0, null);
      return;
    }

    if (!regex || !App.state.pattern) {
      // 无正则：仅带行号展示原文
      resultBox.innerHTML = renderLines(text, null);
      const lc = text.split('\n').length;
      if (statEl) statEl.textContent = lc + ' 行 · 无正则';
      App.setStats(0, null);
      return;
    }

    Engine.execWithTimeout(regex, text, 1000).then(function (res) {
      if (!resultBox || !document.body.contains(resultBox)) return;

      if (res.error) {
        resultBox.innerHTML = '<span class="result-hint result-error">执行出错：' + Highlight.escape(res.error) + '</span>';
        if (statEl) statEl.textContent = '';
        App.setStats(null, null);
        return;
      }
      if (res.timedOut) {
        resultBox.innerHTML = '<span class="result-hint result-warn">⚠ 匹配超时（超过 1s，可能存在灾难性回溯），已中断。</span>';
        if (statEl) statEl.textContent = '已中断';
        App.setStats(null, res.elapsed);
        App.setRegexStatus('warn', '匹配超时，可能灾难性回溯');
        return;
      }

      const html = renderLines(text, res.matches);
      resultBox.innerHTML = html;

      const lc = lastLineCount;
      const n = res.matches.length;
      if (statEl) statEl.textContent = lc + ' 行 · ' + (n === 0 ? '无命中' : n + ' 处命中');
      App.setStats(n, res.elapsed);
    });
  }

  // 点击行号 → 把原文本框光标定位到该行并滚动
  function onResultClick(e) {
    const ln = e.target.closest('.ml-ln');
    if (!ln || !textarea) return;
    const idx = parseInt(ln.dataset.line, 10);
    if (isNaN(idx) || idx >= lineStarts.length) return;
    const start = lineStarts[idx];
    const lineText = (textarea.value.split('\n')[idx] || '');
    textarea.focus();
    textarea.setSelectionRange(start, start + lineText.length);
    // 估算滚动位置
    const ratio = lineStarts.length > 1 ? idx / (lineStarts.length - 1) : 0;
    textarea.scrollTop = Math.max(0, ratio * (textarea.scrollHeight - textarea.clientHeight));
  }

  window.Modes.multiline = {
    name: '多行',
    phase: 3,

    mount(panel) {
      panel.innerHTML = TPL;
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
