require('dotenv').config();
const express = require('express');
const line    = require('@line/bot-sdk');
const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY);

const { parseUserInput }                          = require('./utils/parser');
const { formatFortuneResult,
        formatPaidIntroMessage,
        formatPaymentMessage,
        formatAboutMessage,
        formatHowtoMessage,
        formatErrorMessage,
        getWelcomeMessage }                        = require('./utils/formatter');
const { generateCompleteFortune,
        generatePaidFortune }                      = require('./services/fortune');
const { getFromCache, saveToCache }               = require('./services/cache');
const { createCheckoutSession, LABEL_MAP }        = require('./services/payment');

// ─── LINE 設定 ──────────────────────────────────────────────
const lineConfig = {
  channelSecret:      process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

// ─── ユーザーの直近占い結果を記憶（lineUserId → { name, date }）
const userFortuneMap = new Map();

// ─── Express ────────────────────────────────────────────────
const app = express();

app.get('/', (_req, res) => res.json({ status: 'ok', app: '月読みの導き' }));

// Stripe Webhook（raw body が必要なので LINE より先に定義）
app.post(
  '/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body, sig, process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      console.error('Webhook署名エラー:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { lineUserId, fortuneType, userName, birthDate } = session.metadata;
      await handlePaidFortune(lineUserId, fortuneType, userName, birthDate);
    }

    res.json({ received: true });
  },
);

// LINE Webhook
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
const PAID_KEYWORDS    = ['続きを知りたい', '詳しく知りたい', '詳しくを知りたい', '有料版'];
const PAYMENT_KEYWORDS = ['鑑定希望', '申込', '購入'];
const MENU_FREE_KEYWORDS  = ['無料鑑定'];
const MENU_PAID_KEYWORDS  = ['有料鑑定'];
const MENU_ABOUT_KEYWORDS = ['月読み診断とは'];
const MENU_HOWTO_KEYWORDS = ['使い方'];

// 「鑑定:〇〇」テキスト → fortuneType のマップ
const FORTUNE_TYPE_MAP = {
  '鑑定:恋愛':     'renai',
  '鑑定:仕事':     'shigoto',
  '鑑定:財運':     'zaiu',
  '鑑定:本質と対人': 'honshitsu',
};

// ─── LINE Flex Message: 鑑定タイプ選択 ──────────────────────
const PAID_FLEX_MESSAGE = {
  type: 'flex',
  altText: '月読み占い｜鑑定タイプを選んでください',
  contents: {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [{
        type: 'text',
        text: '🔮 月読み占い',
        weight: 'bold',
        size: 'xl',
        color: '#ffffff',
      }],
      backgroundColor: '#6B3FA0',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        { type: 'text', text: '鑑定タイプを選んでください', wrap: true },
        { type: 'text', text: '恋愛・仕事・財運：各1,000円（税込）', size: 'sm', color: '#888888' },
        { type: 'text', text: '今年の運勢：1,500円（税込）', size: 'sm', color: '#888888' },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        { type: 'button', style: 'primary', color: '#6B3FA0', action: { type: 'message', label: '💕 恋愛',      text: '鑑定:恋愛' }},
        { type: 'button', style: 'primary', color: '#6B3FA0', action: { type: 'message', label: '💼 仕事',      text: '鑑定:仕事' }},
        { type: 'button', style: 'primary', color: '#6B3FA0', action: { type: 'message', label: '💰 財運',      text: '鑑定:財運' }},
        { type: 'button', style: 'primary', color: '#6B3FA0', action: { type: 'message', label: '🌟 本質と対人', text: '鑑定:本質と対人' }},
      ],
    },
  },
};

