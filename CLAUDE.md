# CLAUDE.md — 项目上下文（给 Claude Code 接手时读）

> 这是一份给 Claude Code（CLI 工具）的项目说明。如果你是 Claude Code 读到这里，
> 请先完整读完本文件再动手。这里说明了项目的所有决策、约定和未完成阶段的具体验收标准。

---

## 1. 项目是什么

**正则表达式测试器（regex-tester）** —— 一个纯前端、零依赖、零构建的单页网页应用。
打开 `index.html` 即可使用，无需任何服务器或安装步骤。

目标用户：开发者、文本处理需求者。
核心价值：把正则测试从「单句匹配」扩展到 **10 种测试模式**，并提供命中高亮、双引擎切换、可视化解释等辅助。

---

## 2. 已经定下的关键决策（不要再改）

| 决策 | 选择 | 理由 |
|---|---|---|
| 技术栈 | 原生 HTML/CSS/JS（无框架、无构建） | 用户要求 `file://` 直接打开 |
| 模块组织 | 传统 `<script>` 标签 + IIFE，**不用** ES module | ES module 在 `file://` 下有 CORS 限制 |
| 正则引擎 | JS 原生 + XRegExp 可切换（Phase 7 接 XRegExp） | 已用 AskUserQuestion 跟用户确认 |
| 模式数量 | 10 个（见 §4） | 已用 AskUserQuestion 跟用户确认 |
| 历史存储 | localStorage | 单 HTML 文件 + 本地存储不会丢 |
| 性能保护 | 必须有超时熔断 | 防止灾难性回溯挂死浏览器 |
| 主题 | 浅色 + 暗色，CSS 变量切换 | 已实现 |
| UI 语言 | 中文（简体） | 用户母语 |
| License | MIT，署名 `itasYang`，Copyright 2026 | 已确认 |

---

## 3. 技术约束 / 编码规范

### 3.1 必须遵守
1. **IIFE 包裹所有 JS 文件**：每个 JS 文件用 `(function(){ ... })();` 包裹，避免污染全局。
2. **全局通过 `window.X` 注册**：模块对外暴露通过 `window.App`、`window.Engine`、`window.Modes.<name>` 等。
3. **HTML 转义**：任何用户输入要进入 DOM 前必须用 `Highlight.escape()`。绝不直接 `innerHTML = userText`。
4. **CSS 用变量**：颜色/间距/字体一律用 `var(--xxx)`，不要硬编码颜色。新增变量加到 `:root` 和 `[data-theme="dark"]`。
5. **超时熔断**：所有正则执行要包在 `Engine.execWithTimeout(...)` 里（Phase 2 实现），默认 1000ms。
6. **零外部依赖**：除了 Phase 7 引入 XRegExp（从 CDN 加载），其它不要新增依赖。
7. **不引入任何构建工具**：不加 webpack/vite/rollup/typescript 编译。保持双击 `index.html` 就能跑。

### 3.2 命名约定
- localStorage key 前缀：`rt:`（如 `rt:theme`, `rt:history`）
- CSS class 高亮捕获组：`hl-g0` 到 `hl-g5`（已在 style.css 里定义）
- 模式 ID：英文短词（`single`, `multiline`, `files`, `replace`, `split`, `capture`, `compare`, `unittest`, `grep`, `explainer`）
- 模式注册：每个模式 JS 文件向 `window.Modes` 注册一个对象

### 3.3 文件位置约定
- 新增数据 → `data/`
- 新增工具函数 → `assets/js/<name>.js`（用前先在 `index.html` 加 `<script>` 引用）
- 新增模式 → `assets/js/modes/<id>.js`
- 不要把多个模式塞同一个文件

---

## 4. 10 种模式清单

