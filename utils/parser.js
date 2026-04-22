/**
 * 入力パーサー - LINE メッセージから氏名・生年月日を抽出
 *
 * 対応フォーマット:
 *   田中花子 1990-05-15
 *   田中花子 1990/05/15
 *   田中花子 19900515
 *   田中花子 1990年5月15日
 *   田中花子 1990年05月15日
 */

const DATE_PATTERNS = [
  // YYYY年M月D日 / YYYY年MM月DD日
  {
    re: /(\d{4})年(\d{1,2})月(\d{1,2})日/,
    parse: (m) => ({ year: m[1], month: m[2], day: m[3] }),
  },
  // YYYY-MM-DD / YYYY/MM/DD (月日1〜2桁)
  {
    re: /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/,
    parse: (m) => ({ year: m[1], month: m[2], day: m[3] }),
  },
  // YYYYMMDD (8桁)
  {
    re: /(\d{4})(\d{2})(\d{2})(?!\d)/,
    parse: (m) => ({ year: m[1], month: m[2], day: m[3] }),
  },
];

function parseUserInput(text) {
  const clean = text.trim();

  if (['占う', '占い', 'やる', 'する'].includes(clean)) {
    return { isValid: false, command: 'start' };
  }

  for (const { re, parse } of DATE_PATTERNS) {
    const m = clean.match(re);
    if (!m) continue;

    const { year, month, day } = parse(m);
    const normalized = normalizeDate(year, month, day);
    if (!normalized) continue;

    // マッチした日付部分を除いて名前を取り出す
    const name = clean.replace(m[0], '').replace(/\s+/g, '').trim();

    if (!name) {
      return {
        isValid: false,
        error: 'お名前が読み取れませんでした。\nお名前と生年月日をスペースで区切ってお送りください。\n例：田中花子 1990-05-15',
      };
    }

    return { isValid: true, name, date: normalized };
  }

  return {
    isValid: false,
    error: 'お名前と生年月日をスペースで区切ってお送りください。\n例：田中花子 1990-05-15',
  };
}

function normalizeDate(yearStr, monthStr, dayStr) {
  const year  = parseInt(yearStr,  10);
  const month = parseInt(monthStr, 10);
  const day   = parseInt(dayStr,   10);

  if (year < 1900 || year > 2100) return null;
  if (month < 1   || month > 12)  return null;
  if (day   < 1   || day   > 31)  return null;

  // 実在する日付かチェック
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() + 1 !== month || d.getDate() !== day) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getInitialMessage() {
  const formatter = require('./formatter');
  return formatter.getWelcomeMessage().text;
}

function isThankYouMessage(text) {
  const THANK_KEYWORDS = [
    'ありがとう', '感動', '感謝', 'すごい', 'すごかった',
    '嬉しい', 'うれしい', 'よかった', '良かった',
    '素晴らしい', 'すばらしい', '最高', '感激', '泣ける', '泣いた',
  ];
  return THANK_KEYWORDS.some(keyword => text.includes(keyword));
}

module.exports = { parseUserInput, normalizeDate, getInitialMessage, isThankYouMessage };
