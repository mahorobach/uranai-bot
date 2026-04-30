/**
 * 有料鑑定の導線
 * - 現状: ココナラのサービスURLへ誘導（LINE上での決済・即時配信は行わない）
 * - 将来: PayJP 等の審査完了後、Checkout URL 生成 + Webhook で handlePaidFortune を呼ぶ形に差し替え可能
 */

const LABEL_MAP = {
  renai:   '恋愛運',
  zaiu:    '財運',
  shigoto: '仕事運',
  sougou:  '総合運',
  kotoshi: '時の運',
  /** Stripe/PayJP Webhook 用（セット鑑定）。ココナラ導線には出さない */
  sekkei:  '人生の設計図',
};

/** ココナラ誘導メニューに載せる鑑定タイプ（上から順） */
const COCONALA_MENU_TYPES = ['renai', 'zaiu', 'shigoto', 'sougou', 'kotoshi'];

const COCONALA_ENV_KEYS = {
  renai:   'COCONALA_URL_RENAI',
  zaiu:    'COCONALA_URL_ZAIU',
  shigoto: 'COCONALA_URL_SHIGOTO',
  sougou:  'COCONALA_URL_SOUGOU',
  kotoshi: 'COCONALA_URL_KOTOSHI',
};

function getCoconalaUrl(fortuneType) {
  const key = COCONALA_ENV_KEYS[fortuneType];
  if (!key) return '';
  const url = (process.env[key] || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) return '';
  return url;
}

/** 載せるボタン用URLが1件以上あるか */
function hasAnyCoconalaUrl() {
  return COCONALA_MENU_TYPES.some((t) => Boolean(getCoconalaUrl(t)));
}

module.exports = {
  LABEL_MAP,
  COCONALA_MENU_TYPES,
  getCoconalaUrl,
  hasAnyCoconalaUrl,
};
