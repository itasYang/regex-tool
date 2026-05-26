/* ============================================================
 * highlight.js — 高亮渲染辅助
 * 职责：把匹配区间渲染成带 <mark> 标签的安全 HTML
 *
 * Phase 2：实装基础高亮（整段匹配）。
 * Phase 5 会扩展到捕获组分色（groupIdx → hl-g0..hl-g5）。
 * ============================================================ */

(function () {
  'use strict';

  const Highlight = {
    /** HTML 转义（防 XSS）—— 任何用户输入进 DOM 前必须先过这里 */
    escape(s) {
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    /**
     * 把匹配区间合并到文本里，返回安全 HTML。
     * 非高亮片段和高亮片段都经过 escape，绝不直接拼接原始用户文本。
     * 重叠区间按起点排序后取先到者，后到的重叠部分跳过。
     *
     * @param {string} text 原文
     * @param {Array<{index:number, length:number, groupIdx?:number}>} ranges 匹配区间
     * @returns {string} 安全 HTML
     */
    render(text, ranges) {
      text = (text == null) ? '' : String(text);
      if (!ranges || !ranges.length) return this.escape(text);

      const sorted = ranges
        .filter(r => r && typeof r.index === 'number' && r.index >= 0)
        .slice()
        .sort((a, b) => (a.index - b.index) || (b.length - a.length));

      let html = '';
      let pos = 0;

      for (const r of sorted) {
        const len = r.length || 0;
        if (r.index < pos) continue;                 // 与已渲染区间重叠，跳过
        if (r.index > pos) html += this.escape(text.slice(pos, r.index));

        if (len === 0) {
          // 零宽匹配：插入一个细标记，提示命中位置
          html += '<mark class="hl hl-empty" title="零宽匹配"></mark>';
          pos = r.index;
        } else {
          const cls = (r.groupIdx != null) ? ('hl hl-g' + r.groupIdx) : 'hl';
          const seg = text.slice(r.index, r.index + len);
          html += '<mark class="' + cls + '">' + this.escape(seg) + '</mark>';
          pos = r.index + len;
        }
      }

      if (pos < text.length) html += this.escape(text.slice(pos));
      return html;
    },
  };

  window.Highlight = Highlight;
})();