// ─── メッセージ処理 ──────────────────────────────────────────
async function handleMessage(event) {
  const { replyToken } = event;
  const lineUserId     = event.source.userId;
  const text           = event.message.text.trim();

  console.log(`受信: "${text}"`);

  // ── ヘルプ ────────────────────────────────────────────────
  if (HELP_KEYWORDS.includes(text.toLowerCase())) {
    return reply(replyToken, getWelcomeMessage());
  }

  // ── リッチメニュー: 無料鑑定 ──────────────────────────────
  if (MENU_FREE_KEYWORDS.includes(text)) {
    return reply(replyToken, getWelcomeMessage());
  }

  // ── リッチメニュー / キーワード: 有料鑑定案内（Flex） ─────
  if (MENU_PAID_KEYWORDS.includes(text) || PAID_KEYWORDS.includes(text)) {
    console.log('有料鑑定 Flex メッセージを返送');
    return reply(replyToken, PAID_FLEX_MESSAGE);
  }

  // ── リッチメニュー: 月読み診断とは ───────────────────────
  if (MENU_ABOUT_KEYWORDS.includes(text)) {
    return reply(replyToken, formatAboutMessage());
  }

  // ── リッチメニュー: 使い方 ────────────────────────────────
  if (MENU_HOWTO_KEYWORDS.includes(text)) {
    return reply(replyToken, formatHowtoMessage());
  }

  // ── 支払い案内（テキスト版フォールバック） ────────────────
  if (PAYMENT_KEYWORDS.includes(text)) {
    return reply(replyToken, formatPaymentMessage());
  }

  // ── 鑑定タイプ選択（Flex ボタン押下） ────────────────────
  if (FORTUNE_TYPE_MAP[text]) {
    const fortuneType = FORTUNE_TYPE_MAP[text];
    const label       = LABEL_MAP[fortuneType];
    const saved       = userFortuneMap.get(lineUserId);

    if (!saved) {
      return reply(replyToken, formatErrorMessage(
        '先にお名前と生年月日で無料鑑定を受けてからお選びください。\n例：田中花子 1990-05-15',
      ));
    }

    console.log(`決済URL生成: ${label} / ${saved.name} / ${saved.date}`);
    try {
      const url = await createCheckoutSession(
        lineUserId, fortuneType, saved.name, saved.date,
      );
      return reply(replyToken, {
        type: 'text',
        text: `💳 ${label}鑑定のお支払いページです。\n決済完了後、自動で鑑定結果をお送りします。\n▶ ${url}`,
      });
    } catch (err) {
      console.error('Stripe セッション作成エラー:', err.message);
      return reply(replyToken, formatErrorMessage('決済ページの生成に失敗しました。しばらくしてからお試しください。'));
    }
  }

  // ── 占いリクエスト（氏名 + 生年月日） ─────────────────────
  const parsed = parseUserInput(text);

  if (!parsed.isValid) {
    if (parsed.command === 'start') return reply(replyToken, getWelcomeMessage());
    return reply(replyToken, formatErrorMessage(parsed.error));
  }

  const { name, date } = parsed;
  console.log(`鑑定対象: ${name} / ${date}`);

  // 次の有料鑑定のために記憶
  userFortuneMap.set(lineUserId, { name, date });

  // キャッシュ確認
  const cached = await getFromCache(name, date);
  if (cached) {
    console.log('⚡ キャッシュから返却');
    return reply(replyToken, formatFortuneResult(cached));
  }

  // Claude API で鑑定生成
  console.log('📡 Claude API で鑑定生成中...');
  const fortune = await generateCompleteFortune(name, date);

  if (fortune.error) {
    return reply(replyToken, formatErrorMessage(fortune.error));
  }

  await saveToCache(fortune);
  console.log('✅ キャッシュ保存完了');

  return reply(replyToken, formatFortuneResult(fortune));
}

// ─── 有料鑑定生成 & プッシュ送信（Stripe Webhook から呼ばれる）
async function handlePaidFortune(lineUserId, fortuneType, userName, birthDate) {
  console.log(`有料鑑定生成: ${LABEL_MAP[fortuneType]} / ${userName} / ${birthDate}`);

  const result = await generatePaidFortune(userName, birthDate, fortuneType);

  if (result.error) {
    await lineClient.pushMessage({
      to: lineUserId,
      messages: [{ type: 'text', text: `❌ ${result.error}` }],
    });
    return;
  }

  const label = LABEL_MAP[fortuneType] ?? fortuneType;
  await lineClient.pushMessage({
    to: lineUserId,
    messages: [{
      type: 'text',
      text: `🔮 ${label}の鑑定結果\n\n${result.text}`,
    }],
  });

  console.log(`✅ 有料鑑定送信完了: ${lineUserId}`);
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
  console.log(`🔮 月読みの導き 起動 → port:${PORT}`),
);
