/**
 * 曜日別X投稿プロンプト定義
 * dayOfWeek: 0=日曜 1=月曜 ... 6=土曜
 */

const LINE_URL = 'https://line.me/R/ti/p/@776zhkvc';

const DAY_THEMES = {
  0: { theme: '来週の運気予報 × 豆知識',      hashtags: '#占い #月読み #運気 #四柱推命' },
  1: { theme: '今週の運気予報 × LINE友だち追加誘導', hashtags: '#占い #月読み #運気 #開運'   },
  2: { theme: '四柱推命・数霊の豆知識（教育系）',    hashtags: '#四柱推命 #数霊 #占い #開運'  },
  3: { theme: '今日の開運メッセージ × LINE友だち追加誘導', hashtags: '#占い #開運 #月読み #運気' },
  4: { theme: '恋愛・仕事・財運の鑑定事例紹介',      hashtags: '#占い #恋愛運 #仕事運 #月読み' },
  5: { theme: '週末の運気 × LINE友だち追加誘導',    hashtags: '#占い #週末 #運気 #月読み'   },
  6: { theme: '有料鑑定（恋愛・仕事・財運）の紹介',   hashtags: '#占い #月読み #恋愛運 #仕事運' },
};

const DAY_NAMES = ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'];

function getPrompt(dayOfWeek) {
  const { theme, hashtags } = DAY_THEMES[dayOfWeek];
  const dayName = DAY_NAMES[dayOfWeek];

  // LINEリンク(23字) + ハッシュタグ(約20字) + 改行2字 = 約45字を本文に使えない
  // 本文は最大95字以内を目標に指示する
  const system = `あなたは月の光のように優しく人に寄り添う占い師です。
X（Twitter）に投稿する短い文章を1つ書いてください。

【今日のテーマ】${dayName}：${theme}

【必須ルール】
・本文は95文字以内（URLとハッシュタグは別途追加するため）
・文末にURLとハッシュタグを付けない（後で自動追加します）
・絵文字は🌙を基調に1〜2個まで
・押しつけがましくなく、詩的で温かい日本語
・悩んでいる人、壁に当たっている人の心にやさしく寄り添う文体
・LINE友だち追加を促す場合は自然な誘導で（「詳しくはLINEで」など）
・本文のみ出力してください。説明や前置きは不要です。`;

  return { system, theme, hashtags, lineUrl: LINE_URL, dayName };
}

module.exports = { getPrompt, DAY_THEMES, DAY_NAMES };
