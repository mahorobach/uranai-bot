require('dotenv').config();
const express  = require('express');
const line     = require('@line/bot-sdk');
const supabase = require('./config/supabase');

const { parseUserInput, isThankYouMessage }        = require('./utils/parser');
const { formatFortuneResult,
        formatPaymentMessage,
        formatAboutMessage,
        formatHowtoMessage,
        formatErrorMessage,
        getWelcomeMessage }                        = require('./utils/formatter');
const { generateCompleteFortune,
        generatePaidFortune,
        generateSekkei }                           = require('./services/fortune');
const { getFromCache, saveToCache }               = require('./services/cache');
const { LABEL_MAP, COCONALA_MENU_TYPES, getCoconalaUrl, hasAnyCoconalaUrl } = require('./services/payment');
const { startDailyPostJob }                       = require('./jobs/daily-post');

// ─── LINE 設定 ──────────────────────────────────────────────
const lineConfig = {
  channelSecret:      process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

// ─── ユーザーの直近占い結果をメモリで記憶（フォールバック用）
const userFortuneMap = new Map();

// ─── 未対応文字があった場合の手動画数待ちユーザー
const pendingUsers = {};

// ─── Express ────────────────────────────────────────────────
const app = express();

app.get('/', (_req, res) => res.json({ status: 'ok', app: '月読みの導き' }));

// Stripe Webhook（任意: ENABLE_STRIPE_WEBHOOK=true のときのみ。主導線はココナラ）
if (process.env.ENABLE_STRIPE_WEBHOOK === 'true'
    && process.env.STRIPE_SECRET_KEY
    && process.env.STRIPE_WEBHOOK_SECRET) {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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
  console.log('💳 Stripe Webhook 有効（ENABLE_STRIPE_WEBHOOK=true）→ /stripe/webhook');
}

// LINE Webhook
app.post(
  '/webhook',
  (req, _res, next) => { console.log('Webhook受信'); next(); },
  line.middleware(lineConfig),
  async (req, res) => {
    res.json({ status: 'ok' });
    for (const event of req.body.events) {
      if (event.type === 'follow') {
        await lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [{
            type: 'text',
            text: [
              '🌕 月読み占いへようこそ',
              '',
              '月の光のように、あなたの心に',
              'そっと寄り添う占いサービスです。',
              '',
              '四柱推命と数霊（かずたま）を組み合わせた',
              'あなただけの鑑定をお届けします。',
              '',
              '─────────────────',
              '✨ 無料鑑定の受け方',
              '─────────────────',
              'お名前と生年月日をスペースで区切って',
              'そのまま送信してください。',
              '',
              '📝 例：',
              '田中花子 1990-05-15',
              '田中花子 1990/05/15',
              '田中花子 19900515',
              '田中花子 1990年5月15日',
              '',
              'さあ、あなただけの星の地図を',
              '紐解いてみましょう🌟',
            ].join('\n'),
          }],
        }).catch((err) => console.error('followイベント送信エラー:', err));
      }
      if (event.type === 'message' && event.message.type === 'text') {
        await handleMessage(event).catch((err) =>
          console.error('handleMessage エラー:', err),
        );
      }
    }
  },
);

// ─── キーワード定義 ──────────────────────────────────────────
const HELP_KEYWORDS       = ['ヘルプ', 'help', '?', 'start'];
const PAID_KEYWORDS       = ['続きを知りたい', '詳しく知りたい', '詳しくを知りたい', '有料版'];
const PAYMENT_KEYWORDS    = ['鑑定希望', '申込', '購入'];
const MENU_FREE_KEYWORDS  = ['無料鑑定'];
const MENU_PAID_KEYWORDS  = ['有料鑑定'];
/** 旧リッチメニュー「恋愛」等がテキスト送信のときココナラ案内へ（※ボタンがURI直指定のStripeの場合はLINE管理画面の修正が必要） */
const MENU_COCONALA_KEYWORDS = ['恋愛', '恋愛鑑定', '恋愛・仕事・本格鑑定'];
const MENU_ABOUT_KEYWORDS = ['月読み診断とは'];
const MENU_HOWTO_KEYWORDS = ['使い方'];