| ID | 中文名 | 用途 | 计划阶段 |
|---|---|---|---|
| `single` | 单句测试 | 一句话里测试正则能截取什么 | Phase 2 |
| `multiline` | 多行测试 | 大段文本/日志，全文匹配带行号 | Phase 3 |
| `files` | 文件名测试 | 输入文件名集合，测试正则能命中哪些 | Phase 3 |
| `replace` | 替换 | 用 `$1 $2` 反向引用做替换，实时预览 | Phase 4 |
| `split` | 分割 | 用正则切分文本，可视化分段 | Phase 4 |
| `capture` | 捕获组 | 每个捕获组（含命名）用不同颜色高亮 | Phase 5 |
| `compare` | 批量对比 | 同一段文本并排跑 2-4 个正则对比 | Phase 5 |
| `unittest` | 单元测试 | 「应匹配」/「不应匹配」两栏 TDD 风格 | Phase 6 |
| `grep` | grep 过滤 | 像 grep / grep -v：保留或排除匹配行 | Phase 6 |
| `explainer` | 可视化解释器 | 把正则拆解成自然语言描述，彩色对应 | Phase 6 |

---

## 5. 架构 / 文件结构

```
regex-tester/
├── index.html              # 单页入口；引用所有 CSS/JS
├── README.md               # 用户向说明
├── CLAUDE.md               # 本文件（开发上下文）
├── LICENSE                 # MIT
├── .gitignore
│
├── assets/
│   ├── css/style.css       # 主题变量 + 全部样式（单文件）
│   └── js/
│       ├── app.js          # 主入口，挂载到 window.App
│       ├── engine.js       # 引擎封装，挂到 window.Engine
│       ├── highlight.js    # 高亮渲染，挂到 window.Highlight
│       ├── storage.js      # localStorage 封装，挂到 window.Storage（已可用）
│       ├── export.js       # 导出 + 代码生成（Phase 9）
│       └── modes/
│           ├── single.js   # 每个模式注册到 window.Modes.<id>
│           ├── multiline.js
│           ├── files.js
│           ├── replace.js
│           ├── split.js
│           ├── capture.js
│           ├── compare.js
│           ├── unittest.js
│           ├── grep.js
│           └── explainer.js
└── data/
    ├── presets.js          # 常用正则库（Phase 8 填充）
    ├── cheatsheet.js       # 速查表（Phase 8 填充）
    └── samples.js          # 文件名示例集（Phase 3 填充）
```

### 5.1 模块依赖关系（脚本加载顺序很重要）

`index.html` 已按下面顺序加载，**新增脚本一定要遵守**：

```
1. data/*.js       （纯数据，先于一切）
2. storage.js      （无依赖）
3. engine.js       （无依赖）
4. highlight.js    （无依赖）
5. export.js       （无依赖）
6. modes/*.js      （可能依赖 Engine、Highlight）
7. app.js          （最后，依赖所有 Modes 已注册）
```

### 5.2 模式模块的标准接口

每个 `modes/<id>.js` 应该注册这样一个对象：

```javascript
(function () {
  window.Modes = window.Modes || {};
  window.Modes.<id> = {
    name: '<中文名>',
    phase: <数字>,
    
    /**
     * 必须实现：当用户切到这个模式时被调用
     * @param {HTMLElement} panel - id="mode-panel" 的容器
     */
    mount(panel) {
      panel.innerHTML = `<div>...</div>`;
      // 绑定事件
      // 监听全局正则输入变化（订阅 App.events 或直接读 App.state）
    },
    
    /**
     * 可选：当用户离开这个模式时被调用
     */
    unmount() {
      // 清理监听器、定时器等
    },
    
    /**
     * 可选：正则或标志变化时被调用（Phase 2 起会有这个回调）
     * @param {RegExp|null} regex 已编译的正则（编译失败时为 null）
     * @param {string} pattern 原始 pattern
     * @param {string} flags 原始 flags
     */
    onRegexChange(regex, pattern, flags) {
      // 重新跑匹配并更新 UI
    },
  };
})();
```

### 5.3 App 状态结构（Phase 2 起扩展）

