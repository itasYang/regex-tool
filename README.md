# 正则表达式测试器 (Regex Tester)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Phase](https://img.shields.io/badge/Phase-2%2F10-blue.svg)](CLAUDE.md)
[![No Dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen.svg)](#)

一个纯前端、零构建、单页面的正则表达式测试工具。打开 `index.html` 即可使用。

## 特性

- **10 种测试模式**：单句 / 多行 / 文件名 / 替换 / 分割 / 捕获组 / 批量对比 / 单元测试 (TDD) / grep 过滤 / 可视化解释
- **双引擎**：JavaScript 原生 RegExp + XRegExp（PCRE 风格）可切换
- **命中高亮**：匹配部分彩色高亮，捕获组分色显示
- **辅助功能**：常用正则库、速查表、本地历史、性能信息、多语言代码导出、CSV/JSON 导出、匹配详情面板
- **暗/浅主题** 一键切换
- **性能保护**：内置超时熔断，防止灾难性回溯挂死浏览器

## 运行

直接用浏览器打开 `index.html` 即可。无需任何构建步骤、依赖安装、本地服务器。

> 如果你想用 ES Module 风格的代码结构，本项目采用传统 `<script>` 标签方式以保证 `file://` 协议下可用。

## 项目结构

```
regex-tester/
├── index.html              # 入口页面
├── assets/
│   ├── css/style.css       # 主题变量 + 布局样式
│   └── js/
│       ├── app.js          # 应用主入口
│       ├── engine.js       # 正则引擎封装（JS 原生 + XRegExp）
│       ├── highlight.js    # 高亮渲染
│       ├── storage.js      # localStorage 封装
│       ├── export.js       # 导出 / 代码生成
│       └── modes/          # 10 种模式各自一个文件
│           ├── single.js
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
    ├── presets.js          # 常用正则库
    ├── cheatsheet.js       # 速查表数据
    └── samples.js          # 示例文件集
```

## 分阶段开发计划

- [x] **Phase 1** — repo 骨架 + 主题样式 + 模式标签页占位
- [x] **Phase 2** — 核心引擎（编译 + 超时熔断）+ 模式 1（单句测试）
- [ ] **Phase 3** — 模式 2（多行）+ 模式 3（文件名）
- [ ] **Phase 4** — 模式 4（替换）+ 模式 5（分割）
- [ ] **Phase 5** — 模式 6（捕获组）+ 模式 7（批量对比）
- [ ] **Phase 6** — 模式 8（TDD）+ 模式 9（grep）+ 模式 10（解释器）
- [ ] **Phase 7** — XRegExp 双引擎切换
- [ ] **Phase 8** — 侧边栏（速查表 / 常用库 / 历史）
- [ ] **Phase 9** — 导出 / 代码生成 / 匹配详情面板
- [ ] **Phase 10** — 主题完善和整体 polish

## 模式说明

| 模式 | 用途 |
|---|---|
| **单句** | 一句话里测试正则能截取出什么 |
| **多行** | 大段文本/日志，找出所有匹配并带行号定位 |
| **文件名** | 输入一堆文件名，测试正则能命中哪些 |
| **替换** | 用 `$1 $2` 反向引用做正则替换，实时预览 |
| **分割** | 用正则切分字符串，可视化每个分段 |
| **捕获组** | 高亮每个捕获组（含命名捕获），不同组不同颜色 |
| **批量对比** | 同一段文本，并排跑多个正则做对比 |
| **TDD** | 「应匹配」/「不应匹配」两栏样例，红绿反馈 |
| **grep** | 像 grep / grep -v：只保留或只排除匹配的行 |
| **解释器** | 把正则拆解成自然语言描述，彩色对应 |

## 参与开发 / Continuing Development

本项目分阶段交付。每个阶段的详细架构约定、编码规范、验收标准都写在 [`CLAUDE.md`](CLAUDE.md) 里。

如果你是 **Claude Code**（或其他 AI 助手）准备接手继续开发：
1. **先完整读 `CLAUDE.md`** —— 那里有所有上下文、决策、约定
2. 浏览一遍现有代码（`index.html` / `app.js` / `style.css` / 任一 `modes/*.js`）了解风格
3. 按 `CLAUDE.md` §7 中下一个未完成阶段的验收清单逐项实现
4. 每个阶段完成后停下来等用户测试

## License

[MIT](LICENSE) © itasYang
