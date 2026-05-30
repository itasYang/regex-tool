/* ============================================================
 * presets.js — 常用正则库
 * Phase 8 实装。每条 { id, nameKey, pattern, flags, category, descKey? }。
 * 模板的英文/中文名字走 I18n.t()。
 * ============================================================ */

window.RegexPresets = [
  /* ---- 联系方式 ---- */
  {
    id: 'email',
    category: 'contact',
    nameKey: 'pr.email.name',
    pattern: '\\b[\\w.!#$%&\'*+/=?^`{|}~-]+@(?:[A-Za-z0-9-]+\\.)+[A-Za-z]{2,}\\b',
    flags: 'g',
    descKey: 'pr.email.desc',
  },
  {
    id: 'phone-cn',
    category: 'contact',
    nameKey: 'pr.phoneCN.name',
    pattern: '(?<!\\d)1[3-9]\\d{9}(?!\\d)',
    flags: 'g',
    descKey: 'pr.phoneCN.desc',
  },
  {
    id: 'phone-intl',
    category: 'contact',
    nameKey: 'pr.phoneIntl.name',
    pattern: '\\+?\\d{1,3}[\\s.-]?\\(?\\d{1,4}\\)?[\\s.-]?\\d{1,4}[\\s.-]?\\d{1,9}',
    flags: 'g',
    descKey: 'pr.phoneIntl.desc',
  },

  /* ---- 网络 / URL ---- */
  {
    id: 'url',
    category: 'web',
    nameKey: 'pr.url.name',
    pattern: 'https?:\\/\\/[\\w.-]+(?:\\.[\\w.-]+)+[\\w\\-._~:/?#[\\]@!$&\'()*+,;=%]*',
    flags: 'g',
    descKey: 'pr.url.desc',
  },
  {
    id: 'ipv4',
    category: 'web',
    nameKey: 'pr.ipv4.name',
    pattern: '\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b',
    flags: 'g',
    descKey: 'pr.ipv4.desc',
  },
  {
    id: 'ipv6',
    category: 'web',
    nameKey: 'pr.ipv6.name',
    pattern: '(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}|(?:[A-Fa-f0-9]{1,4}:){1,7}:|::(?:[A-Fa-f0-9]{1,4}:){0,6}[A-Fa-f0-9]{1,4}',
    flags: 'g',
    descKey: 'pr.ipv6.desc',
  },
  {
    id: 'mac',
    category: 'web',
    nameKey: 'pr.mac.name',
    pattern: '\\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\\b',
    flags: 'g',
    descKey: 'pr.mac.desc',
  },

  /* ---- 日期 / 时间 ---- */
  {
    id: 'date-iso',
    category: 'datetime',
    nameKey: 'pr.dateISO.name',
    pattern: '\\b\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])\\b',
    flags: 'g',
    descKey: 'pr.dateISO.desc',
  },
  {
    id: 'date-slash',
    category: 'datetime',
    nameKey: 'pr.dateSlash.name',
    pattern: '\\b(?:0?[1-9]|1[0-2])\\/(?:0?[1-9]|[12]\\d|3[01])\\/\\d{2,4}\\b',
    flags: 'g',
    descKey: 'pr.dateSlash.desc',
  },
  {
    id: 'time-24',
    category: 'datetime',
    nameKey: 'pr.time24.name',
    pattern: '\\b(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d)?\\b',
    flags: 'g',
    descKey: 'pr.time24.desc',
  },
  {
    id: 'iso-datetime',
    category: 'datetime',
    nameKey: 'pr.isoDateTime.name',
    pattern: '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:?\\d{2})?',
    flags: 'g',
    descKey: 'pr.isoDateTime.desc',
  },

  /* ---- 编号 / 证件 ---- */
  {
    id: 'cn-idcard',
    category: 'identifier',
    nameKey: 'pr.idCN.name',
    pattern: '\\b\\d{17}[\\dXx]\\b',
    flags: 'g',
    descKey: 'pr.idCN.desc',
  },
  {
    id: 'zip-cn',
    category: 'identifier',
    nameKey: 'pr.zipCN.name',
    pattern: '\\b[1-9]\\d{5}\\b',
    flags: 'g',
    descKey: 'pr.zipCN.desc',
  },
  {
    id: 'zip-us',
    category: 'identifier',
    nameKey: 'pr.zipUS.name',
    pattern: '\\b\\d{5}(?:-\\d{4})?\\b',
    flags: 'g',
    descKey: 'pr.zipUS.desc',
  },
  {
    id: 'credit-card',
    category: 'identifier',
    nameKey: 'pr.creditCard.name',
    pattern: '\\b(?:\\d{4}[ -]?){3}\\d{4}\\b',
    flags: 'g',
    descKey: 'pr.creditCard.desc',
  },
  {
    id: 'uuid',
    category: 'identifier',
    nameKey: 'pr.uuid.name',
    pattern: '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}',
    flags: 'g',
    descKey: 'pr.uuid.desc',
  },

  /* ---- 编码 / 数据 ---- */
  {
    id: 'hex-color',
    category: 'code',
    nameKey: 'pr.hexColor.name',
    pattern: '#(?:[0-9a-fA-F]{3}){1,2}\\b',
    flags: 'g',
    descKey: 'pr.hexColor.desc',
  },
  {
    id: 'base64',
    category: 'code',
    nameKey: 'pr.base64.name',
    pattern: '(?:[A-Za-z0-9+/]{4}){2,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?',
    flags: 'g',
    descKey: 'pr.base64.desc',
  },
  {
    id: 'html-tag',
    category: 'code',
    nameKey: 'pr.htmlTag.name',
    pattern: '<\\/?[a-zA-Z][^>]*>',
    flags: 'g',
    descKey: 'pr.htmlTag.desc',
  },
  {
    id: 'md-link',
    category: 'code',
    nameKey: 'pr.mdLink.name',
    pattern: '\\[([^\\]]+)\\]\\(([^)]+)\\)',
    flags: 'g',
    descKey: 'pr.mdLink.desc',
  },
  {
    id: 'integer',
    category: 'code',
    nameKey: 'pr.integer.name',
    pattern: '-?\\b\\d+\\b',
    flags: 'g',
    descKey: 'pr.integer.desc',
  },
  {
    id: 'float',
    category: 'code',
    nameKey: 'pr.float.name',
    pattern: '-?\\b\\d+\\.\\d+\\b',
    flags: 'g',
    descKey: 'pr.float.desc',
  },
  {
    id: 'whitespace',
    category: 'code',
    nameKey: 'pr.whitespace.name',
    pattern: '\\s+',
    flags: 'g',
    descKey: 'pr.whitespace.desc',
  },
];