```javascript
window.App.state = {
  theme: 'light' | 'dark',
  mode: 'single' | 'multiline' | ...,
  engine: 'native' | 'xregexp',
  sidebar: 'cheatsheet' | 'presets' | 'history',
  
  // Phase 2 新增
  pattern: '',          // 当前正则
  flags: 'g',
  regex: null,          // 编译后的 RegExp，编译失败为 null
  regexError: null,     // 错误信息字符串
  
  // 各模式自己的状态由模式模块管，不要污染全局 state
};
```

### 5.4 事件总线建议

Phase 2 实现时建议在 `App` 上加一个简单的事件系统：

```javascript
App.events = {
  on(event, cb) { ... },
  off(event, cb) { ... },
  emit(event, ...args) { ... },
};
```

需要的事件：
- `regex:change` - 正则或标志变了，参数：`(regex, pattern, flags)`
- `mode:change` - 模式切换，参数：`(newMode, oldMode)`
- `engine:change` - 引擎切换（Phase 7），参数：`(newEngine)`
- `theme:change` - 主题切换，参数：`(newTheme)`

---

## 6. 当前状态（Phase 1 完成时）

### 6.1 已实现 ✅
- 完整 HTML 骨架（顶栏、正则条、10 模式标签、侧边栏、底部状态栏）
- 浅色/暗色主题切换（localStorage 持久化，✓ 已测）
- 10 个模式标签页切换（点击切换 active 状态 + 显示占位提示）
- 侧边栏 tab 切换（3 个 tab：速查表/常用库/历史）
- 标志位按钮（g i m s u y d）—— 点击切换 active 和标志输入框，**但还没有连到引擎**
- 键盘快捷键骨架（`Ctrl/Cmd+K` 聚焦正则框，已绑定但因输入框 disabled 而无效果）
- Storage 模块完整可用（get/set/remove，含可用性检测）

### 6.2 未实现（占位状态） ❌
- 正则输入框是 `disabled` 的
- Engine 是占位实现（没有超时熔断）
- Highlight 只有 escape，没有真正的高亮渲染
- 所有 10 个模式都只有空 `{ name, phase }` 注册，没有 `mount()`
- Exporter 是空对象
- presets / cheatsheet / samples 都是空数组
- 引擎切换按钮 disabled，没有功能

### 6.3 关键接口已就绪
- `window.App.state` - 全局状态
- `window.App.renderModePanel(mode)` - 切换模式时自动调用，会优先调用 `Modes[mode].mount(panel)`
- `window.Storage` - 完全可用
- 主题切换、模式切换、侧边栏切换的事件绑定已完成

---

## 7. 剩余 9 个阶段的详细验收标准

### Phase 2 — 核心引擎 + 单句测试 🔥（下一步）

**改动范围：** `engine.js`, `highlight.js`, `app.js`, `modes/single.js`, `index.html`（解除 input disabled）

**验收清单：**
- [ ] `index.html` 把 `#regex-pattern` 和 `#regex-flags` 的 `disabled` 属性移除
- [ ] `Engine.compile(pattern, flags)` 返回 `{ ok, regex, error }`
- [ ] `Engine.execWithTimeout(regex, text, timeoutMs)` 用 Web Worker 或 `Date.now()` 轮询实现超时熔断（默认 1000ms）
  - 建议方案：因为 Worker 跨域加载麻烦，用 inline Worker（`new Worker(URL.createObjectURL(new Blob([code], {type:'application/javascript'})))`）
  - 或者退化方案：单次 `exec` 加 try-catch，但灾难性回溯无法中断 —— 那就在状态栏显示警告 "可能存在灾难性回溯"
- [ ] `Highlight.render(text, ranges)` 真正实现：根据 `ranges` 把 `<mark class="hl">` 插入到文本里，输出安全 HTML
- [ ] `App.state` 新增 `pattern / flags / regex / regexError` 字段
- [ ] `App.events` 实现简单 on/off/emit
- [ ] `app.js` 监听正则输入框和标志输入框，防抖 200ms 后编译并 emit `regex:change`
- [ ] 标志位按钮和标志输入框双向同步
- [ ] 正则输入框实时校验：编译失败时输入框边框变红，状态指示器红点 + 错误信息
- [ ] `modes/single.js`：mount 时渲染「测试文本」textarea + 「高亮结果」展示区
- [ ] 单句模式订阅 `regex:change`，重新跑匹配并刷新高亮
- [ ] 底部状态栏更新：匹配数、耗时
- [ ] 顶栏版本号从 `v0.1 · Phase 1` 改成 `v0.2 · Phase 2`

