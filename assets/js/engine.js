/* ============================================================
 * engine.js — 正则引擎封装
 * 职责：统一 JS 原生 RegExp（Phase 7 再接 XRegExp）的接口，提供：
 *   - compile(pattern, flags) → { ok, regex, error }
 *   - exec(regex, text) → 归一化匹配数组（同步，无超时保护）
 *   - execWithTimeout(regex, text, timeoutMs) → Promise，带超时熔断
 *
 * 超时熔断方案：用 inline Worker（Blob URL）在后台线程跑匹配，
 * 超时则 terminate 掉 Worker，主线程不会被灾难性回溯挂死。
 * 若环境不支持 Worker（个别浏览器 file:// 限制），退化为同步执行，
 * 此时无法中断，但仍会标记 interruptible=false 供上层提示。
 *
 * 归一化匹配对象结构（exec / execWithTimeout 都返回这个形状）：
 *   { index, match, length, groups: string[], namedGroups: {}|null }
 * ============================================================ */

(function () {
  'use strict';

  const MATCH_LIMIT = 200000; // 防止 g 标志下海量/零宽匹配把数组撑爆

  function now() {
    return (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();
  }

  /* ---- Worker 主体：序列化后通过 Blob URL 加载 ---- */
  function regexWorkerBody() {
    self.onmessage = function (e) {
      var d = e.data;
      try {
        var re = new RegExp(d.source, d.flags);
        var text = d.text || '';
        var out = [];
        var guard = 0;
        if (re.global || re.sticky) {
          re.lastIndex = 0;
          var m;
          while ((m = re.exec(text)) !== null) {
            out.push(ser(m));
            if (m.index === re.lastIndex) re.lastIndex++; // 跳过零宽匹配死循环
            if (++guard > d.limit) break;
          }
        } else {
          var m1 = re.exec(text);
          if (m1) out.push(ser(m1));
        }
        self.postMessage({ ok: true, matches: out });
      } catch (err) {
        self.postMessage({ ok: false, error: (err && err.message) ? err.message : String(err) });
      }
      function ser(m) {
        return {
          index: m.index,
          match: m[0],
          length: m[0].length,
          groups: Array.prototype.slice.call(m, 1),
          namedGroups: m.groups ? assign(m.groups) : null,
          // 'd' 标志开启时，m.indices 给出每段的 [start, end]；序列化为可结构克隆的二维数组
          groupIndices: m.indices ? sliceIndices(m.indices) : null,
          namedIndices: (m.indices && m.indices.groups) ? assign(m.indices.groups) : null,
        };
      }
      function assign(g) { var o = {}; for (var k in g) { o[k] = g[k]; } return o; }
      function sliceIndices(arr) {
        var out = []; for (var i = 0; i < arr.length; i++) { out.push(arr[i] || null); } return out;
      }
    };
  }

  /* ---- 懒加载并缓存 Worker 的 Blob URL ---- */
  let _workerURL;
  let _workerTried = false;
  function getWorkerURL() {
    if (_workerTried) return _workerURL;
    _workerTried = true;
    try {
      if (typeof Worker === 'undefined' || typeof Blob === 'undefined' ||
          typeof URL === 'undefined' || !URL.createObjectURL) {
        _workerURL = null;
        return null;
      }
      const src = '(' + regexWorkerBody.toString() + ')()';
      _workerURL = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
    } catch (e) {
      _workerURL = null;
    }
    return _workerURL;
  }

  function normalize(m) {
    return {
      index: m.index,
      match: m[0],
      length: m[0].length,
      groups: Array.prototype.slice.call(m, 1),
      namedGroups: m.groups ? Object.assign({}, m.groups) : null,
      groupIndices: m.indices ? Array.prototype.slice.call(m.indices).map(function (p) { return p || null; }) : null,
      namedIndices: (m.indices && m.indices.groups) ? Object.assign({}, m.indices.groups) : null,
    };
  }

  /* ---- 同步执行（无超时保护，作为 Worker 不可用时的退化路径） ---- */
  function runSync(regex, text) {
    const out = [];
    try {
      const re = new RegExp(regex.source, regex.flags);
      let guard = 0;
      if (re.global || re.sticky) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(text)) !== null) {
          out.push(normalize(m));
          if (m.index === re.lastIndex) re.lastIndex++;
          if (++guard > MATCH_LIMIT) break;
        }
      } else {
        const m1 = re.exec(text);
        if (m1) out.push(normalize(m1));
      }
      return { matches: out, error: null };
    } catch (e) {
      return { matches: [], error: e.message };
    }
  }

  function syncResult(regex, text, start) {
    const r = runSync(regex, text);
    return {
      matches: r.matches,
      elapsed: now() - start,
      timedOut: false,
      error: r.error,
      interruptible: false, // 同步路径无法中断
    };
  }

  function hasXRegExp() {
    return typeof window !== 'undefined' && typeof window.XRegExp === 'function';
  }

  const Engine = {
    type: 'native', // 'native' | 'xregexp'

    /** XRegExp 是否可用（CDN 加载成功） */
    isXRegExpAvailable() { return hasXRegExp(); },

    /**
     * 编译正则
     * @returns {{ok:boolean, regex?:RegExp, error?:string}}
     * XRegExp 路径：先用 XRegExp 编译以校验 + 展开扩展语法（命名捕获、Unicode 属性等），
     * 再把展开后的 .source / .flags 交给原生 RegExp。这样 Worker 里的原生执行也能正常跑。
     * XRegExp 不可用时静默降级到原生。
     */
    compile(pattern, flags) {
      if (this.type === 'xregexp' && hasXRegExp()) {
        try {
          // XRegExp 返回原生 RegExp（带它扩展过的 .source）
          const re = window.XRegExp(pattern, flags || '');
          return { ok: true, regex: re };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      }
      try {
        return { ok: true, regex: new RegExp(pattern, flags || '') };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },

    /**
     * 同步执行匹配，返回归一化匹配数组。无超时保护，谨慎用于可能回溯的正则。
     */
    exec(regex, text) {
      if (!regex) return [];
      return runSync(regex, text == null ? '' : String(text)).matches;
    },

    /**
     * 带超时熔断的执行。
     * @param {RegExp} regex 已编译正则
     * @param {string} text 目标文本
     * @param {number} [timeoutMs=1000]
     * @returns {Promise<{matches:Array, elapsed:number, timedOut:boolean, error:string|null, interruptible:boolean}>}
     */
    execWithTimeout(regex, text, timeoutMs) {
      timeoutMs = timeoutMs || 1000;
      text = (text == null) ? '' : String(text);
      const start = now();

      if (!regex) {
        return Promise.resolve({ matches: [], elapsed: 0, timedOut: false, error: null, interruptible: true });
      }

      const url = getWorkerURL();
      if (!url) {
        // 无 Worker 支持：退化为同步执行（不可中断）
        return Promise.resolve(syncResult(regex, text, start));
      }

      return new Promise(function (resolve) {
        let worker;
        try {
          worker = new Worker(url);
        } catch (e) {
          resolve(syncResult(regex, text, start));
          return;
        }
        let done = false;

        const timer = setTimeout(function () {
          if (done) return;
          done = true;
          try { worker.terminate(); } catch (e) {}
          resolve({ matches: [], elapsed: now() - start, timedOut: true, error: null, interruptible: true });
        }, timeoutMs);

        worker.onmessage = function (ev) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          try { worker.terminate(); } catch (e) {}
          const data = ev.data;
          if (data && data.ok) {
            resolve({ matches: data.matches, elapsed: now() - start, timedOut: false, error: null, interruptible: true });
          } else {
            resolve({ matches: [], elapsed: now() - start, timedOut: false, error: (data && data.error) || '未知错误', interruptible: true });
          }
        };

        worker.onerror = function () {
          if (done) return;
          done = true;
          clearTimeout(timer);
          try { worker.terminate(); } catch (e) {}
          // Worker 运行出错：退化到同步
          resolve(syncResult(regex, text, start));
        };

        worker.postMessage({ source: regex.source, flags: regex.flags, text: text, limit: MATCH_LIMIT });
      });
    },

    /** 切换引擎。返回 true 表示切换成功，false 表示目标不可用（仍保留原值）。 */
    setEngine(type) {
      if (type !== 'native' && type !== 'xregexp') return false;
      if (type === 'xregexp' && !hasXRegExp()) return false;
      this.type = type;
      return true;
    },
  };

  window.Engine = Engine;
})();
