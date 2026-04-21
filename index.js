require('dotenv').config();
const express = require('express');
const line    = require('@line/bot-sdk');

const { parseUserInput }                          = require('./utils/parser');
const { formatFortuneResult,
        formatPaidIntroMessage,
        formatPaymentMessage,
        formatErrorMessage,
        getWelcomeMessage }                        = require('./utils/formatter');
const { generateCompleteFortune }                 = require('./services/fortune');
const { getFromCache, saveToCache }               = require('./services/cache');

// ─── LINE 設定 ──────────────────────────────────────────────
const lineConfig = {
  channelSecret:      process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

// ─── Express ────────────────────────────────────────────────
const app = express();

app.get('/', (_req, res) => res.json({ status: 'ok', app: '占いの館' }));

app.post(
  '/webhook',
  (req, _res, next) => { console.log('Webhook受信'); next(); },
  line.middleware(lineConfig),
  async (req, res) => {
    res.json({ status: 'ok' });
    for (const event of req.body.events) {
      if (event.type === 'message' && event.message.type === 'text') {
        await handleMessage(event).catch((err) =>
          console.error('handleMessage エラー:', err),
        );
      }
    }
  },
);

// ─── キーワード定義 ──────────────────────────────────────────
const HELP_KEYWORDS    = ['ヘルプ', 'help', '?', 'start'];
const PAID_KEYWORDS    = ['続きを知りたい', '詳しく知りたい', '有料版'];
const PAYMENT_KEYWORDS = ['鑑定希望', '申込', '購入'];

// ─── メッセージ処理 ──────────────────────────────────────────
async function handleMessage(event) {
  const { replyToken } = event;
  const text = event.message.text.trim();

  console.log(`受信: "${text}"`);

  // ── ヘルプ ────────────────────────────────────────────────
  if (HELP_KEYWORDS.includes(text.toLowerCase())) {
    return reply(replyToken, getWelcomeMessage());
  }

  // ── 有料版案内 ────────────────────────────────────────────
  if (PAID_KEYWORDS.includes(text)) {
    console.log('有料版案内を返送');
    return reply(replyToken, formatPaidIntroMessage());
  }

  // ── 支払い案内 ────────────────────────────────────────────
  if (PAYMENT_KEYWORDS.includes(text)) {
    console.log('支払い案内を返送');
    return reply(replyToken, formatPaymentMessage());
  }

  // ── 占いリクエスト（氏名 + 生年月日） ─────────────────────
  const parsed = parseUserInput(text);

  if (!parsed.isValid) {
    if (parsed.command === 'start') {
      return reply(replyToken, getWelcomeMessage());
    }
    return reply(replyToken, formatErrorMessage(parsed.error));
  }

  const { name, date } = parsed;
  console.log(`鑑定対象: ${name} / ${date}`);

  // ── キャッシュ確認 ────────────────────────────────────────
  const cached = await getFromCache(name, date);
  if (cached) {
    console.log('⚡ キャッシュから返却');
    return reply(replyToken, formatFortuneResult(cached));
  }

  // ── Claude API で鑑定生成 ─────────────────────────────────
  console.log('📡 Claude API で鑑定生成中...');
  const fortune = await generateCompleteFortune(name, date);

  if (fortune.error) {
    return reply(replyToken, formatErrorMessage(fortune.error));
  }

  await saveToCache(fortune);
  console.log('✅ キャッシュ保存完了');

  return reply(replyToken, formatFortuneResult(fortune));
}

// ─── ユーティリティ ──────────────────────────────────────────
function reply(replyToken, message) {
  return lineClient.replyMessage({
    replyToken,
    messages: [message],
  });
}

// ─── 起動 ───────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🔮 占いの館 起動 → port:${PORT}`),
);