**手动验证步骤：**
1. 输入正则 `\d+`，测试文本 `abc 123 def 456`，应看到 `123` 和 `456` 高亮
2. 输入空正则 → 无错误、无高亮
3. 输入非法正则 `[`  → 输入框红边 + 状态指示红点
4. 输入 `(a+)+` + 文本 `aaaaaaaaaaaaaaaaaaaaaaaaaaaaa!` → 应在 1s 内中断或显示警告
5. 切换 i/m 标志 → 按钮 active 状态和标志框文本同步
6. 切到其他模式标签页 → 应显示占位（其它模式还没接入）

---

### Phase 3 — 多行文本 + 文件名

**改动范围：** `modes/multiline.js`, `modes/files.js`, `data/samples.js`

**Phase 3a · 多行测试：**
- [ ] 大 textarea 接收多行文本
- [ ] 渲染区显示带行号的结果；匹配项高亮
- [ ] 点击行号可以跳到对应行（如果实现得到）
- [ ] 性能：1MB 文本要在 200ms 内渲染完

**Phase 3b · 多文件名测试：**
- [ ] 文件名输入区支持 5 种来源（用 tab 切换）：
  1. **文本框逐行输入**（默认）
  2. **预置示例集**：下拉选「前端项目 / 后端项目 / 媒体文件 / 文档 / 日志」等，从 `data/samples.js` 加载
  3. **拖拽真实文件夹**：用 `<input type="file" webkitdirectory>` 或拖放 API 读取文件名（不读内容）
  4. **粘贴 ls/dir/tree 输出**：解析 `ls -la` / `dir` / `tree` 三种格式，自动提取文件名
  5. **批量生成器**：输入模板如 `IMG_{0001-9999}.{jpg,png}`，生成文件名列表
- [ ] 结果分两栏：「命中」和「未命中」，分别显示文件名列表
- [ ] 顶部显示统计：「N 命中 / M 未命中 / 总计 K」
- [ ] `data/samples.js` 填充至少 5 套示例集

**`data/samples.js` 格式：**
```javascript
window.FileSamples = [
  {
    id: 'frontend',
    name: '前端项目',
    files: ['App.tsx', 'index.html', 'package.json', 'README.md', ...],
  },
  {
    id: 'logs',
    name: '日志文件',
    files: ['access.log', 'error.log.2024-01-01', ...],
  },
  // ...
];
```

---

### Phase 4 — 替换 + 分割

**Phase 4a · 替换：**
- [ ] 输入区两个 textarea：「原文」+「替换为」
- [ ] 替换串支持 `$1` `$2` `$<name>` 反向引用
- [ ] 三栏对比：原文（带高亮）/ 替换串模板 / 结果（替换后的文本）
- [ ] 可切换"逐个替换"vs"全部替换"（强制加/不加 g 标志）

**Phase 4b · 分割：**
- [ ] 输入区一个 textarea
- [ ] 结果区把 `text.split(regex)` 的每个分段显示成卡片，分隔符以分隔条显示
- [ ] 显示「分成 N 段」统计

---

### Phase 5 — 捕获组 + 批量对比

**Phase 5a · 捕获组：**
- [ ] 复用单句/多行模式的输入，但渲染更精细：每个捕获组用不同的 `hl-g0`~`hl-g5` 类高亮
- [ ] 命名捕获 `(?<name>...)` 在底部显示名字
- [ ] 下方表格列出所有匹配：序号 / 完整匹配 / 各组的值

**Phase 5b · 批量对比：**
- [ ] UI：上方一个共享的测试文本框，下方 2-4 行小正则输入，每行独立标志位
- [ ] 每行右边显示该正则的命中数和高亮预览（缩略）
- [ ] 颜色编码区分不同正则的命中

