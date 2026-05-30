/* ============================================================
 * export.js — 导出和多语言代码生成 — Phase 9 实装
 * 公开接口：
 *   - Exporter.toCSV(matches)         匹配数组 → CSV 字符串
 *   - Exporter.toJSON(matches)        匹配数组 → JSON 字符串
 *   - Exporter.toCode(lang, p, f)     正则 → 各语言代码片段
 *   - Exporter.download(name, content, mime)  触发浏览器下载
 *   - Exporter.openCodeDialog(p, f)   打开多语言代码导出弹层
 *   - Exporter.openDetail(match, pattern, flags)  匹配详情抽屉
 *
 * 匹配数组里的元素结构来自 Engine.normalize：
 *   { index, match, length, groups, namedGroups }
 * ============================================================ */
(function () {
  'use strict';

  const t = (k, v) => window.I18n.t(k, v);
  const esc = (s) => window.Highlight.escape(s);
  const escAttr = (s) => esc(s).replace(/\n/g, '&#10;');

  /* ---------- 工具 ---------- */
  function csvCell(v) {
    if (v == null) return '';
    const s = String(v);
    if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function maxGroups(matches) {
    let n = 0;
    matches.forEach(m => { if (m.groups && m.groups.length > n) n = m.groups.length; });
    return n;
  }

  /* ---------- CSV / JSON ---------- */
  function toCSV(matches) {
    if (!matches || !matches.length) return '';
    const gN = maxGroups(matches);
    const head = ['index', 'length', 'match'];
    for (let i = 1; i <= gN; i++) head.push('group_' + i);
    const rows = [head.map(csvCell).join(',')];
    matches.forEach(m => {
      const row = [m.index, m.length, m.match];
      for (let i = 0; i < gN; i++) row.push(m.groups ? m.groups[i] : '');
      rows.push(row.map(csvCell).join(','));
    });
    return rows.join('\r\n');
  }

  function toJSON(matches) {
    return JSON.stringify(matches || [], null, 2);
  }

  /* ---------- 各语言代码生成 ---------- */
  function jsString(s) { return JSON.stringify(s); }

  // Python 用 r-string，但若 pattern 含未平衡的 ' 就回退普通字符串
  function pyRawString(s) {
    if (s.indexOf("'") === -1) return "r'" + s + "'";
    if (s.indexOf('"') === -1) return 'r"' + s + '"';
    return JSON.stringify(s).replace(/\\\\/g, '\\\\\\\\'); // 兜底，少见
  }

  // Java 字符串：双反斜杠
  function javaString(s) {
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
  }

  // Go 反引号 raw string；如果 pattern 含反引号，则回退到双引号字符串
  function goString(s) {
    if (s.indexOf('`') === -1) return '`' + s + '`';
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }

  // PHP delimited string '/.../flags'
  function phpString(p, f) {
    // 选 # 作为分隔符以避开常见 /
    const delim = (p.indexOf('#') === -1) ? '#' : '~';
    return "'" + delim + p.replace(/'/g, "\\'") + delim + (f || '') + "'";
  }

  function flagsJsToPy(flags) {
    const out = [];
    if (flags.indexOf('i') !== -1) out.push('re.IGNORECASE');
    if (flags.indexOf('m') !== -1) out.push('re.MULTILINE');
    if (flags.indexOf('s') !== -1) out.push('re.DOTALL');
    if (flags.indexOf('u') !== -1) out.push('re.UNICODE');
    return out.join(' | ');
  }
  function flagsJsToJava(flags) {
    const out = [];
    if (flags.indexOf('i') !== -1) out.push('Pattern.CASE_INSENSITIVE');
    if (flags.indexOf('m') !== -1) out.push('Pattern.MULTILINE');
    if (flags.indexOf('s') !== -1) out.push('Pattern.DOTALL');
    if (flags.indexOf('u') !== -1) out.push('Pattern.UNICODE_CASE');
    return out.join(' | ');
  }
  function flagsJsToGo(flags) {
    let prefix = '';
    if (flags.indexOf('i') !== -1) prefix += 'i';
    if (flags.indexOf('m') !== -1) prefix += 'm';
    if (flags.indexOf('s') !== -1) prefix += 's';
    return prefix;
  }

  function toCode(lang, pattern, flags) {
    pattern = pattern == null ? '' : String(pattern);
    flags = flags == null ? '' : String(flags);
    const globalLike = flags.indexOf('g') !== -1;

    if (lang === 'js') {
      const lit = '/' + pattern.replace(/\//g, '\\/') + '/' + flags;
      const call = globalLike
        ? `const matches = [...text.matchAll(${lit})];`
        : `const m = ${lit}.exec(text);`;
      return [
        '// JavaScript',
        `const re = ${lit};`,
        call,
      ].join('\n');
    }

    if (lang === 'python') {
      const ps = pyRawString(pattern);
      const fs = flagsJsToPy(flags);
      const flagsArg = fs ? ', ' + fs : '';
      const call = globalLike
        ? `matches = re.findall(pattern, text${flagsArg})`
        : `m = re.search(pattern, text${flagsArg})`;
      return [
        '# Python',
        'import re',
        `pattern = ${ps}`,
        call,
      ].join('\n');
    }

    if (lang === 'java') {
      const ps = javaString(pattern);
      const fs = flagsJsToJava(flags);
      const compile = fs
        ? `Pattern p = Pattern.compile(pattern, ${fs});`
        : `Pattern p = Pattern.compile(pattern);`;
      const body = globalLike
        ? [
            'Matcher m = p.matcher(text);',
            'while (m.find()) {',
            '  System.out.println(m.group());',
            '}',
          ].join('\n')
        : [
            'Matcher m = p.matcher(text);',
            'if (m.find()) {',
            '  System.out.println(m.group());',
            '}',
          ].join('\n');
      return [
        '// Java',
        'import java.util.regex.*;',
        `String pattern = ${ps};`,
        compile,
        body,
      ].join('\n');
    }

    if (lang === 'go') {
      const goPrefix = flagsJsToGo(flags);
      // 用 (?im) 等内联标志放进 source
      const inlineFlags = goPrefix ? '(?' + goPrefix + ')' : '';
      const full = inlineFlags + pattern;
      const ps = goString(full);
      const call = globalLike
        ? 'matches := re.FindAllString(text, -1)'
        : 'm := re.FindString(text)';
      return [
        '// Go',
        'import "regexp"',
        `re := regexp.MustCompile(${ps})`,
        call,
      ].join('\n');
    }

    if (lang === 'php') {
      const ps = phpString(pattern, flags);
      const call = globalLike
        ? `preg_match_all(${ps}, $text, $matches);`
        : `preg_match(${ps}, $text, $matches);`;
      return [
        '<?php',
        '// PHP',
        call,
        'print_r($matches);',
      ].join('\n');
    }

    return '';
  }

  /* ---------- 下载 ---------- */
  function download(filename, content, mime) {
    try {
      const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 0);
    } catch (e) {
      // file:// 下个别浏览器可能拒绝 — 兜底用 data URI
      try {
        const a = document.createElement('a');
        a.href = 'data:' + (mime || 'text/plain') + ';charset=utf-8,' + encodeURIComponent(content);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (_) { /* give up silently */ }
    }
  }

  /* ---------- 代码导出弹层 ---------- */
  let dialogEl = null;
  let currentLang = 'js';

  function openCodeDialog(pattern, flags) {
    closeDialog();
    if (!pattern) return;
    const langs = [
      { id: 'js', label: 'JavaScript' },
      { id: 'python', label: 'Python' },
      { id: 'java', label: 'Java' },
      { id: 'go', label: 'Go' },
      { id: 'php', label: 'PHP' },
    ];
    const tabs = langs.map(l =>
      '<button class="ex-tab" data-lang="' + l.id + '">' + esc(l.label) + '</button>'
    ).join('');
    const html =
      '<div class="ex-dialog-backdrop"></div>' +
      '<div class="ex-dialog" role="dialog" aria-modal="true">' +
      '  <div class="ex-dialog-head">' +
      '    <h3>' + esc(t('export.codeTitle')) + '</h3>' +
      '    <button class="ex-close" title="' + escAttr(t('export.close')) + '">×</button>' +
      '  </div>' +
      '  <div class="ex-tabs">' + tabs + '</div>' +
      '  <pre class="ex-code"></pre>' +
      '  <div class="ex-dialog-foot">' +
      '    <button class="ex-copy fm-btn">' + esc(t('export.copy')) + '</button>' +
      '    <span class="ex-status"></span>' +
      '  </div>' +
      '</div>';

    dialogEl = document.createElement('div');
    dialogEl.className = 'ex-dialog-root';
    dialogEl.innerHTML = html;
    document.body.appendChild(dialogEl);

    const codeBox = dialogEl.querySelector('.ex-code');
    const status = dialogEl.querySelector('.ex-status');
    const tabBtns = dialogEl.querySelectorAll('.ex-tab');
    function selectLang(id) {
      currentLang = id;
      tabBtns.forEach(b => b.classList.toggle('active', b.dataset.lang === id));
      codeBox.textContent = toCode(id, pattern, flags || '');
    }
    tabBtns.forEach(b => b.addEventListener('click', () => selectLang(b.dataset.lang)));
    selectLang(currentLang);

    dialogEl.querySelector('.ex-copy').addEventListener('click', () => {
      const text = codeBox.textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(showCopied).catch(() => fallbackCopy(text, showCopied));
      } else {
        fallbackCopy(text, showCopied);
      }
      function showCopied() {
        status.textContent = t('side.copied');
        status.classList.add('is-ok');
        setTimeout(() => { status.textContent = ''; status.classList.remove('is-ok'); }, 1200);
      }
    });

    dialogEl.querySelector('.ex-close').addEventListener('click', closeDialog);
    dialogEl.querySelector('.ex-dialog-backdrop').addEventListener('click', closeDialog);
    document.addEventListener('keydown', onEsc);
  }

  function fallbackCopy(text, cb) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      cb && cb();
    } catch (e) { /* ignore */ }
  }

  function onEsc(e) { if (e.key === 'Escape') closeDialog(); }
  function closeDialog() {
    if (!dialogEl) return;
    dialogEl.remove();
    dialogEl = null;
    document.removeEventListener('keydown', onEsc);
  }

  /* ---------- 匹配详情抽屉 ---------- */
  let drawerEl = null;
  function openDetail(match, pattern, flags) {
    closeDrawer();
    if (!match) return;

    const groupsHtml = (match.groups || []).map((g, i) => {
      const idx = i + 1;
      const cls = 'hl-g' + (i % 6);
      const value = (g === undefined)
        ? '<span class="dr-undef">—</span>'
        : (g === '' ? '<span class="dr-empty">(empty)</span>'
                    : '<mark class="hl ' + cls + '">' + esc(g) + '</mark>');
      return '<div class="dr-row"><span class="dr-row-k">Group ' + idx + '</span><span class="dr-row-v">' + value + '</span></div>';
    }).join('');

    const namedHtml = match.namedGroups
      ? Object.keys(match.namedGroups).map(n => {
          const v = match.namedGroups[n];
          const value = (v === undefined) ? '—' : (v === '' ? '(empty)' : v);
          return '<div class="dr-row"><span class="dr-row-k">&lt;' + esc(n) + '&gt;</span><span class="dr-row-v">' + esc(value) + '</span></div>';
        }).join('')
      : '';

    const html =
      '<div class="dr-backdrop"></div>' +
      '<aside class="dr-panel" role="dialog" aria-modal="true">' +
      '  <div class="dr-head">' +
      '    <h3>' + esc(t('export.detailTitle')) + '</h3>' +
      '    <button class="dr-close" title="' + escAttr(t('export.close')) + '">×</button>' +
      '  </div>' +
      '  <div class="dr-body">' +
      '    <div class="dr-row"><span class="dr-row-k">' + esc(t('export.fldIndex')) + '</span><span class="dr-row-v">' + match.index + '</span></div>' +
      '    <div class="dr-row"><span class="dr-row-k">' + esc(t('export.fldLength')) + '</span><span class="dr-row-v">' + (match.length || 0) + '</span></div>' +
      '    <div class="dr-row dr-row-block"><span class="dr-row-k">' + esc(t('export.fldMatch')) + '</span>' +
      '      <div class="dr-row-v dr-match"><mark class="hl">' + esc(match.match || '') + '</mark></div>' +
      '    </div>' +
      (groupsHtml ? '<div class="dr-section-head">' + esc(t('export.fldGroups')) + '</div>' + groupsHtml : '') +
      (namedHtml ? '<div class="dr-section-head">' + esc(t('export.fldNamed')) + '</div>' + namedHtml : '') +
      (pattern ? '<div class="dr-section-head">' + esc(t('export.fldRegex')) + '</div>' +
        '<code class="dr-pat">/' + esc(pattern) + '/' + esc(flags || '') + '</code>' : '') +
      '  </div>' +
      '</aside>';

    drawerEl = document.createElement('div');
    drawerEl.className = 'dr-root';
    drawerEl.innerHTML = html;
    document.body.appendChild(drawerEl);

    drawerEl.querySelector('.dr-close').addEventListener('click', closeDrawer);
    drawerEl.querySelector('.dr-backdrop').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', onDrawerEsc);
    // 进场动画
    requestAnimationFrame(() => drawerEl && drawerEl.classList.add('is-open'));
  }
  function onDrawerEsc(e) { if (e.key === 'Escape') closeDrawer(); }
  function closeDrawer() {
    if (!drawerEl) return;
    drawerEl.remove();
    drawerEl = null;
    document.removeEventListener('keydown', onDrawerEsc);
  }

  window.Exporter = {
    toCSV: toCSV,
    toJSON: toJSON,
    toCode: toCode,
    download: download,
    openCodeDialog: openCodeDialog,
    closeCodeDialog: closeDialog,
    openDetail: openDetail,
    closeDetail: closeDrawer,
  };
})();
