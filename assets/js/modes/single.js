/* ============================================================
 * 模式 1：单句测试 — Phase 2 实装
 * 在一段测试文本里跑当前正则，把命中部分高亮出来。
 * 订阅 App 的 regex:change 事件，正则变化时自动重跑；
 * 测试文本输入时也重跑（小防抖）。
 * ============================================================ */
(function () {
  'use strict';

  window.Modes = window.Modes || {};

  const TPL = [
    '<div class="mode-card">',
    '  <div class="field">',
    '    <label class="field-label" for="single-text">',
    '      测试文本',
    '      <span class="field-hint">在下面写一段文本，命中部分会高亮</span>',
    '    </label>',
    '    <textarea id="single-text" class="test-input" spellcheck="false" autocomplete="off"',
    '      placeholder="例如：订单号 ABC-123，金额 ¥456.78，时间 2026-05-26"></textarea>',
    '  </div>',
    '  <div class="field">',
    '    <label class="field-label">',
    '      高亮结果',
    '      <span class="field-hint" id="single-count"></span>',
    '    </label>',
    '    <div id="single-result" class="result-box"></div>',
    '  </div>',
    '</div>',
  ].join('\n');

  let textarea = null;
  let resultBox = null;
  let countEl = null;
  let onRegexChange = null;
  let timer = null;

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(run, 60);
  }

  function setResult(html) {
    if (resultBox) resultBox.innerHTML = html;
  }

  function setCount(text) {
    if (countEl) countEl.textContent = text || '';
  }

  function run() {
    if (!resultBox) return;
    const App = window.App;
    const text = textarea ? textarea.value : '';
    const regex = App.state.regex;
    const err = App.state.regexError;

    // 1) 正则编译失败
    if (err) {
      setResult('<span class="result-hint result-error">正则有误：' + Highlight.escape(err) + '</span>');
      setCount('');
      App.setStats(null, null);
      return;
    }

    // 2) 没有正则：直接展示转义后的原文（不高亮）
    if (!regex || !App.state.pattern) {
      if (!text) {
        setResult('<span class="result-hint">输入正则与测试文本后，命中部分会在这里高亮显示。</span>');
      } else {
        setResult(Highlight.escape(text));
      }
      setCount('');
      App.setStats(0, null);
      return;
    }

    // 3) 跑匹配（带超时熔断）
    Engine.execWithTimeout(regex, text, 1000).then(function (res) {
      // 异步回来时模式可能已被卸载
      if (!resultBox || !document.body.contains(resultBox)) return;

      if (res.error) {
        setResult('<span class="result-hint result-error">执行出错：' + Highlight.escape(res.error) + '</span>');
        setCount('');
        App.setStats(null, null);
        return;
      }

      if (res.timedOut) {
        setResult('<span class="result-hint result-warn">⚠ 匹配超时（超过 1s，可能存在灾难性回溯），已自动中断。请检查正则。</span>');
        setCount('已中断');
        App.setStats(null, res.elapsed);
        App.setRegexStatus('warn', '匹配超时，可能灾难性回溯');
        return;
      }

      const ranges = res.matches.map(function (m) {
        return { index: m.index, length: m.length };
      });

      if (!text) {
        setResult('<span class="result-hint">（测试文本为空）</span>');
      } else {
        setResult(Highlight.render(text, ranges));
      }

      const n = res.matches.length;
      setCount(n === 0 ? '无命中' : (n + ' 处命中'));
      App.setStats(n, res.elapsed);

      // 不可中断（Worker 不可用）时给个轻量提示
      if (res.interruptible === false) {
        console.warn('[single] 当前环境无法使用 Worker 超时保护，匹配为同步执行。');
      }
    });
  }

  window.Modes.single = {
    name: '单句测试',
    phase: 2,

    mount(panel) {
      panel.innerHTML = TPL;
      textarea = panel.querySelector('#single-text');
      resultBox = panel.querySelector('#single-result');
      countEl = panel.querySelector('#single-count');

      // 恢复上次输入的测试文本，方便连续调试
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

      run(); // 初次渲染
    },

    unmount() {
      if (onRegexChange) window.App.events.off('regex:change', onRegexChange);
      onRegexChange = null;
      clearTimeout(timer);
      textarea = resultBox = countEl = null;
    },
  };
})();
