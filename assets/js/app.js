/* ============================================================
 * app.js — 应用主入口
 * Phase 2：接入正则引擎 + 事件总线 + 状态同步 + 单句模式挂载
 *   - 监听正则/标志输入（防抖 200ms）编译并 emit regex:change
 *   - 标志位按钮与标志输入框双向同步
 *   - 实时校验：编译失败时输入框红边 + 状态红点
 *   - 切模式时卸载旧模式、挂载新模式
 * ============================================================ */

(function () {
  'use strict';

  const DEBOUNCE_MS = 200;

  const App = {
    state: {
      theme: 'light',         // 'light' | 'dark'
      mode: 'single',         // 当前模式 ID
      sidebar: 'cheatsheet',  // 当前侧边 tab
      engine: 'native',       // 'native' | 'xregexp'（Phase 7）

      // Phase 2 新增
      pattern: '',
      flags: 'g',
      regex: null,            // 编译后的 RegExp，失败为 null
      regexError: null,       // 错误信息字符串
    },

    _events: {},
    _activeMode: null,
    _debounceTimer: null,

    /* ---------- 事件总线 ---------- */
    events: {
      on(evt, cb) {
        (App._events[evt] = App._events[evt] || []).push(cb);
      },
      off(evt, cb) {
        const arr = App._events[evt];
        if (!arr) return;
        const i = arr.indexOf(cb);
        if (i !== -1) arr.splice(i, 1);
      },
      emit(evt) {
        const arr = App._events[evt];
        if (!arr) return;
        const args = Array.prototype.slice.call(arguments, 1);
        arr.slice().forEach(function (cb) {
          try { cb.apply(null, args); } catch (e) { console.error('[events]', evt, e); }
        });
      },
    },

    init() {
      this.loadPersisted();
      this.bindTheme();
      this.bindModeTabs();
      this.bindSidebarTabs();
      this.bindRegexInputs();
      this.bindFlagButtons();
      this.bindLangToggle();
      this.bindShortcuts();
      this.applyLang(false);                  // 翻译静态 DOM + 顶栏/状态栏（模式尚未挂载）
      this.syncFlagButtons();
      this.recompile();                       // 用恢复/空的正则跑一次初始编译
      this.renderModePanel(this.state.mode);  // 挂载当前模式（默认 single）
      console.info('[regex-tester] Phase 5 已就绪');
    },

    /* ---------- i18n ---------- */
    bindLangToggle() {
      const btn = document.getElementById('lang-toggle');
      if (!btn) return;
      btn.addEventListener('click', () => {
        window.I18n.setLang(window.I18n.lang === 'en' ? 'zh' : 'en');
        this.applyLang(true);
      });
    },

    // 翻译所有带 data-i18n* 的静态元素
    applyI18nDom(root) {
      const I18n = window.I18n;
      (root || document).querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = I18n.t(el.getAttribute('data-i18n'));
      });
      (root || document).querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.setAttribute('placeholder', I18n.t(el.getAttribute('data-i18n-placeholder')));
      });
      (root || document).querySelectorAll('[data-i18n-title]').forEach(el => {
        el.setAttribute('title', I18n.t(el.getAttribute('data-i18n-title')));
      });
    },

    updateChrome() {
      const I18n = window.I18n;
      document.title = I18n.t('app.title');
      document.documentElement.setAttribute('lang', I18n.lang === 'zh' ? 'zh-CN' : 'en');
      const langBtn = document.getElementById('lang-toggle');
      if (langBtn) langBtn.textContent = I18n.t('lang.label');
      const eng = document.getElementById('stat-engine');
      if (eng) eng.textContent = I18n.t('stat.engine') + I18n.t('engine.native');
    },

    // 根据当前状态刷新正则状态指示器的文案
    refreshRegexStatus() {
      const I18n = window.I18n;
      if (this.state.regexError) this.setRegexStatus('error', this.state.regexError);
      else if (!this.state.pattern) this.setRegexStatus('idle', I18n.t('status.waiting'));
      else this.setRegexStatus('ok', I18n.t('status.valid'));
    },

    applyLang(reMount) {
      this.applyI18nDom(document);
      this.updateChrome();
      this.refreshRegexStatus();
      // 重置匹配统计标签（具体数值由模式 run 时刷新）
      this.setStats(this.state._lastCount != null ? this.state._lastCount : 0,
                    this.state._lastElapsed != null ? this.state._lastElapsed : null);
      if (reMount) this.renderModePanel(this.state.mode);
    },

    /* ---------- 持久化 ---------- */
    loadPersisted() {
      try {
        const theme = localStorage.getItem('rt:theme');
        if (theme === 'dark' || theme === 'light') {
          this.state.theme = theme;
          document.documentElement.setAttribute('data-theme', theme);
        }
      } catch (e) {
        // localStorage 不可用时静默降级
      }

      // 恢复上次使用的正则与标志，便于连续调试
      const pin = document.getElementById('regex-pattern');
      const fin = document.getElementById('regex-flags');
      if (window.Storage) {
        const lastPattern = Storage.get('last:pattern', '');
        const lastFlags = Storage.get('last:flags', '');
        if (pin && typeof lastPattern === 'string' && lastPattern) pin.value = lastPattern;
        if (fin && typeof lastFlags === 'string' && lastFlags) fin.value = lastFlags;
      }
      this.state.pattern = pin ? pin.value : '';
      this.state.flags = fin ? fin.value : 'g';
    },

    /* ---------- 主题切换 ---------- */
    bindTheme() {
      const btn = document.getElementById('theme-toggle');
      if (!btn) return;
      btn.addEventListener('click', () => {
        const next = this.state.theme === 'dark' ? 'light' : 'dark';
        this.state.theme = next;
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('rt:theme', next); } catch (e) {}
        this.events.emit('theme:change', next);
      });
    },

    /* ---------- 模式标签页切换 ---------- */
    bindModeTabs() {
      const tabs = document.querySelectorAll('#mode-tabs .tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          if (tab.classList.contains('active')) return;
          const oldMode = this.state.mode;
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const mode = tab.dataset.mode;
          this.state.mode = mode;
          this.renderModePanel(mode);
          this.events.emit('mode:change', mode, oldMode);
        });
      });
    },

    renderModePanel(mode) {
      const panel = document.getElementById('mode-panel');
      if (!panel) return;

      // 卸载上一个模式
      if (this._activeMode &&
          window.Modes && window.Modes[this._activeMode] &&
          typeof window.Modes[this._activeMode].unmount === 'function') {
        try { window.Modes[this._activeMode].unmount(); } catch (e) { console.error(e); }
      }
      this._activeMode = null;

      // 已实现 mount 的模式：交给模式自己渲染
      if (window.Modes && window.Modes[mode] && typeof window.Modes[mode].mount === 'function') {
        window.Modes[mode].mount(panel);
        this._activeMode = mode;
        return;
      }

      // 否则显示通用占位
      const I18n = window.I18n;
      const phases = {
        unittest: 'Phase 6', grep: 'Phase 6', explainer: 'Phase 6',
      };
      const header = I18n.t('tab.' + mode);
      panel.innerHTML =
        '<div class="placeholder">' +
        '  <h2>' + Highlight.escape(header) + '</h2>' +
        '  <p>' + Highlight.escape(I18n.t('placeholder.willEnable', { phase: phases[mode] || '—' })) + '</p>' +
        '  <p class="placeholder-tip">' + Highlight.escape(I18n.t('placeholder.tip')) + '</p>' +
        '</div>';
    },

    /* ---------- 侧边栏 tab 切换 ---------- */
    bindSidebarTabs() {
      const tabs = document.querySelectorAll('.side-tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          this.state.sidebar = tab.dataset.side;
          // Phase 8 会在这里渲染对应内容
        });
      });
    },

    /* ---------- 正则 / 标志输入（防抖编译） ---------- */
    bindRegexInputs() {
      const pin = document.getElementById('regex-pattern');
      const fin = document.getElementById('regex-flags');
      if (pin) pin.addEventListener('input', () => this.debouncedRecompile());
      if (fin) fin.addEventListener('input', () => {
        this.syncFlagButtons();
        this.debouncedRecompile();
      });
    },

    debouncedRecompile() {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => this.recompile(), DEBOUNCE_MS);
    },

    recompile() {
      const pin = document.getElementById('regex-pattern');
      const fin = document.getElementById('regex-flags');
      const wrap = document.querySelector('.regex-input-wrap');
      const pattern = pin ? pin.value : '';
      const flags = fin ? fin.value : '';

      this.state.pattern = pattern;
      this.state.flags = flags;
      if (window.Storage) {
        Storage.set('last:pattern', pattern);
        Storage.set('last:flags', flags);
      }

      // 空正则：清空状态，不算错误
      if (!pattern) {
        this.state.regex = null;
        this.state.regexError = null;
        if (wrap) wrap.classList.remove('has-error');
        this.setRegexStatus('idle', window.I18n.t('status.waiting'));
        this.events.emit('regex:change', null, pattern, flags);
        return;
      }

      const res = Engine.compile(pattern, flags);
      if (res.ok) {
        this.state.regex = res.regex;
        this.state.regexError = null;
        if (wrap) wrap.classList.remove('has-error');
        this.setRegexStatus('ok', window.I18n.t('status.valid'));
        this.events.emit('regex:change', res.regex, pattern, flags);
      } else {
        this.state.regex = null;
        this.state.regexError = res.error;
        if (wrap) wrap.classList.add('has-error');
        this.setRegexStatus('error', res.error);
        this.events.emit('regex:change', null, pattern, flags);
      }
    },

    /* ---------- 状态指示器 / 状态栏 ---------- */
    setRegexStatus(type, text) {
      const dot = document.querySelector('#regex-status .status-dot');
      const txt = document.querySelector('#regex-status .status-text');
      if (dot) dot.className = 'status-dot status-' + type;
      if (txt) txt.textContent = text;
    },

    setStats(count, elapsed) {
      const I18n = window.I18n;
      this.state._lastCount = count;
      this.state._lastElapsed = elapsed;
      const m = document.getElementById('stat-matches');
      const t = document.getElementById('stat-time');
      if (m) m.textContent = I18n.t('stat.matches') + (count == null ? I18n.t('stat.dash') : count);
      if (t) {
        if (elapsed == null) {
          t.textContent = I18n.t('stat.time') + I18n.t('stat.dash');
        } else {
          let v;
          if (elapsed < 1) v = elapsed.toFixed(2);
          else if (elapsed < 10) v = elapsed.toFixed(1);
          else v = Math.round(elapsed);
          t.textContent = I18n.t('stat.time') + v + I18n.t('stat.ms');
        }
      }
    },

    /* ---------- 标志位按钮 ---------- */
    syncFlagButtons() {
      const fin = document.getElementById('regex-flags');
      const val = fin ? fin.value : '';
      document.querySelectorAll('.flag-btn').forEach(btn => {
        btn.classList.toggle('active', val.includes(btn.dataset.flag));
      });
    },

    bindFlagButtons() {
      const fin = document.getElementById('regex-flags');
      document.querySelectorAll('.flag-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!fin) return;
          const f = btn.dataset.flag;
          let cur = fin.value;
          if (cur.includes(f)) {
            cur = cur.split(f).join(''); // 移除所有该标志
          } else {
            cur += f;
          }
          fin.value = cur;
          this.syncFlagButtons();
          this.recompile(); // 标志切换立即重跑
        });
      });
    },

    /* ---------- 键盘快捷键 ---------- */
    bindShortcuts() {
      document.addEventListener('keydown', (e) => {
        const ctrl = e.ctrlKey || e.metaKey;
        if (ctrl && (e.key === 'k' || e.key === 'K')) {
          e.preventDefault();
          const input = document.getElementById('regex-pattern');
          if (input && !input.disabled) input.focus();
        }
        if (ctrl && e.key === 'Enter') {
          e.preventDefault();
          this.recompile(); // 重跑
        }
      });
    },
  };

  // 暴露到 window 方便调试和模式模块调用
  window.App = App;

  // DOM ready 后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }
})();
