/* ============================================================
 * 模式 10：可视化解释器 — Phase 6 实装
 * 把正则 pattern 拆解成 AST，逐段彩色对应原文。
 * 上方：原正则，每个 token 用颜色包裹；下方：自然语言描述列表。
 * 鼠标悬停任一侧 → 另一侧对应节点高亮（双向联动）。
 *
 * 覆盖范围（按 CLAUDE §7 Phase 6c 要求）：
 *   . * + ? {n,m} [abc] [^abc] \d \w \s \D \W \S \b \B
 *   (…) (?:…) (?<name>…) (?=…) (?!…) (?<=…) (?<!…)
 *   ^ $ |   \1 反向引用    懒/独占量词    转义字符
 * 不在覆盖范围内的少量高级语法（如 \p{...}、(?(cond)yes|no)）作为字面回退处理。
 *
 * 解析器 = 递归下降。所有 AST 节点带 [start, end) 引用回 pattern 源串。
 * 渲染时：两侧元素都打 data-node-id，hover 触发同 id 的高亮。
 * ============================================================ */
(function () {
  'use strict';

  window.Modes = window.Modes || {};
  const t = (k, v) => window.I18n.t(k, v);
  function esc(s) { return window.Highlight.escape(s); }
  function escAttr(s) { return esc(s).replace(/\n/g, '&#10;'); }

  /* ====================================================== */
  /* 解析器                                                  */
  /* ====================================================== */
  function parse(source) {
    let i = 0;
    let nodeIdSeq = 0;
    let captureIdx = 0;
    const namedGroups = [];

    function mk(type, extra, startPos) {
      return Object.assign({
        nodeId: nodeIdSeq++,
        type: type,
        start: startPos,
        end: i,
      }, extra || {});
    }

    function err(msg) { throw new Error(msg + ' at pos ' + i); }
    function peek(off) { return source[i + (off || 0)]; }
    function consume() { return source[i++]; }

    function parsePattern() { return parseAlternation(); }

    function parseAlternation() {
      const startPos = i;
      const options = [parseSequence()];
      while (peek() === '|') {
        consume();
        options.push(parseSequence());
      }
      if (options.length === 1) return options[0];
      return { nodeId: nodeIdSeq++, type: 'Alt', options: options, start: startPos, end: i };
    }

    function parseSequence() {
      const startPos = i;
      const children = [];
      while (i < source.length && peek() !== '|' && peek() !== ')') {
        const atomStart = i;
        let atom = parseAtom();
        if (!atom) break;
        atom = maybeQuantifier(atom, atomStart);
        children.push(atom);
      }
      if (children.length === 1) return children[0];
      return { nodeId: nodeIdSeq++, type: 'Sequence', children: children, start: startPos, end: i };
    }

    function maybeQuantifier(atom, atomStart) {
      const c = peek();
      if (c !== '*' && c !== '+' && c !== '?' && c !== '{') return atom;
      if (c === '{') {
        const m = /^\{(\d+)(?:,(\d*))?\}/.exec(source.slice(i));
        if (!m) return atom;
        const len = m[0].length;
        const min = parseInt(m[1], 10);
        const max = (m[2] === undefined) ? min : (m[2] === '' ? Infinity : parseInt(m[2], 10));
        i += len;
        const lazy = peek() === '?'; if (lazy) consume();
        const possessive = peek() === '+'; if (possessive) consume();
        return {
          nodeId: nodeIdSeq++, type: 'Quantified',
          atom: atom, min: min, max: max, lazy: lazy, possessive: possessive,
          start: atomStart, end: i,
        };
      }
      consume();
      const lazy = peek() === '?'; if (lazy) consume();
      const possessive = peek() === '+'; if (possessive) consume();
      let min, max;
      if (c === '*') { min = 0; max = Infinity; }
      else if (c === '+') { min = 1; max = Infinity; }
      else { min = 0; max = 1; }
      return {
        nodeId: nodeIdSeq++, type: 'Quantified',
        atom: atom, min: min, max: max, lazy: lazy, possessive: possessive,
        start: atomStart, end: i,
      };
    }

    function parseAtom() {
      const startPos = i;
      const c = peek();
      if (c === undefined) return null;
      if (c === '(') return parseGroup(startPos);
      if (c === '[') return parseCharClass(startPos);
      if (c === '.') { consume(); return mk('Dot', {}, startPos); }
      if (c === '^') { consume(); return mk('Anchor', { which: 'start' }, startPos); }
      if (c === '$') { consume(); return mk('Anchor', { which: 'end' }, startPos); }
      if (c === '\\') return parseEscape(startPos);
      consume();
      return mk('Literal', { value: c }, startPos);
    }

    function parseGroup(startPos) {
      consume(); // '('
      let kind = 'capture';
      let name = null;
      let assignedIdx = null;
      if (peek() === '?') {
        consume();
        const c2 = peek();
        if (c2 === ':') { consume(); kind = 'noncapture'; }
        else if (c2 === '=') { consume(); kind = 'lookahead'; }
        else if (c2 === '!') { consume(); kind = 'neglookahead'; }
        else if (c2 === '<') {
          consume();
          const c3 = peek();
          if (c3 === '=') { consume(); kind = 'lookbehind'; }
          else if (c3 === '!') { consume(); kind = 'neglookbehind'; }
          else {
            let n = '';
            while (peek() !== undefined && peek() !== '>') { n += consume(); }
            if (peek() === '>') consume();
            kind = 'namedcapture';
            name = n;
            captureIdx += 1;
            assignedIdx = captureIdx;
            namedGroups.push({ name: name, index: assignedIdx });
          }
        } else {
          kind = 'noncapture';
        }
      } else {
        captureIdx += 1;
        assignedIdx = captureIdx;
      }

      const body = parseAlternation();
      if (peek() === ')') consume();

      return {
        nodeId: nodeIdSeq++, type: 'Group',
        kind: kind, name: name, index: assignedIdx, body: body,
        start: startPos, end: i,
      };
    }

    function parseCharClass(startPos) {
      consume(); // '['
      let negate = false;
      if (peek() === '^') { negate = true; consume(); }
      const items = [];
      while (i < source.length && peek() !== ']') {
        let s = i;
        let a;
        if (peek() === '\\') {
          const e = readEscapeChar();
          a = { type: 'escape', source: source.slice(s, i), value: e.value, kind: e.kind };
        } else {
          const ch = consume();
          a = { type: 'char', value: ch, source: ch };
        }
        if (peek() === '-' && source[i + 1] !== ']' && source[i + 1] !== undefined) {
          consume();
          let b;
          if (peek() === '\\') {
            const e = readEscapeChar();
            b = { value: e.value, source: source.slice(s, i) };
          } else {
            const ch = consume();
            b = { value: ch };
          }
          items.push({ type: 'range', from: a.value, to: b.value, source: source.slice(s, i) });
        } else {
          items.push(a);
        }
      }
      if (peek() === ']') consume();
      return {
        nodeId: nodeIdSeq++, type: 'CharClass',
        negate: negate, items: items,
        start: startPos, end: i,
      };
    }

    function readEscapeChar() {
      const s = i;
      consume(); // '\'
      const c = peek();
      if (c === undefined) return { value: '\\', kind: 'literal' };
      consume();
      return { value: c, kind: classifyEscape(c), source: source.slice(s, i) };
    }

    function classifyEscape(c) {
      if ('dDwWsSbB'.indexOf(c) !== -1) return 'class';
      if (c >= '0' && c <= '9') return 'backref';
      if ('ntrfv0'.indexOf(c) !== -1) return 'literal';
      return 'literal';
    }

    function parseEscape(startPos) {
      consume(); // '\\'
      const c = peek();
      if (c === undefined) return mk('Literal', { value: '\\' }, startPos);
      if (c >= '0' && c <= '9') {
        let num = '';
        while (peek() && peek() >= '0' && peek() <= '9') num += consume();
        return mk('Backref', { n: parseInt(num, 10) }, startPos);
      }
      if (c === 'k' && source[i + 1] === '<') {
        consume();
        consume();
        let n = '';
        while (peek() !== undefined && peek() !== '>') n += consume();
        if (peek() === '>') consume();
        return mk('Backref', { name: n }, startPos);
      }
      if ('dDwWsSbB'.indexOf(c) !== -1) {
        consume();
        return mk('CharEscape', { which: c }, startPos);
      }
      if ('ntrfv0'.indexOf(c) !== -1) {
        consume();
        return mk('CharEscape', { which: c, kind: 'control' }, startPos);
      }
      if (c === 'x' || c === 'u' || c === 'c') {
        consume();
        if (c === 'x') { for (let k = 0; k < 2 && /[0-9a-fA-F]/.test(peek() || ''); k++) consume(); }
        else if (c === 'u') {
          if (peek() === '{') {
            consume();
            while (peek() && peek() !== '}') consume();
            if (peek() === '}') consume();
          } else {
            for (let k = 0; k < 4 && /[0-9a-fA-F]/.test(peek() || ''); k++) consume();
          }
        } else if (c === 'c') {
          if (peek()) consume();
        }
        return mk('CharEscape', { which: c, kind: 'escape' }, startPos);
      }
      consume();
      return mk('EscapedLiteral', { value: c }, startPos);
    }

    let ast;
    try { ast = parsePattern(); }
    catch (e) { return { error: e.message }; }

    if (i < source.length) {
      const leftover = source.slice(i);
      const tail = { nodeId: nodeIdSeq++, type: 'RawTail', value: leftover, start: i, end: source.length };
      i = source.length;
      if (ast.type === 'Sequence') ast.children.push(tail);
      else ast = { nodeId: nodeIdSeq++, type: 'Sequence', children: [ast, tail], start: 0, end: source.length };
    }

    return { ast: ast, captureCount: captureIdx, namedGroups: namedGroups, source: source };
  }

  /* ====================================================== */
  /* 描述生成                                                */
  /* ====================================================== */
  function describe(parsed, flags) {
    const steps = [];
    function push(node, depth, text) {
      steps.push({ nodeId: node.nodeId, depth: depth, text: text });
    }
    function walk(node, depth) {
      switch (node.type) {
        case 'Sequence': {
          node.children.forEach(ch => walk(ch, depth));
          return;
        }
        case 'Alt': {
          const opts = node.options.map(() => '…').join(t('ex.altOr'));
          push(node, depth, t('ex.alt', { x: opts }));
          node.options.forEach(ch => walk(ch, depth + 1));
          return;
        }
        case 'Group': {
          let head;
          if (node.kind === 'capture') head = t('ex.group', { n: node.index });
          else if (node.kind === 'namedcapture') head = t('ex.groupNamed', { name: node.name || '', n: node.index });
          else if (node.kind === 'noncapture') head = t('ex.groupNonCapture');
          else if (node.kind === 'lookahead') head = t('ex.lookahead');
          else if (node.kind === 'neglookahead') head = t('ex.negLookahead');
          else if (node.kind === 'lookbehind') head = t('ex.lookbehind');
          else if (node.kind === 'neglookbehind') head = t('ex.negLookbehind');
          else head = node.kind;
          push(node, depth, head);
          walk(node.body, depth + 1);
          return;
        }
        case 'Quantified': {
          const before = steps.length;
          walk(node.atom, depth);
          let target = -1;
          for (let k = steps.length - 1; k >= before; k--) {
            if (steps[k].depth === depth) { target = k; break; }
          }
          const qStr = quantText(node);
          if (target >= 0) steps[target].text += ' ' + qStr;
          else push(node, depth, qStr);
          if (target >= 0) steps[target].nodeId = node.nodeId;
          return;
        }
        case 'Literal':
          push(node, depth, t('ex.literal', { x: visible(node.value) })); return;
        case 'EscapedLiteral':
          push(node, depth, t('ex.escape', { x: visible(node.value) })); return;
        case 'Dot': {
          const isDotAll = flags && flags.indexOf('s') !== -1;
          push(node, depth, isDotAll ? t('ex.dotAll') : t('ex.dot'));
          return;
        }
        case 'Anchor': {
          const isMulti = flags && flags.indexOf('m') !== -1;
          if (node.which === 'start') push(node, depth, t('ex.start', { m: isMulti ? t('ex.startMulti') : '' }));
          else push(node, depth, t('ex.end', { m: isMulti ? t('ex.endMulti') : '' }));
          return;
        }
        case 'CharEscape': {
          const w = node.which;
          if (w === 'd') push(node, depth, t('ex.digit'));
          else if (w === 'D') push(node, depth, t('ex.nonDigit'));
          else if (w === 'w') push(node, depth, t('ex.word'));
          else if (w === 'W') push(node, depth, t('ex.nonWord'));
          else if (w === 's') push(node, depth, t('ex.space'));
          else if (w === 'S') push(node, depth, t('ex.nonSpace'));
          else if (w === 'b') push(node, depth, t('ex.boundary'));
          else if (w === 'B') push(node, depth, t('ex.nonBoundary'));
          else if (w === 'n') push(node, depth, t('ex.literal', { x: '\\n (newline)' }));
          else if (w === 't') push(node, depth, t('ex.literal', { x: '\\t (tab)' }));
          else if (w === 'r') push(node, depth, t('ex.literal', { x: '\\r' }));
          else push(node, depth, t('ex.escape', { x: '\\' + w }));
          return;
        }
        case 'CharClass': {
          const desc = node.items.map(itemDescribe).join(', ');
          push(node, depth, node.negate ? t('ex.charClassNeg', { x: desc }) : t('ex.charClass', { x: desc }));
          return;
        }
        case 'Backref':
          if (node.name) push(node, depth, t('ex.backrefNamed', { name: node.name }));
          else push(node, depth, t('ex.backref', { n: node.n }));
          return;
        case 'RawTail':
          push(node, depth, t('ex.literal', { x: visible(node.value) }));
          return;
      }
    }
    function itemDescribe(it) {
      if (it.type === 'range') return t('ex.rangeOf', { a: visible(it.from), b: visible(it.to) });
      if (it.type === 'escape') {
        const k = it.value;
        if (k === 'd') return t('ex.digit');
        if (k === 'D') return t('ex.nonDigit');
        if (k === 'w') return t('ex.word');
        if (k === 'W') return t('ex.nonWord');
        if (k === 's') return t('ex.space');
        if (k === 'S') return t('ex.nonSpace');
        if (k === 'n') return '\\n';
        if (k === 't') return '\\t';
        if (k === 'r') return '\\r';
        return '\\' + k;
      }
      return visible(it.value);
    }
    walk(parsed.ast, 0);
    return steps;
  }

  function quantText(q) {
    let s;
    if (q.min === 0 && q.max === 1) s = t('ex.quantOpt');
    else if (q.min === 0 && q.max === Infinity) s = t('ex.quantStar');
    else if (q.min === 1 && q.max === Infinity) s = t('ex.quantPlus');
    else if (q.min === q.max) s = t('ex.quantExact', { n: q.min });
    else if (q.max === Infinity) s = t('ex.quantAtLeast', { n: q.min });
    else s = t('ex.quantRange', { n: q.min, m: q.max });
    if (q.lazy) s += t('ex.quantLazy');
    if (q.possessive) s += t('ex.quantPossessive');
    return s;
  }

  function visible(s) {
    if (s === '') return '∅';
    if (s == null) return '';
    return JSON.stringify(String(s)).slice(1, -1);
  }

  /* ====================================================== */
  /* 把 AST 渲染成"原正则带颜色"                              */
  /* ====================================================== */
  function flatten(ast, source) {
    const segs = [];
    let colorCounter = 0;
    function nextColor() { return colorCounter++ % 6; }

    function pushAtomLike(node) {
      segs.push({ start: node.start, end: node.end, nodeId: node.nodeId, color: nextColor(), kind: node.type });
    }

    function walk(node) {
      switch (node.type) {
        case 'Sequence':
          node.children.forEach(walk);
          return;
        case 'Alt':
          {
            let pos = node.options[0].end;
            for (let k = 1; k < node.options.length; k++) {
              const opt = node.options[k];
              const startBar = pos;
              const endBar = opt.start;
              if (endBar > startBar) {
                segs.push({ start: startBar, end: endBar, nodeId: node.nodeId, color: nextColor(), kind: 'AltBar' });
              }
              pos = opt.end;
            }
          }
          node.options.forEach(walk);
          return;
        case 'Group': {
          const color = nextColor();
          const headEnd = node.body.start;
          segs.push({ start: node.start, end: headEnd, nodeId: node.nodeId, color: color, kind: 'GroupOpen' });
          walk(node.body);
          if (node.end > node.body.end) {
            segs.push({ start: node.body.end, end: node.end, nodeId: node.nodeId, color: color, kind: 'GroupClose' });
          }
          return;
        }
        case 'Quantified': {
          walk(node.atom);
          if (node.end > node.atom.end) {
            segs.push({ start: node.atom.end, end: node.end, nodeId: node.nodeId, color: nextColor(), kind: 'Quant' });
          }
          return;
        }
        case 'CharClass':
        case 'Literal':
        case 'EscapedLiteral':
        case 'Dot':
        case 'Anchor':
        case 'CharEscape':
        case 'Backref':
        case 'RawTail':
          pushAtomLike(node);
          return;
      }
    }
    walk(ast);
    segs.sort((a, b) => a.start - b.start);
    return segs;
  }

  function renderTokens(source, segs) {
    if (!segs.length) return esc(source);
    let html = '';
    let pos = 0;
    for (const s of segs) {
      if (s.start > pos) html += esc(source.slice(pos, s.start));
      const slice = source.slice(s.start, s.end);
      if (slice === '') continue;
      html += '<span class="ex-tok ex-c' + s.color + '" data-node="' + s.nodeId + '">' + esc(slice) + '</span>';
      pos = s.end;
    }
    if (pos < source.length) html += esc(source.slice(pos));
    return html;
  }

  function renderSteps(steps) {
    if (!steps.length) return '<span class="result-hint">' + esc(t('explainer.empty')) + '</span>';
    return steps.map(s => {
      const indent = Math.min(8, s.depth) * 14;
      return '<div class="ex-step" data-node="' + s.nodeId + '" style="padding-left:' + indent + 'px">' +
             esc(s.text) + '</div>';
    }).join('');
  }

  /* ====================================================== */
  /* 模式骨架                                                */
  /* ====================================================== */
  function tpl() {
    return [
      '<div class="mode-card">',
      '  <div class="field">',
      '    <label class="field-label">',
      '      ' + esc(t('explainer.label')),
      '      <span class="field-hint">' + esc(t('explainer.hint')) + '</span>',
      '    </label>',
      '    <div class="ex-grid">',
      '      <div class="ex-col">',
      '        <div class="ex-col-head">' + esc(t('explainer.tokens')) + '</div>',
      '        <div id="ex-tokens" class="ex-tokens"></div>',
      '      </div>',
      '      <div class="ex-col">',
      '        <div class="ex-col-head">' + esc(t('explainer.steps')) + '</div>',
      '        <div id="ex-steps" class="ex-steps"></div>',
      '      </div>',
      '    </div>',
      '    <div class="ex-note">' + esc(t('explainer.unsupported')) + '</div>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  let panelRef = null;
  let tokensBox = null;
  let stepsBox = null;
  let onRegexChange = null;
  let hoverCleanup = null;

  function bindHover() {
    if (!panelRef) return;
    const clear = () => panelRef.querySelectorAll('.ex-tok.is-active, .ex-step.is-active')
                          .forEach(el => el.classList.remove('is-active'));
    const handler = (e) => {
      const node = e.target.closest('[data-node]');
      if (!node) { clear(); return; }
      const id = node.getAttribute('data-node');
      clear();
      panelRef.querySelectorAll('[data-node="' + id + '"]').forEach(el => el.classList.add('is-active'));
    };
    panelRef.addEventListener('mouseover', handler);
    panelRef.addEventListener('mouseleave', clear);
    hoverCleanup = () => {
      panelRef.removeEventListener('mouseover', handler);
      panelRef.removeEventListener('mouseleave', clear);
    };
  }

  function run() {
    if (!tokensBox || !stepsBox) return;
    const App = window.App;
    const pattern = App.state.pattern;
    const flags = App.state.flags || '';
    const err = App.state.regexError;

    if (err) {
      tokensBox.innerHTML = esc(pattern);
      stepsBox.innerHTML = '<span class="result-hint result-error">' + esc(t('explainer.parseError', { msg: err })) + '</span>';
      App.setStats(null, null);
      return;
    }
    if (!pattern) {
      tokensBox.innerHTML = '<span class="result-hint">' + esc(t('explainer.empty')) + '</span>';
      stepsBox.innerHTML = '';
      App.setStats(0, null);
      return;
    }

    const start = (performance && performance.now) ? performance.now() : Date.now();
    const parsed = parse(pattern);
    if (parsed.error) {
      tokensBox.innerHTML = esc(pattern);
      stepsBox.innerHTML = '<span class="result-hint result-error">' + esc(t('explainer.parseError', { msg: parsed.error })) + '</span>';
      App.setStats(null, null);
      return;
    }
    const segs = flatten(parsed.ast, parsed.source);
    const steps = describe(parsed, flags);
    tokensBox.innerHTML = renderTokens(parsed.source, segs);
    stepsBox.innerHTML = renderSteps(steps);
    const elapsed = ((performance && performance.now) ? performance.now() : Date.now()) - start;
    App.setStats(steps.length, elapsed);
  }

  window.Modes.explainer = {
    name: '解释器',
    phase: 6,

    mount(panel) {
      panelRef = panel;
      panel.innerHTML = tpl();
      tokensBox = panel.querySelector('#ex-tokens');
      stepsBox = panel.querySelector('#ex-steps');

      bindHover();

      onRegexChange = function () { run(); };
      window.App.events.on('regex:change', onRegexChange);

      run();
    },

    unmount() {
      if (onRegexChange) window.App.events.off('regex:change', onRegexChange);
      onRegexChange = null;
      if (hoverCleanup) { hoverCleanup(); hoverCleanup = null; }
      panelRef = tokensBox = stepsBox = null;
    },
  };
})();
