/**
 * LINE BOT レスポンスフォーマッタ
 */

// 五行の簡易説明
const ELEMENT_DESC = {
  木: '成長・柔軟・向上心',
  火: '情熱・行動力・カリスマ',
  土: '安定・誠実・包容力',
  金: '変化・決断・審美眼',
  水: '流動・知性・感受性',
};

/** LINEに届かないマークダウン記号を除去 */
function stripMarkdown(text) {
  return text
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^[-*]\s+/gm, '・')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .trim();
}

// ─── 無料版鑑定結果 ──────────────────────────────────────────────
function formatFortuneResult(fortuneData) {
  if (fortuneData.error) {
    return { type: 'text', text: `❌ エラー\n${fortuneData.error}` };
  }

  const meta       = fortuneData.metadata ?? {};
  const fortune    = stripMarkdown(fortuneData.fortune ?? fortuneData.fortune_text ?? '');
  const element    = meta.element ?? '';
  const sureiNum   = meta.surei_number ?? fortuneData.sureiNumber ?? '';
  const elemDesc   = ELEMENT_DESC[element] ?? '';

  const text = [
    `✨ ${fortuneData.name}さんの無料鑑定 ✨`,
    `📅 生年月日: ${fortuneData.date}（${fortuneData.age}歳）`,
    '',
    '【基本性格・才能】',
    fortune,
    '',
    '【五行・数霊】',
    element  ? `🌟 主五行: ${element}（${elemDesc}）` : '',
    sureiNum ? `🔢 数霊数: ${sureiNum}番` : '',
    '',
    '─────────────────',
    '✨ 続きが気になりますか？',
    '恋愛・仕事・年運・人間関係の',
    '詳しい鑑定は有料版でお届けします。',
    '',
    '👇「続きを知りたい」と送ってください',
  ].filter(Boolean).join('\n').trim();

  return { type: 'text', text };
}

// ─── 有料版案内 ──────────────────────────────────────────────────
function formatPaidIntroMessage() {
  return {
    type: 'text',
    text: [
      '🔮 有料鑑定のご案内',
      '',
      '【有料版で分かること】',
      '・今年・来年の年運詳細',
      '・恋愛・結婚の傾向と時期',
      '・仕事・転職・財運の流れ',
      '・人間関係と相性',
      '・月ごとの運気リズム',
      '',
      '💰 料金: 1,000円（税込）',
      '',
      '鑑定をご希望の方は',
      '「鑑定希望」と送ってください。',
    ].join('\n'),
  };
}

// ─── 支払い案内（プレースホルダー） ──────────────────────────────
function formatPaymentMessage() {
  return {
    type: 'text',
    text: [
      '💳 お支払い案内',
      '',
      '【お支払い方法】',
      'クレジットカード / PayPay / LINE Pay',
      '',
      '【ご注意】',
      '※ 決済機能は現在準備中です。',
      '※ 近日公開予定をお楽しみに！',
      '',
      'お問い合わせ・事前予約はこちら:',
      '▶ [お問い合わせ先プレースホルダー]',
    ].join('\n'),
  };
}

// ─── エラー・ウェルカム ───────────────────────────────────────────
function formatErrorMessage(errorText) {
  return { type: 'text', text: `❌ エラー\n${errorText}` };
}

function getWelcomeMessage() {
  return {
    type: 'text',
    text: [
      '🔮 占いの館へようこそ！',
      '',
      'AI占い師が四柱推命と数霊で、',
      'あなたの運命を読み解きます。',
      '',
      '【使い方】',
      '氏名と生年月日をスペースで区切って入力してください。',
      '',
      '📝 例：',
      '田中花子 1990-05-15',
      '田中花子 1990/05/15',
      '田中花子 19900515',
      '田中花子 1990年5月15日',
      '',
      'さあ、運命を紐解いてみましょう！',
    ].join('\n'),
  };
}

module.exports = {
  formatFortuneResult,
  formatPaidIntroMessage,
  formatPaymentMessage,
  formatErrorMessage,
  getWelcomeMessage,
};