// ─── Supabase から占い履歴を全件取得 ─────────────────────────
async function getAllFortunes(lineUserId) {
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from('fortune_cache')
      .select('name, date')
      .eq('line_user_id', lineUserId)
      .order('created_at', { ascending: false });
    const seen = new Set();
    return (data || []).filter(row => {
      const key = `${row.name}_${row.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return [];
  }
}

// ─── 人物選択 Flex メッセージ ────────────────────────────────
function buildPersonSelectMessage(persons) {
  return {
    type: 'flex',
    altText: '鑑定する方を選んでください',
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
          { type: 'text', text: '👤 鑑定する方を選んでください', wrap: true, weight: 'bold' },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: persons.map(p => ({
          type: 'button',
          style: 'secondary',
          action: {
            type: 'message',
            label: `${p.name}（${p.date}）`,
            text: `鑑定対象:${p.name}:${p.date}`,
          },
        })),
      },
    },
  };
}

// ─── ココナラ誘導 Flex（各ジャンルのサービスURLは環境変数で設定） ───
const COCONALA_FLEX_ROWS = [
  { type: 'renai', emoji: '💕' },
  { type: 'zaiu', emoji: '💰' },
  { type: 'shigoto', emoji: '💼' },
  { type: 'sougou', emoji: '🌙' },
  { type: 'kotoshi', emoji: '📅' },
];

function buildPaymentMessage(name, date) {
  const buttons = COCONALA_FLEX_ROWS.map(({ type, emoji }) => {
    const uri = getCoconalaUrl(type);
    if (!uri) return null;
    const menuLabel = LABEL_MAP[type];
    return {
      type: 'button',
      style: 'primary',
      color: '#6B3FA0',
      action: { type: 'uri', label: `${emoji} ${menuLabel}`, uri },
    };
  }).filter(Boolean);

  if (buttons.length === 0) {
    return null;
  }

  const missingLabels = COCONALA_MENU_TYPES
    .filter((t) => !getCoconalaUrl(t))
    .map((t) => LABEL_MAP[t]);

  const bodyExtra = missingLabels.length
    ? [
        { type: 'separator', margin: 'md' },
        {
          type: 'text',
          text: `※ 準備中: ${missingLabels.join('、')}`,
          size: 'xs',
          color: '#888888',
          wrap: true,
        },
      ]
    : [];

  return {
    type: 'flex',
    altText: `月読み占い｜有料鑑定はココナラ（${name}さん）`,
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
          {
            type: 'text',
            text: `${name}さん（${date}）`,
            wrap: true,
            weight: 'bold',
          },
          {
            type: 'text',
            text: '有料鑑定はココナラからお申し込みいただけます。希望のジャンルのボタンを押してサービスページを開いてください。',
            wrap: true,
            size: 'sm',
            color: '#333333',
          },
          {
            type: 'text',
            text: '料金・納期・内容の詳細は、各ココナラページの説明をご確認ください。',
            wrap: true,
            size: 'xs',
            color: '#555555',
          },
          ...bodyExtra,
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: buttons,
      },
    },
  };
}

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

  // ── 有料鑑定ボタン押下 ────────────────────────────────────
  if (MENU_PAID_KEYWORDS.includes(text) || PAID_KEYWORDS.includes(text)
      || MENU_COCONALA_KEYWORDS.includes(text)) {
    let fortunes = await getAllFortunes(lineUserId);

    // DB に line_user_id が未登録の場合はメモリから補完
    if (fortunes.length === 0) {
      const saved = userFortuneMap.get(lineUserId);
      if (saved) {
        fortunes = [{ name: saved.name, date: saved.date }];
      }
    }

    if (fortunes.length === 0) {
      return reply(replyToken, {
        type: 'text',
        text: '🌙 月読み占いへようこそ\n\nまずはお名前と生年月日をお送りください。\nあなただけの鑑定をお届けします。\n\n📝 例：田中花子 1990-05-15',
      });
    }

    if (fortunes.length === 1) {
      if (!hasAnyCoconalaUrl()) {
        return reply(replyToken, {
          type: 'text',
          text: [
            '🔮 有料鑑定（ココナラ）',
            '',
            'ただいまココナラへのリンク準備中です。',
            'しばらくしてから「有料鑑定」からもう一度お試しください。',
          ].join('\n'),
        });
      }
      const msg = buildPaymentMessage(fortunes[0].name, fortunes[0].date);
      if (!msg) {
        return reply(replyToken, {
          type: 'text',
          text: [
            '🔮 有料鑑定（ココナラ）',
            '',
            'ココナラのURLが未設定のため、ガイドを表示できませんでした。',
            '管理者に環境変数 COCONALA_URL_* の設定をご確認ください。',
          ].join('\n'),
        });
      }
      return reply(replyToken, msg);
    }

    return reply(replyToken, buildPersonSelectMessage(fortunes));
  }

  // ── 人物選択後 ────────────────────────────────────────────
  if (text.startsWith('鑑定対象:')) {
    const parts = text.split(':');
    const name  = parts[1];
    const date  = parts[2];
    if (!hasAnyCoconalaUrl()) {
      return reply(replyToken, {
        type: 'text',
        text: [
          '🔮 有料鑑定（ココナラ）',
          '',
          'ただいまココナラへのリンク準備中です。',
          'しばらくしてからお試しください。',
        ].join('\n'),
      });
    }
    const msg = buildPaymentMessage(name, date);
    if (!msg) {
      return reply(replyToken, {
        type: 'text',
        text: 'ココナラのURLが未設定のため、ガイドを表示できませんでした。',
      });
    }
    return reply(replyToken, msg);
  }

  // ── 手動画数の受け取り（数字のみ送信 + 待ちユーザー） ───────
  if (/^\d+$/.test(text) && pendingUsers[lineUserId]) {
    const manualStrokes = parseInt(text, 10);
    const { name: pendingName, date: pendingDate } = pendingUsers[lineUserId];
    delete pendingUsers[lineUserId];

    let sureiNumber = manualStrokes;
    while (sureiNumber > 81) sureiNumber -= 81;
    if (sureiNumber === 0) sureiNumber = 81;

    const fortune = await generateCompleteFortune(pendingName, pendingDate, sureiNumber);
    if (fortune.error) return reply(replyToken, formatErrorMessage(fortune.error));
    await saveToCache(fortune, lineUserId);
    return reply(replyToken, formatFortuneResult(fortune));
  }

  // ── 感謝・感動メッセージ ──────────────────────────────────
  if (isThankYouMessage(text)) {
    return reply(replyToken, {
      type: 'text',
      text: [
        '🌙 ありがとうございます。',
        '',
        'またいつでもお声がけください。',
        'お名前と生年月日をお送りいただければ',
        '鑑定いたします。',
      ].join('\n'),
    });
  }

  // ── 占いリクエスト（氏名 + 生年月日） ─────────────────────
  const parsed = parseUserInput(text);

  if (!parsed.isValid) {
    if (parsed.command === 'start') return reply(replyToken, getWelcomeMessage());
    return reply(replyToken, formatErrorMessage(parsed.error));
  }

  const { name, date } = parsed;
  console.log(`鑑定対象: ${name} / ${date}`);

  // メモリに記憶（フォールバック用）
  userFortuneMap.set(lineUserId, { name, date });

  // キャッシュ確認
  const cached = await getFromCache(name, date);
  if (cached) {
    console.log('⚡ キャッシュから返却');
    // line_user_id を紐付けて履歴に残す
    if (supabase) {
      await supabase.from('fortune_cache')
        .update({ line_user_id: lineUserId })
        .eq('name', name)
        .eq('date', date);
    }
    return reply(replyToken, formatFortuneResult(cached));
  }

  // 鑑定生成
  console.log('📡 鑑定生成中...');
  const fortune = await generateCompleteFortune(name, date);

  // 未対応文字がある場合は手動画数を要求
  if (fortune.needsManualStrokes) {
    pendingUsers[lineUserId] = { name, date };
    return reply(replyToken, {
      type: 'text',
      text: [
        '🌙 お名前の確認',
        '',
        `「${fortune.unknownChars.join('・')}」の`,
        '画数を正確に読み取れませんでした。',
        '',
        '以下のいずれかでお試しください：',
        '',
        '① 一般的な漢字表記に変えて',
        '　 もう一度お名前と生年月日を送る',
        '　 例：﨑 → 崎',
        '',
        '② お名前の総画数を数字だけで送る',
        '　 例：42',
      ].join('\n'),
    });
  }

  if (fortune.error) {
    return reply(replyToken, formatErrorMessage(fortune.error));
  }

  await saveToCache(fortune, lineUserId);
  console.log('✅ キャッシュ保存完了');

  return reply(replyToken, formatFortuneResult(fortune));
}

// ─── 有料鑑定生成 & プッシュ送信（Stripe レガシー Webhook / 将来の PayJP 等から呼び出し可能）
async function handlePaidFortune(lineUserId, fortuneType, userName, birthDate) {
  console.log(`有料鑑定生成: ${LABEL_MAP[fortuneType]} / ${userName} / ${birthDate}`);

  // ── 人生の設計図 ──────────────────────────────────────────
  if (fortuneType === 'sekkei') {
    const result = await generateSekkei(userName, birthDate);

    if (result.error) {
      await lineClient.pushMessage({
        to: lineUserId,
        messages: [{ type: 'text', text: `❌ ${result.error}` }],
      });
      return;
    }

    await lineClient.pushMessage({
      to: lineUserId,
      messages: [{ type: 'text', text: `🌙 ${result.name}さんの人生の設計図\n\n${result.monogatari}` }],
    });
    await lineClient.pushMessage({
      to: lineUserId,
      messages: [{ type: 'text', text: `💕 恋愛鑑定\n\n${result.renai}` }],
    });
    await lineClient.pushMessage({
      to: lineUserId,
      messages: [{ type: 'text', text: `💼 仕事鑑定\n\n${result.shigoto}` }],
    });
    await lineClient.pushMessage({
      to: lineUserId,
      messages: [{ type: 'text', text: `💰 財運鑑定\n\n${result.zaiu}` }],
    });
    await lineClient.pushMessage({
      to: lineUserId,
      messages: [{ type: 'text', text: `📅 時の運\n\n${result.kotoshi}` }],
    });

    console.log(`✅ 人生の設計図送信完了: ${lineUserId}`);
    return;
  }

  // ── 単品鑑定 ─────────────────────────────────────────────
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
app.listen(PORT, () => {
  console.log(`🔮 月読みの導き 起動 → port:${PORT}`);
  startDailyPostJob();
});
