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
    '🔮 鑑定にはまだ続きがあります',
    '',
    '・恋愛｜あなたが求める愛の形と、縁が動く時期',
    '・仕事｜才能が最も輝く舞台と、転機のサイン',
    '・財運｜お金との向き合い方と、豊かさの流れ',
    '・本質と対人｜隠れた素顔と、深い縁を結ぶ人',
    '',
    '4つが揃ったとき、あなたの全体像が見えてきます。',
    'ご希望の方は「詳しくを知りたい」と送ってください。',
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

// ─── サービス説明 ────────────────────────────────────────────────
function formatAboutMessage() {
  return {
    type: 'text',
    text: [
      '🔮 月読み診断とは',
      '四柱推命と数霊を組み合わせた',
      'AI占いサービスです。',
      '',
      '【四柱推命】',
      '生年月日から年柱・月柱・日柱を算出し、',
      'あなたの本質的な性格・才能・運命を読み解きます。',
      '',
      '【数霊】',
      'お名前の漢字の画数から導き出す数霊数で、',
      'あなたが持つ固有のエネルギーを鑑定します。',
      '',
      'Claude AIが一人ひとりに合わせた',
      '温かみのある鑑定文を生成します。',
    ].join('\n'),
  };
}

// ─── 使い方 ──────────────────────────────────────────────────────
function formatHowtoMessage() {
  return {
    type: 'text',
    text: [
      '📖 使い方',
      '',
      '【無料鑑定の受け方】',
      'お名前と生年月日をスペースで区切って入力するだけです。',
      '',
      '📝 入力例：',
      '田中花子 1990-05-15',
      '田中花子 1990/05/15',
      '田中花子 19900515',
      '田中花子 1990年5月15日',
      '',
      '【メニューの使い方】',
      '・無料 → 無料鑑定の案内',
      '・恋愛・仕事・本格鑑定 → 有料鑑定の案内',
      '・月読み診断とは → このサービスの説明',
      '・使い方 → この画面',
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
      '🌙 月読みの導きへようこそ',
      '',
      '四柱推命と数霊を用いて、',
      'あなたの本質・才能・これからの流れを',
      '丁寧に読み解いてまいります。',
      '',
      '【鑑定の受け方】',
      'お名前と生年月日をスペースで区切って',
      'そのままお送りください。',
      '',
      '📝 例：',
      '田中花子 1990-05-15',
      '田中花子 1990/05/15',
      '田中花子 19900515',
      '田中花子 1990年5月15日',
      '',
      'あなたの命式をお待ちしております。',
    ].join('\n'),
  };
}

module.exports = {
  formatFortuneResult,
  formatPaidIntroMessage,
  formatPaymentMessage,
  formatAboutMessage,
  formatHowtoMessage,
  formatErrorMessage,
  getWelcomeMessage,
};
