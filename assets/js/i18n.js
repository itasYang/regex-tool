/* ============================================================
 * i18n.js — 轻量国际化（English 默认 + 中文切换）
 * Phase 4 附加任务。挂到 window.I18n。
 *   - I18n.t(key, vars)   取译文，支持 {var} 插值，缺失回退英文再回退 key
 *   - I18n.setLang(lang)  切换并持久化（rt:lang）
 *   - I18n.matches(n)     命中数短语（处理英文单复数）
 * 静态 DOM 用 data-i18n / data-i18n-placeholder / data-i18n-title 标注，
 * 由 app.js 的 applyLang() 统一刷新；动态内容由各模块调用 I18n.t()。
 * ============================================================ */
(function () {
  'use strict';

  const dict = {
    en: {
      'app.title': 'Regex Tester',

      'tab.single': 'Single',
      'tab.multiline': 'Multiline',
      'tab.files': 'Filenames',
      'tab.replace': 'Replace',
      'tab.split': 'Split',
      'tab.capture': 'Capture',
      'tab.compare': 'Compare',
      'tab.unittest': 'Unit Test',
      'tab.grep': 'grep',
      'tab.explainer': 'Explainer',

      'regex.placeholder': 'Write your regex here…',
      'regex.flags': 'flags',

      'flag.g': 'Global match',
      'flag.i': 'Ignore case',
      'flag.m': 'Multiline (^ $ match each line)',
      'flag.s': 'Dot matches newline',
      'flag.u': 'Unicode mode',
      'flag.y': 'Sticky match',
      'flag.d': 'Indices for captures',

      'engine.title': 'Regex engine (enabled in Phase 7)',
      'engine.native': 'JS native',
      'engine.xregexp': 'XRegExp',
      'theme.toggle': 'Toggle theme',
      'lang.toggle': 'Switch to Chinese',
      'lang.label': '中文',

      'status.waiting': 'Waiting for regex',
      'status.valid': 'Valid regex',
      'status.timeout': 'Match timed out — possible catastrophic backtracking',

      'side.cheatsheet': 'Cheatsheet',
      'side.presets': 'Presets',
      'side.history': 'History',
      'side.ph.intro': 'The sidebar will be enabled in Phase 8:',
      'side.ph.cheatsheet': 'Cheatsheet — metacharacters, quantifiers, assertions, flags',
      'side.ph.presets': 'Presets — email, phone, URL, IP, date, ID, etc.',
      'side.ph.history': 'History — used regexes auto-saved locally',

      'stat.matches': 'Matches: ',
      'stat.time': 'Time: ',
      'stat.engine': 'Engine: ',
      'stat.dash': '—',
      'stat.ms': ' ms',
      'stat.hint': 'Ctrl/Cmd + Enter to re-run　Ctrl/Cmd + K to focus regex',

      'placeholder.willEnable': 'This mode will be enabled in {phase}.',
      'placeholder.tip': 'Currently Phase 4. The regex engine and the Single / Multiline / Filenames / Replace / Split modes are ready; the remaining modes will be added in later phases.',

      'common.regexError': 'Invalid regex: {msg}',
      'common.execError': 'Execution error: {msg}',
      'common.timeout': '⚠ Match timed out (>1s, possible catastrophic backtracking) and was aborted.',
      'common.aborted': 'aborted',
      'count.noMatch': 'no match',
      'count.match1': '{n} match',
      'count.matchN': '{n} matches',

      'single.textLabel': 'Test text',
      'single.textHint': 'Type text below; matches are highlighted',
      'single.textPlaceholder': 'e.g. Order ABC-123, amount $456.78, date 2026-05-26',
      'single.resultLabel': 'Highlighted result',
      'single.emptyHint': 'Enter a regex and test text; matches will be highlighted here.',
      'single.emptyText': '(test text is empty)',

      'multiline.label': 'Multiline text / logs',
      'multiline.hint': 'Paste multi-line content; full-text match with line numbers',
      'multiline.placeholder': 'Paste multi-line text here…\ne.g. a log with one record per line',
      'multiline.resultLabel': 'Match result',
      'multiline.emptyHint': 'Paste multi-line text above; results show here with line numbers.',
      'multiline.lines': '{n} lines',
      'multiline.noRegex': 'no regex',
      'multiline.jump': 'Jump to line {n}',

      'files.src.text': 'Lines',
      'files.src.preset': 'Samples',
      'files.src.folder': 'Folder',
      'files.src.listing': 'Paste ls/dir/tree',
      'files.src.generator': 'Generator',
      'files.text.placeholder': 'One filename per line, e.g.:\nApp.tsx\nindex.html\nREADME.md',
      'files.preset.label': 'Pick a sample file set',
      'files.preset.choose': '— choose —',
      'files.folder.prompt': 'Drag a folder here, or',
      'files.folder.choose': 'Choose folder',
      'files.folder.note': 'Reads filenames only, never file contents.',
      'files.listing.placeholder': 'Paste output of ls -l / Windows dir / tree; filenames are extracted automatically…',
      'files.listing.parse': 'Parse',
      'files.listing.hint': 'Supports ls -l, dir, tree (best effort).',
      'files.gen.label': 'Template ({0001-9999} numeric range, {a,b,c} enumeration)',
      'files.gen.run': 'Generate',
      'files.loaded': 'Loaded {n} filenames',
      'files.truncatedAt': '(over {cap}, truncated)',
      'files.gen.truncated': 'Hit limit {cap}, truncated',
      'files.stats.empty': 'No filenames yet. Provide filenames via any source above.',
      'files.stats.total': 'Total {n} filenames · enter a regex to split hit / miss',
      'files.word.hit': 'hit',
      'files.word.miss': 'miss',
      'files.word.total': 'total',
      'files.col.hit': 'Hit',
      'files.col.miss': 'Miss',
      'files.notApplied': '(regex not applied)',
      'files.more': '… {n} more',
      'files.sample.frontend': 'Frontend project',
      'files.sample.backend': 'Backend project',
      'files.sample.media': 'Media files',
      'files.sample.docs': 'Documents',
      'files.sample.logs': 'Log files',
      'files.sample.mixed': 'Mixed directory',

      'replace.srcLabel': 'Source text',
      'replace.srcHint': 'Text to run the replacement on',
      'replace.srcPlaceholder': 'e.g. 2026-05-26 and 2026-01-01',
      'replace.replLabel': 'Replace with',
      'replace.replHint': 'Supports $1 $2 $<name> backreferences',
      'replace.replPlaceholder': 'e.g. $3/$2/$1',
      'replace.modeAll': 'Replace all',
      'replace.modeFirst': 'Replace first',
      'replace.colOriginal': 'Original (highlighted)',
      'replace.colTemplate': 'Replacement template',
      'replace.colResult': 'Result',
      'replace.emptyHint': 'Enter a regex, source text and replacement to preview.',
      'replace.replaced1': '{n} replacement',
      'replace.replacedN': '{n} replacements',

      'split.label': 'Text to split',
      'split.hint': 'Split text by the regex; each segment is shown as a card',
      'split.placeholder': 'e.g. a, b ; c,d;e',
      'split.resultLabel': 'Segments',
      'split.emptyHint': 'Enter a regex and text; segments will appear here.',
      'split.needRegex': 'Enter a regex to split the text.',
      'split.segments': 'Split into {n} segments',
      'split.empty': '(empty)',
      'split.sepTitle': 'separator',
    },

    zh: {
      'app.title': '正则表达式测试器',

      'tab.single': '单句',
      'tab.multiline': '多行',
      'tab.files': '文件名',
      'tab.replace': '替换',
      'tab.split': '分割',
      'tab.capture': '捕获组',
      'tab.compare': '批量对比',
      'tab.unittest': '单元测试',
      'tab.grep': 'grep 过滤',
      'tab.explainer': '解释器',

      'regex.placeholder': '在这里写正则表达式…',
      'regex.flags': '标志',

      'flag.g': '全局匹配',
      'flag.i': '忽略大小写',
      'flag.m': '多行模式（^ $ 匹配每行）',
      'flag.s': '. 匹配换行符',
      'flag.u': 'Unicode 模式',
      'flag.y': '粘性匹配',
      'flag.d': '带索引的捕获',

      'engine.title': '正则引擎（Phase 7 启用）',
      'engine.native': 'JS 原生',
      'engine.xregexp': 'XRegExp',
      'theme.toggle': '切换主题',
      'lang.toggle': '切换到英文',
      'lang.label': 'EN',

      'status.waiting': '等待输入正则',
      'status.valid': '正则有效',
      'status.timeout': '匹配超时，可能灾难性回溯',

      'side.cheatsheet': '速查表',
      'side.presets': '常用库',
      'side.history': '历史',
      'side.ph.intro': '侧边栏将在 Phase 8 启用：',
      'side.ph.cheatsheet': '速查表 — 元字符、量词、断言、标志的语法速查',
      'side.ph.presets': '常用库 — 邮箱、手机、URL、IP、日期、身份证等',
      'side.ph.history': '历史 — 用过的正则自动保存到本地',

      'stat.matches': '匹配数：',
      'stat.time': '耗时：',
      'stat.engine': '引擎：',
      'stat.dash': '—',
      'stat.ms': ' ms',
      'stat.hint': 'Ctrl/Cmd + Enter 重跑　Ctrl/Cmd + K 聚焦正则',

      'placeholder.willEnable': '该模式将在 {phase} 启用。',
      'placeholder.tip': '当前为 Phase 4，已接入正则引擎与 单句 / 多行 / 文件名 / 替换 / 分割 模式，其余模式会在后续阶段逐个接入。',

      'common.regexError': '正则有误：{msg}',
      'common.execError': '执行出错：{msg}',
      'common.timeout': '⚠ 匹配超时（超过 1s，可能存在灾难性回溯），已中断。',
      'common.aborted': '已中断',
      'count.noMatch': '无命中',
      'count.match1': '{n} 处命中',
      'count.matchN': '{n} 处命中',

      'single.textLabel': '测试文本',
      'single.textHint': '在下面写一段文本，命中部分会高亮',
      'single.textPlaceholder': '例如：订单号 ABC-123，金额 ¥456.78，时间 2026-05-26',
      'single.resultLabel': '高亮结果',
      'single.emptyHint': '输入正则与测试文本后，命中部分会在这里高亮显示。',
      'single.emptyText': '（测试文本为空）',

      'multiline.label': '多行文本 / 日志',
      'multiline.hint': '粘贴多行内容，全文匹配并按行号定位',
      'multiline.placeholder': '在这里粘贴多行文本…\n例如一段日志，每行一条记录',
      'multiline.resultLabel': '匹配结果',
      'multiline.emptyHint': '在上方粘贴多行文本后，这里按行号显示匹配结果。',
      'multiline.lines': '{n} 行',
      'multiline.noRegex': '无正则',
      'multiline.jump': '跳到第 {n} 行',

      'files.src.text': '逐行输入',
      'files.src.preset': '示例集',
      'files.src.folder': '文件夹',
      'files.src.listing': '粘贴 ls/dir/tree',
      'files.src.generator': '批量生成',
      'files.text.placeholder': '每行一个文件名，例如：\nApp.tsx\nindex.html\nREADME.md',
      'files.preset.label': '选择一套示例文件集',
      'files.preset.choose': '— 请选择 —',
      'files.folder.prompt': '把文件夹拖到这里，或',
      'files.folder.choose': '选择文件夹',
      'files.folder.note': '只读取文件名，不读取文件内容。',
      'files.listing.placeholder': '粘贴 ls -l / Windows dir / tree 的输出，自动提取文件名…',
      'files.listing.parse': '解析',
      'files.listing.hint': '支持 ls -l、dir、tree 三种格式（尽力解析）。',
      'files.gen.label': '生成模板（{0001-9999} 数字区间、{a,b,c} 枚举）',
      'files.gen.run': '生成',
      'files.loaded': '已载入 {n} 个文件名',
      'files.truncatedAt': '（超过 {cap} 已截断）',
      'files.gen.truncated': '已达上限 {cap}，已截断',
      'files.stats.empty': '尚无文件名。请在上方任一来源里提供文件名。',
      'files.stats.total': '总计 {n} 个文件名 · 输入正则后区分命中 / 未命中',
      'files.word.hit': '命中',
      'files.word.miss': '未命中',
      'files.word.total': '总计',
      'files.col.hit': '命中',
      'files.col.miss': '未命中',
      'files.notApplied': '（未应用正则）',
      'files.more': '… 还有 {n} 个',
      'files.sample.frontend': '前端项目',
      'files.sample.backend': '后端项目',
      'files.sample.media': '媒体文件',
      'files.sample.docs': '文档资料',
      'files.sample.logs': '日志文件',
      'files.sample.mixed': '混合目录',

      'replace.srcLabel': '原文',
      'replace.srcHint': '要执行替换的文本',
      'replace.srcPlaceholder': '例如：2026-05-26 与 2026-01-01',
      'replace.replLabel': '替换为',
      'replace.replHint': '支持 $1 $2 $<name> 反向引用',
      'replace.replPlaceholder': '例如：$3/$2/$1',
      'replace.modeAll': '全部替换',
      'replace.modeFirst': '逐个替换',
      'replace.colOriginal': '原文（高亮）',
      'replace.colTemplate': '替换串模板',
      'replace.colResult': '结果',
      'replace.emptyHint': '输入正则、原文和替换串后，这里预览替换结果。',
      'replace.replaced1': '替换 {n} 处',
      'replace.replacedN': '替换 {n} 处',

      'split.label': '待分割文本',
      'split.hint': '用正则切分文本，每段显示为卡片',
      'split.placeholder': '例如：a, b ; c,d;e',
      'split.resultLabel': '分割结果',
      'split.emptyHint': '输入正则和文本后，这里显示分割结果。',
      'split.needRegex': '输入正则后开始分割。',
      'split.segments': '分成 {n} 段',
      'split.empty': '（空）',
      'split.sepTitle': '分隔符',
    },
  };

  const I18n = {
    lang: 'en',
    dict: dict,

    t(key, vars) {
      const table = this.dict[this.lang] || this.dict.en;
      let s = (table[key] != null) ? table[key]
        : (this.dict.en[key] != null ? this.dict.en[key] : key);
      if (vars) {
        s = s.replace(/\{(\w+)\}/g, function (m, k) {
          return vars[k] != null ? vars[k] : m;
        });
      }
      return s;
    },

    // 命中数短语，处理英文单复数
    matches(n) {
      if (n === 0) return this.t('count.noMatch');
      if (this.lang === 'en' && n === 1) return this.t('count.match1', { n: n });
      return this.t('count.matchN', { n: n });
    },

    setLang(lang) {
      if (lang !== 'en' && lang !== 'zh') return;
      this.lang = lang;
      if (window.Storage) window.Storage.set('lang', lang);
    },
  };

  // 读取持久化语言（默认英文）
  try {
    const saved = window.Storage ? window.Storage.get('lang', 'en') : 'en';
    if (saved === 'en' || saved === 'zh') I18n.lang = saved;
  } catch (e) {}

  window.I18n = I18n;
})();