---

### Phase 6 — TDD + grep + 解释器

**Phase 6a · TDD 单元测试：**
- [ ] 两个列表：「应匹配」「不应匹配」，每行一个样例，可增删
- [ ] 每个样例旁边实时显示 ✓（通过）/ ✗（不通过）
- [ ] 顶部进度条：N/M 通过
- [ ] 全绿时整个面板有微妙的成功反馈（边框变绿等）

**Phase 6b · grep：**
- [ ] 大 textarea 接收多行文本
- [ ] 模式开关：「只保留匹配行（grep）」/「只保留不匹配行（grep -v）」
- [ ] 选项：「显示行号」「上下文行数 -A/-B/-C」
- [ ] 结果区显示过滤后的行，匹配部分仍高亮

**Phase 6c · 可视化解释器（最难的一个）：**
- [ ] 解析正则 AST（可以手写简单解析器，覆盖：字符类、量词、分组、断言、反向引用、转义）
- [ ] 把每个 AST 节点翻译成中文描述（"匹配 1 个或多个数字"）
- [ ] 上方显示原正则，每段不同背景色；下方对应位置显示中文描述
- [ ] 鼠标悬停某个描述时，原正则对应段高亮，反之亦然
- [ ] 不要求 100% 覆盖 PCRE 全部语法，**先覆盖常用的就行**：`.` `*` `+` `?` `{n,m}` `[abc]` `[^abc]` `\d \w \s` `(...)` `(?:...)` `(?<name>...)` `(?=...)` `(?!...)` `^ $` `|`

---

### Phase 7 — XRegExp 双引擎

- [ ] 在 `index.html` 引入 XRegExp（建议从 cdnjs 加载并提供本地降级）
  - CDN: `https://cdnjs.cloudflare.com/ajax/libs/xregexp/5.1.1/xregexp-all.min.js`
- [ ] 顶栏的引擎切换开关解除 disabled
- [ ] `Engine.setEngine('native' | 'xregexp')` 切换内部实现
- [ ] 切换后所有模式重新跑匹配
- [ ] localStorage 记忆引擎选择
- [ ] 状态栏「引擎」字段同步更新

---

### Phase 8 — 侧边栏

**Phase 8a · 速查表（`data/cheatsheet.js`）：**
- [ ] 至少 8 个分类：元字符、量词、字符类、断言、分组、反向引用、标志、Unicode
- [ ] 每条带 `symbol` + `desc` + 可选 `example`
- [ ] 点击某条 → 把 `symbol` 复制到剪贴板（或插入到正则输入框光标处）

**Phase 8b · 常用正则库（`data/presets.js`）：**
- [ ] 至少 20 个常用：邮箱、手机（中国大陆/国际）、URL、IPv4、IPv6、日期（多种格式）、时间、身份证、邮编、信用卡、十六进制颜色、UUID、Base64、HTML 标签、Markdown 链接 等
- [ ] 分类组织，点击「使用」把 pattern + flags 填到正则输入框

**Phase 8c · 历史：**
- [ ] 自动保存：每次正则编译成功后保存到 `Storage`，去重 + 限制最多 50 条
- [ ] 列表显示：截断的 pattern + 时间戳 + flags
- [ ] 点击恢复到正则输入框
- [ ] 单条删除按钮 + 顶部「清空所有」按钮

---

### Phase 9 — 导出 + 代码生成 + 匹配详情

**Phase 9a · 多语言代码导出：**
- [ ] 顶栏加个「导出代码」按钮，点开弹层显示当前正则在 JS / Python / Java / Go / PHP 中的代码片段
- [ ] 每个语言带「复制」按钮
- [ ] 正确处理各语言的字符串转义（如 Python r-string、Java 双反斜杠、Go 反引号）

**Phase 9b · 结果导出：**
- [ ] 单句/多行/捕获组等结果模式右上角加「导出 CSV」/「导出 JSON」按钮
- [ ] CSV：每行一个匹配，列：index, length, full_match, group_1, group_2...
- [ ] JSON：完整结构化数据

