/* ============================================================
 * storage.js — localStorage 封装
 * 职责：历史记录、用户偏好（主题、最近正则等）的持久化
 *
 * Phase 1：基础读写已可用（app.js 已用于主题持久化）
 * Phase 8 会扩展到正则历史
 * ============================================================ */

(function () {
  'use strict';

  const PREFIX = 'rt:';
  const available = (() => {
    try {
      const k = '__rt_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  })();

  const Storage = {
    available,

    get(key, fallback) {
      if (!available) return fallback;
      try {
        const v = localStorage.getItem(PREFIX + key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    },

    set(key, value) {
      if (!available) return false;
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },

    remove(key) {
      if (!available) return;
      try { localStorage.removeItem(PREFIX + key); } catch (e) {}
    },
  };

  window.Storage = Storage;
})();
