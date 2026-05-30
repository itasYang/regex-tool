/* ============================================================
 * 模式 8：TDD 单元测试 — Phase 6 实装
 * 两列样例："应匹配" / "不应匹配"，每行一个文本，可增删。
 * 每行实时显示 ✓（通过） / ✗（不通过）；顶部进度条 N/M 通过。
 * 全部通过时整个面板加成功反馈（边框变绿、文案变更）。
 *
 * 评判规则：
 *   - "应匹配"行：当前正则在该样例文本中至少有一处匹配 → 通过
 *   - "不应匹配"行：当前正则在该样例文本中没有任何匹配 → 通过
 *   - 正则编译失败 / 执行超时 → 视为全部样例不通过
 *
 * 持久化：两栏内容保存在 'unittest:samples' 下。
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
      '  <div class="ut-intro">' + esc(t('unittest.intro')) + '</div>',
      '  <div class="ut-progress" id="ut-progress">',
      '    <div class="ut-progress-bar"><div class="ut-progress-fill" id="ut-progress-fill"></div></div>',
      '    <div class="ut-progress-text" id="ut-progress-text"></div>',
      '  </div>',
      '  <div class="ut-cols">',
      '    <div class="ut-col ut-col-pos">',
      '      <div class="ut-col-head">',
      '        <span class="ut-col-title">✓ ' + esc(t('unittest.shouldMatch')) + '</span>',
      '        <button class="ut-add fm-btn" data-side="pos">' + esc(t('unittest.addRow')) + '</button>',
      '      </div>',
      '      <div id="ut-list-pos" class="ut-list"></div>',
      '    </div>',
      '    <div class="ut-col ut-col-neg">',
      '      <div class="ut-col-head">',
      '        <span class="ut-col-title">✗ ' + esc(t('unittest.shouldNotMatch')) + '</span>',
      '        <button class="ut-add fm-btn" data-side="neg">' + esc(t('unittest.addRow')) + '</button>',
      '      </div>',
      '      <div id="ut-list-neg" class="ut-list"></div>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  function rowTpl(side, idx) {
    return [
      '<div class="ut-row" data-side="' + side + '" data-idx="' + idx + '">',
      '  <span class="ut-icon"></span>',
      '  <input type="text" class="ut-input" spellcheck="false" autocomplete="off"',
      '    placeholder="' + escAttr(t('unittest.placeholder')) + '" />',
      '  <button class="ut-remove icon-btn" title="' + escAttr(t('unittest.remove')) + '">×</button>',
      '</div>',
    ].join('');
  }

  let panelRef = null;
  let listPos = null;
  let listNeg = null;
  let progressFill = null;
  let progressText = null;
  let progressBar = null;
  let onRegexChange = null;
  let timer = null;
  let samples = { pos: [''], neg: [''] };

  function schedule() { clearTimeout(timer); timer = setTimeout(run, 80); }

  function loadState() {
    let saved = null;
    if (window.Storage) saved = Storage.get('unittest:samples', null);
    if (saved && typeof saved === 'object' &&
        Array.isArray(saved.pos) && Array.isArray(saved.neg)) {
      samples = {
        pos: saved.pos.map(s => String(s == null ? '' : s)),
        neg: saved.neg.map(s => String(s == null ? '' : s)),
      };
      if (!samples.pos.length) samples.pos = [''];
      if (!samples.neg.length) samples.neg = [''];
    } else {
      samples = { pos: ['', ''], neg: ['', ''] };
    }
  }
  function saveState() {
    if (window.Storage) Storage.set('unittest:samples', samples);
  }

  function renderList(side) {
    const list = (side === 'pos') ? listPos : listNeg;
    const arr = samples[side];
    list.innerHTML = arr.map((_, i) => rowTpl(side, i)).join('');
    arr.forEach((v, i) => {
      const row = list.querySelector('.ut-row[data-idx="' + i + '"]');
      if (!row) return;
      const inp = row.querySelector('.ut-input');
      const rm = row.querySelector('.ut-remove');
      inp.value = v;
      inp.addEventListener('input', () => {
        samples[side][i] = inp.value;
        saveState();
        schedule();
      });
      rm.addEventListener('click', () => {
        if (samples[side].length <= 1) {
          samples[side][i] = '';
          inp.value = '';
        } else {
          samples[side].splice(i, 1);
        }
        saveState();
        renderList(side);
        run();
      });
    });
  }

  function addRow(side) {
    samples[side].push('');
    saveState();
    renderList(side);
    const list = (side === 'pos') ? listPos : listNeg;
    const rows = list.querySelectorAll('.ut-row');
    const last = rows[rows.length - 1];
    if (last) last.querySelector('.ut-input').focus();
  }

  function applyRowState(side, i, state) {
    const list = (side === 'pos') ? listPos : listNeg;
    const row = list && list.querySelector('.ut-row[data-idx="' + i + '"]');
    if (!row) return;
    row.classList.remove('is-pass', 'is-fail', 'is-empty', 'is-idle', 'is-error');
    row.classList.add('is-' + state);
    const icon = row.querySelector('.ut-icon');
    if (icon) {
      if (state === 'pass') icon.textContent = '✓';
      else if (state === 'fail') icon.textContent = '✗';
      else if (state === 'error') icon.textContent = '⚠';
      else icon.textContent = '·';
    }
  }

  function evalSampleWithRegex(regex, text) {
    try {
      const re = new RegExp(regex.source, regex.flags);
      re.lastIndex = 0;
      return re.test(text);
    } catch (e) {
      return null;
    }
  }

  function run() {
    if (!panelRef) return;
    const App = window.App;
    const regex = App.state.regex;
    const err = App.state.regexError;

    let passed = 0;
    let total = 0;
    const start = (performance && performance.now) ? performance.now() : Date.now();

    function step(side) {
      const arr = samples[side];
      arr.forEach((text, i) => {
        if (!text) {
          applyRowState(side, i, 'empty');
          return;
        }
        if (err || !regex || !App.state.pattern) {
          applyRowState(side, i, 'idle');
          return;
        }
        total += 1;
        const hit = evalSampleWithRegex(regex, text);
        if (hit === null) {
          applyRowState(side, i, 'error');
          return;
        }
        const pass = (side === 'pos') ? hit : !hit;
        if (pass) passed += 1;
        applyRowState(side, i, pass ? 'pass' : 'fail');
      });
    }

    step('pos');
    step('neg');

    if (total === 0) {
      progressFill.style.width = '0%';
      progressText.textContent = t('unittest.progressEmpty');
      progressBar.classList.remove('is-all-pass');
      panelRef.classList.remove('ut-all-pass');
    } else {
      const pct = Math.round((passed / total) * 100);
      progressFill.style.width = pct + '%';
      const allPass = (passed === total);
      progressText.textContent = allPass
        ? t('unittest.allPassed')
        : t('unittest.progress', { passed: passed, total: total });
      progressBar.classList.toggle('is-all-pass', allPass);
      panelRef.classList.toggle('ut-all-pass', allPass);
    }

    const elapsed = ((performance && performance.now) ? performance.now() : Date.now()) - start;
    App.setStats(passed, elapsed);
  }

  window.Modes.unittest = {
    name: 'TDD',
    phase: 6,

    mount(panel) {
      panelRef = panel;
      panel.innerHTML = tpl();
      listPos = panel.querySelector('#ut-list-pos');
      listNeg = panel.querySelector('#ut-list-neg');
      progressFill = panel.querySelector('#ut-progress-fill');
      progressText = panel.querySelector('#ut-progress-text');
      progressBar = panel.querySelector('#ut-progress');

      loadState();
      renderList('pos');
      renderList('neg');

      panel.querySelectorAll('.ut-add').forEach(btn => {
        btn.addEventListener('click', () => addRow(btn.dataset.side));
      });

      onRegexChange = function () { schedule(); };
      window.App.events.on('regex:change', onRegexChange);

      run();
    },

    unmount() {
      if (onRegexChange) window.App.events.off('regex:change', onRegexChange);
      onRegexChange = null;
      clearTimeout(timer);
      if (panelRef) panelRef.classList.remove('ut-all-pass');
      panelRef = listPos = listNeg = progressFill = progressText = progressBar = null;
    },
  };
})();