**Phase 9c · 匹配详情面板：**
- [ ] 点击任意高亮项 → 弹出右侧抽屉
- [ ] 显示：index, length, 完整匹配文本, 每个捕获组（含命名）的值

---

### Phase 10 — 主题 + Polish + 最终验证

- [ ] 主题切换加平滑过渡动画（200ms ease）
- [ ] 所有 hover / focus 状态打磨
- [ ] 完整快捷键：`Ctrl+Enter` 重跑、`Ctrl+K` 聚焦、`Ctrl+L` 清空、`Ctrl+1~0` 切模式
- [ ] 移动端验证（< 600px）：所有模式都要能用
- [ ] 验证 Chrome / Firefox / Safari 三大浏览器
- [ ] README 加截图（每个模式来一张）
- [ ] 头部加 LICENSE 徽章和版本徽章
- [ ] 顶栏版本号改成 `v1.0`

---

## 8. 通用验证 / 测试方法

由于这是纯前端项目无构建，没有单元测试框架。**建议每完成一个 Phase 就**：

1. **语法检查**：`node --check assets/js/*.js assets/js/modes/*.js data/*.js`
2. **手动浏览器测试**：用上述每个 Phase 的「手动验证步骤」逐项过一遍
3. **多浏览器**：至少在 Chrome 和 Firefox 跑一次
4. **XSS 自检**：测试文本里输入 `<script>alert(1)</script>` 不应触发弹窗
5. **性能自检**：开 Chrome DevTools Performance 录制，1MB 文本匹配应该 < 200ms

如果 Claude Code 能用 Playwright/Puppeteer MCP，可以做自动化截图验证。

---

## 9. 常见陷阱（容易踩的坑）

1. **XSS**：用户输入的测试文本最终要进 DOM。**永远先 `Highlight.escape()`**。
2. **正则 g 标志的副作用**：`RegExp` 对象有 `lastIndex`，多次调用会跳着匹配。要么每次新建 RegExp，要么手动重置 `lastIndex = 0`。
3. **`matchAll` 必须带 g 标志**，否则报错。Engine 里要兼容处理。
4. **灾难性回溯**：`(a+)+b` 配 `aaaa...c` 会卡死浏览器。必须有超时熔断。
5. **CSS 变量在 dark 主题下要重写**：新增颜色变量要同时在 `:root` 和 `[data-theme="dark"]` 加。
6. **Unicode 文件名**：文件名模式要考虑中文/emoji 文件名。
7. **localStorage 配额**：历史记录要限长度（建议最多 50 条，每条 pattern 截断到 500 字符）。
8. **`file://` 限制**：不能 `fetch()` 本地文件、不能用 ES module。已规避，别引入。

---

## 10. 用户已表达的偏好

- **不要一次性做完所有功能** —— 按 Phase 分阶段交付，每个 Phase 做完停下来给用户看效果
- **GitHub repo 描述定为**：「零构建的浏览器端正则测试器，支持 10 种测试模式（单句/多行/文件名/替换/捕获等），JS 原生 + XRegExp 双引擎，命中部分彩色高亮。」
- **回复用中文**

---

## 11. 推荐工作流

如果你是 Claude Code 准备接手：

1. **第一步**：完整读完本文件 + `README.md`
2. **第二步**：浏览一次现有代码：
   - `index.html`（外壳结构）
   - `assets/js/app.js`（已实装的部分，看 IIFE 和事件绑定的风格）
   - `assets/css/style.css`（主题变量怎么定义的）
   - 任意一个 `modes/*.js`（看现有占位结构）
3. **第三步**：开始 Phase 2，按本文件 §7 的 Phase 2 验收清单一条条做
4. **第四步**：每完成一个 Phase，更新 README 的进度勾选 + 改顶栏版本号 + 让用户测试一轮
5. **不要跳阶段**。每阶段都是后续阶段的地基。

祝接手顺利。如果发现本文档有错或想改架构决策，**先跟用户确认**再动手。
