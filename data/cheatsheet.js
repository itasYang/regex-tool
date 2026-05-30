/* ============================================================
 * cheatsheet.js — 速查表数据
 * Phase 8 实装。每条 { symbol, descKey, exampleKey? } —— UI 用 I18n.t() 取译文。
 * 分类 ID 与文案：categoryKey 走 i18n。
 * ============================================================ */

window.RegexCheatsheet = [
  {
    id: 'meta',
    nameKey: 'cs.cat.meta',
    items: [
      { symbol: '.',  descKey: 'cs.meta.dot' },
      { symbol: '\\', descKey: 'cs.meta.escape' },
      { symbol: '|',  descKey: 'cs.meta.alt' },
      { symbol: '^',  descKey: 'cs.meta.start' },
      { symbol: '$',  descKey: 'cs.meta.end' },
    ],
  },
  {
    id: 'quantifier',
    nameKey: 'cs.cat.quantifier',
    items: [
      { symbol: '*',     descKey: 'cs.q.star' },
      { symbol: '+',     descKey: 'cs.q.plus' },
      { symbol: '?',     descKey: 'cs.q.opt' },
      { symbol: '{n}',   descKey: 'cs.q.exact' },
      { symbol: '{n,}',  descKey: 'cs.q.atleast' },
      { symbol: '{n,m}', descKey: 'cs.q.range' },
      { symbol: '*?',    descKey: 'cs.q.lazy' },
    ],
  },
  {
    id: 'charclass',
    nameKey: 'cs.cat.charclass',
    items: [
      { symbol: '[abc]',  descKey: 'cs.cc.set' },
      { symbol: '[^abc]', descKey: 'cs.cc.neg' },
      { symbol: '[a-z]',  descKey: 'cs.cc.range' },
      { symbol: '\\d',    descKey: 'cs.cc.digit' },
      { symbol: '\\D',    descKey: 'cs.cc.nondigit' },
      { symbol: '\\w',    descKey: 'cs.cc.word' },
      { symbol: '\\W',    descKey: 'cs.cc.nonword' },
      { symbol: '\\s',    descKey: 'cs.cc.space' },
      { symbol: '\\S',    descKey: 'cs.cc.nonspace' },
    ],
  },
  {
    id: 'assertion',
    nameKey: 'cs.cat.assertion',
    items: [
      { symbol: '\\b',     descKey: 'cs.a.b' },
      { symbol: '\\B',     descKey: 'cs.a.B' },
      { symbol: '(?=...)', descKey: 'cs.a.la' },
      { symbol: '(?!...)', descKey: 'cs.a.nla' },
      { symbol: '(?<=...)',descKey: 'cs.a.lb' },
      { symbol: '(?<!...)',descKey: 'cs.a.nlb' },
    ],
  },
  {
    id: 'group',
    nameKey: 'cs.cat.group',
    items: [
      { symbol: '(...)',       descKey: 'cs.g.capture' },
      { symbol: '(?:...)',     descKey: 'cs.g.noncapture' },
      { symbol: '(?<name>...)',descKey: 'cs.g.named' },
    ],
  },
  {
    id: 'backref',
    nameKey: 'cs.cat.backref',
    items: [
      { symbol: '\\1',       descKey: 'cs.b.num' },
      { symbol: '\\k<name>', descKey: 'cs.b.named' },
      { symbol: '$1',        descKey: 'cs.b.replNum' },
      { symbol: '$<name>',   descKey: 'cs.b.replNamed' },
    ],
  },
  {
    id: 'flag',
    nameKey: 'cs.cat.flag',
    items: [
      { symbol: 'g', descKey: 'cs.f.g' },
      { symbol: 'i', descKey: 'cs.f.i' },
      { symbol: 'm', descKey: 'cs.f.m' },
      { symbol: 's', descKey: 'cs.f.s' },
      { symbol: 'u', descKey: 'cs.f.u' },
      { symbol: 'y', descKey: 'cs.f.y' },
      { symbol: 'd', descKey: 'cs.f.d' },
    ],
  },
  {
    id: 'unicode',
    nameKey: 'cs.cat.unicode',
    items: [
      { symbol: '\\n',        descKey: 'cs.u.n' },
      { symbol: '\\t',        descKey: 'cs.u.t' },
      { symbol: '\\r',        descKey: 'cs.u.r' },
      { symbol: '\\xHH',      descKey: 'cs.u.x' },
      { symbol: '\\uHHHH',    descKey: 'cs.u.u4' },
      { symbol: '\\u{HHHH}',  descKey: 'cs.u.uBrace' },
      { symbol: '\\p{...}',   descKey: 'cs.u.p' },
    ],
  },
];
