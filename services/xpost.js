const { TwitterApi } = require('twitter-api-v2');
const anthropic      = require('../config/claude');
const supabase       = require('../config/supabase');
const { getPrompt }  = require('../prompts/x-post-prompt');

// ─── X APIクライアント初期化 ─────────────────────────────────
function createXClient() {
  const { X_CONSUMER_KEY, X_CONSUMER_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET } = process.env;
  if (!X_CONSUMER_KEY || !X_CONSUMER_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
    console.warn('X API credentials not set. Skipping X post.');
    return null;
  }
  return new TwitterApi({
    appKey:            X_CONSUMER_KEY,
    appSecret:         X_CONSUMER_SECRET,
    accessToken:       X_ACCESS_TOKEN,
    accessSecret:      X_ACCESS_TOKEN_SECRET,
  });
}

// ─── 投稿文をClaudeで生成 ────────────────────────────────────
async function generatePostContent(dayOfWeek) {
  const { system, theme, hashtags, lineUrl, dayName } = getPrompt(dayOfWeek);

  if (!anthropic) {
    const fallback = `🌙 今日も月明かりがあなたを照らしています。\n詳しくはLINEで → ${lineUrl}\n${hashtags}`;
    return { content: fallback, theme, dayName };
  }

  const message = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system,
    messages: [{ role: 'user', content: `今日（${dayName}）の投稿文を書いてください。` }],
  });

  const body    = message.content[0]?.text?.trim() ?? '';
  const content = `${body}\n${lineUrl}\n${hashtags}`;

  return { content, theme, dayName };
}

// ─── Supabaseに投稿履歴を保存 ────────────────────────────────
async function savePostRecord(content, dayOfWeek, theme) {
  if (!supabase) return;
  try {
    await supabase.from('x_posts').insert([{
      content,
      posted_at:   new Date().toISOString(),
      day_of_week: dayOfWeek,
      theme,
    }]);
  } catch (err) {
    console.error('Supabase x_posts保存エラー:', err.message);
  }
}

// ─── メイン: 投稿実行 ────────────────────────────────────────
async function postToX() {
  const now        = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const dayOfWeek  = now.getDay();

  console.log(`📢 X投稿開始 [${['日','月','火','水','木','金','土'][dayOfWeek]}曜日]`);

  let content, theme, dayName;
  try {
    ({ content, theme, dayName } = await generatePostContent(dayOfWeek));
    console.log(`生成した投稿文（${content.length}字）:\n${content}`);
  } catch (err) {
    console.error('投稿文生成エラー:', err.message);
    return;
  }

  const client = createXClient();
  if (!client) return;

  try {
    const { data } = await client.v2.tweet(content);
    console.log(`✅ X投稿成功 tweet_id:${data.id}`);
  } catch (err) {
    console.error('X API投稿エラー:', err.message ?? err);
    return;
  }

  await savePostRecord(content, dayOfWeek, theme);
}

module.exports = { postToX };
