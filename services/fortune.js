/**
 * 占いサービス
 * フロー: ローカル計算 → DBから意味を取得 → 鑑定文生成 → 返却
 */
const anthropic = require('../config/claude');
const supabase  = require('../config/supabase');
const { calcAll, calcSureiWithCheck } = require('../utils/fortune');

// ─── 数霊の意味 (DBになければこのフォールバックを使う) ──────────────

const SUREI_FALLBACK = {
   1:'独立と創始の力。強いリーダーシップと開拓精神を持ち、自らの道を切り開く。',
   2:'調和と協力。細やかな感受性と共感力で人と人をつなぐ架け橋となる。',
   3:'表現と創造。明るく社交的で、豊かなコミュニケーション力で周囲を和ませる。',
   4:'安定と基礎。誠実で堅実、長期的な視野で物事を着実に積み上げる。',
   5:'変化と自由。好奇心旺盛で適応力が高く、多彩な経験を通じて成長する。',
   6:'愛と奉仕。責任感が強く、家庭や周囲の人を深く愛し守り続ける。',
   7:'探求と知恵。深い洞察力と直感を持ち、物事の本質を見抜く力がある。',
   8:'力と豊かさ。目標達成への意志が強く、物質的・精神的な豊かさをもたらす。',
   9:'完成と博愛。高い理想と広い包容力で、多くの人に影響を与える存在。',
  10:'革新と刷新。新旧を融合させ、時代の変化を先読みする先見の明を持つ。',
  11:'直感と啓示。強い霊感と精神性を持ち、周囲を照らすインスピレーション源。',
  12:'犠牲と奉献。他者のために尽くすことに生きがいを感じる献身的な魂。',
  13:'変革と再生。古い殻を打ち破り、新しい価値観を切り開く変革者の気質。',
  14:'秩序と規律。高い自己管理能力と責任感で、組織を束ねる力を持つ。',
  15:'慈悲と知恵。温かみある人格と鋭い洞察で、人々から慕われる知者。',
  16:'直感と感受性。豊かな感性と芸術的才能で、独自の美の世界を表現する。',
  17:'勝利と名誉。強い意志と不屈の精神で逆境を乗り越え、名声を勝ち取る。',
  18:'苦難と克服。試練を糧に成長し、苦労の先に大きな実りをつかむ。',
  19:'輝きと完全。太陽のような明るさと生命力で、周囲に活力を与える。',
  20:'感受性と霊性。繊細な心と高い霊感を持ち、目に見えない世界を感知する。',
  21:'王道と支配。高い指導力とカリスマ性で、多くの人を導く王者の資質。',
  22:'建設と実現。壮大なビジョンを現実に落とし込む、稀有な実行力の持ち主。',
  23:'知性と表現。優れた知性と発信力で、多くの人の思考に影響を与える。',
  24:'信頼と誠実。誰からも信頼される誠実さで、長期的な人間関係を築く。',
  25:'挑戦と冒険。未知への恐れを持たず、常に新しい世界へ踏み込む探検家。',
  26:'忍耐と実力。地道な努力と深い忍耐力で、着実に実力を積み上げる。',
  27:'完成と奉仕。自己を磨きながら社会に貢献し、世の中に光をもたらす。',
  28:'逆転と粘り。苦境に立たされても決してあきらめず、最後に逆転を呼ぶ力。',
  29:'深慮と英知。深く思慮し判断する英知で、複雑な問題を解決に導く。',
  30:'芸術と表現。感性豊かな表現力で、人の心に響く作品や言葉を生み出す。',
  31:'先見と指導。物事の先を見通す洞察力と説得力で、集団を正しい方向へ導く。',
  32:'縁と協調。人と人を結ぶ不思議な縁を持ち、協力関係から大きな力を生む。',
  33:'慈愛と奉仕。深い慈悲心と忍耐力で、人々に寄り添い続ける聖母の如き心。',
  34:'苦難と成長。多くの苦難を経験しながらも、それを糧に大きく成長する魂。',
  35:'独創と革新。誰も思いつかない独自の発想で、新しい価値を世に送り出す。',
  36:'波乱と才能。波乱万丈の人生の中に、人並み外れた才能と魅力が宿る。',
  37:'意志と実行。高い志と強い実行力で、困難な目標を成し遂げる強者。',
  38:'個性と孤高。独自の世界観を持ち、孤高の存在として輝く唯一無二の個性。',
  39:'名声と成功。才能と努力が結実し、広く名声を得て社会的な成功を収める。',
  40:'無常と転換。変化を恐れず受け入れ、転換の中に新しい可能性を見出す。',
  41:'独立と剛健。強靭な精神と肉体で自立し、誰にも頼らず大きな仕事を成す。',
  42:'苦境と再起。深い苦境に陥っても、必ず再起する不死鳥のような生命力。',
  43:'才気と浮沈。鋭い才気と感受性を持つが、それゆえに浮き沈みの激しい人生。',
  44:'堅固と執念。岩のような堅固な意志と執念で、長年の夢を必ず実現させる。',
  45:'智慧と悟り。深い智慧と悟りを持ち、人生の真理を体得した賢者の気質。',
  46:'努力と上昇。たゆまぬ努力と向上心で、低いところから高みへ駆け上がる。',
  47:'信念と貫徹。一度決めた信念を最後まで貫く、強固な精神力の持ち主。',
  48:'蓄積と繁栄。コツコツと積み上げた実力と財が、やがて大きな繁栄をもたらす。',
  49:'完結と転生。一つの周期が完結し、新しい段階への転生を迎える節目の数。',
  50:'中庸と円満。偏らず円満な人格で、あらゆる人と調和して生きる器量を持つ。',
  51:'開拓と意志。強靭な意志で未開の道を切り開き、後世に道標を残す先駆者。',
  52:'思慮と深遠。思慮深い判断と深遠な知恵で、長期的な繁栄を手中にする。',
  53:'変動と適応。激しい変動の中でも柔軟に適応し、したたかに生き抜く力。',
  54:'苦労と人徳。苦労を重ねながらも人徳を積み、多くの人に慕われる存在になる。',
  55:'剛強と孤独。強靭な精神力で物事を成し遂げるが、孤独を感じやすい気質も。',
  56:'不安定と個性。不安定さの中に強烈な個性と魅力が宿る、波乱の人生。',
  57:'研鑽と実力。たゆまぬ研鑽と努力で確かな実力を身につけ、頭角を現す。',
  58:'逆境と勝利。逆境にこそ燃え上がる闘志があり、最終的に勝利を手にする。',
  59:'智謀と先略。鋭い智謀と先を読む力で、複雑な局面を有利に転じる策士。',
  60:'大成と晩成。若いうちは苦労が多いが、後半生に大きく花開く大器晩成型。',
  61:'権威と指導。自然と人を引き付ける権威と指導力を持ち、大きな組織を率いる。',
  62:'苦難と信念。苦難の連続の中でも信念を手放さず、やがて栄光へたどり着く。',
  63:'完成と豊穣。多くの努力が実を結び、豊かな実りに満ちた円熟の境地。',
  64:'変化と創造。絶え間ない変化と創造のサイクルの中で、新たな価値を生み続ける。',
  65:'積徳と開運。日々の徳積みが運命を好転させ、晩年に向けて運が開かれていく。',
  66:'愛情と執着。深い愛情と強い執着が人生を彩るが、手放す覚悟も時に必要。',
  67:'専門と達人。一つのことを極め続け、誰もが認める達人の領域に踏み込む。',
  68:'組織と調整。組織の中で人と人を結びつけ、全体のバランスを整える調整役。',
  69:'苦境と転化。苦境を体験することで魂が磨かれ、より高い次元へと転化する。',
  70:'純粋と無垢。世俗にまみれない純粋さと無垢さが、独特の輝きと魅力となる。',
  71:'孤高と自立。孤高を保ちながら自立し、独自の世界を完成させる孤独の力。',
  72:'霊感と神秘。強い霊感と神秘的な直感で、目に見えない世界に精通する。',
  73:'知性と洗練。鋭い知性と洗練された感覚で、文化・学術分野で光を放つ。',
  74:'誠実と不屈。誠実な人柄と不屈の精神で、どんな試練も乗り越えていく。',
  75:'奥深さと探求。物事の奥深さを探求し続け、人生をかけて真理を追い求める。',
  76:'晩成と堅実。若い頃から地道に積み上げ、年齢を重ねるほど輝きを増す。',
  77:'霊的な使命。高い霊性と精神性を持ち、この世に果たすべき特別な使命がある。',
  78:'流動と包容。水のように流れ、すべてを包み込む大きな包容力の持ち主。',
  79:'強運と覇気。強烈な覇気と幸運に恵まれ、人生の大舞台で頭角を現す。',
  80:'安定と完成。長年の努力が安定した基盤を生み、人生の完成形に近づいていく。',
  81:'最高位と循環。81は最大数であり1に還る。天と地の循環を体現する吉祥数。',
};

// ─── DB から数霊の意味を取得 ────────────────────────────────────

async function getSureiMeaning(number) {
  if (!supabase) return SUREI_FALLBACK[number] ?? '';
  try {
    const { data } = await supabase
      .from('surei_meanings')
      .select('meaning')
      .eq('number', number)
      .single();
    return data?.meaning ?? SUREI_FALLBACK[number] ?? '';
  } catch {
    return SUREI_FALLBACK[number] ?? '';
  }
}

// ─── メイン: 占い生成 ─────────────────────────────────────────

async function generateCompleteFortune(name, date, manualSureiNumber = null) {
  try {
    // 未対応文字チェック（手動数霊が指定されている場合はスキップ）
    if (manualSureiNumber === null) {
      const { unknownChars } = calcSureiWithCheck(name);
      if (unknownChars.length > 0) {
        return { needsManualStrokes: true, unknownChars, name, date };
      }
    }

    // 1. ローカル計算
    const calc = calcAll(name, date);

    // 手動数霊が指定されている場合は上書き
    if (manualSureiNumber !== null) {
      calc.sureiNumber = manualSureiNumber;
    }
    const { yearPillar, monthPillar, dayPillar, tsuhen, junishi, element, sureiNumber, age } = calc;

    // 2. 数霊の意味をDBから取得
    const sureiMeaning = await getSureiMeaning(sureiNumber);

    // 3. 構造化データを構築
    const structuredData = `
【鑑定対象】${name}（${date}生まれ・${age}歳）

【四柱推命】
・年柱: ${yearPillar.display}（通変星: ${tsuhen.year}／十二運星: ${junishi.year}）
・月柱: ${monthPillar.display}（通変星: ${tsuhen.month}／十二運星: ${junishi.month}）
・日柱（日主）: ${dayPillar.display}（十二運星: ${junishi.day}）
・主五行: ${element}

【数霊】
・数霊数: ${sureiNumber}
・意味: ${sureiMeaning}
`.trim();

    // 4. 構造化データを渡して無料版鑑定文を生成
    if (!anthropic) {
      return buildResult(name, date, age, calc, sureiNumber, sureiMeaning, fallbackText(name, calc, sureiNumber), '');
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: `あなたは月の光のように優しく人に寄り添う占い師です。
訪れる人は皆、何かに悩み、迷い、それでも前へ進もうとしている方々です。
その方の心に、暗闇を優しく照らす月明かりのような言葉を届けてください。
答えを押しつけるのではなく、その人自身の中にある光に気づかせるような
温かく柔らかい鑑定文を書いてください。
権威的・断定的な表現は避け、寄り添い、包み込むようなトーンで書いてください。

以下の形式で出力してください。
他の文字・記号・説明は一切不要です。

THEME:（この人の人生のテーマを10文字以内で言い切る）
FORTUNE:（以下の構成で鑑定文を書く）

【FORTUNEの構成】
①冒頭の共感ワード（2〜3行）
「あなたはこんな経験がありませんか？」という書き出しで始め、
その人の五行・数霊から読み取れる内面的な悩みや葛藤を
具体的に描写してください。

②基本性格・本質（4〜5行）
その人の核となる性格・本質を
月明かりのように柔らかく照らす言葉で描写してください。
強み・才能も自然な流れの中で触れてください。

③今のあなたへのメッセージ（3〜4行）
今この時期に必要な、背中をそっと押す言葉を届けてください。
月明かりが暗闇をそっと照らすような、
温かく柔らかい締めくくりにしてください。
未来予測・年運・恋愛運・仕事運には一切触れないでください。

【ルール】
・FORTUNE部分は400〜500文字
・です・ます調
・記号（# * - [] ）、見出し、箇条書きは使わない
・ひと続きの読み物として書く
・月の光のように優しく、柔らかく、寄り添うトーンで`,
      messages: [{ role: 'user', content: structuredData }],
    });

    const rawText = message.content[0]?.text ?? '';

    // THEME と FORTUNE を分離
    const themeMatch   = rawText.match(/THEME[:：]\s*(.+)/);
    const fortuneMatch = rawText.match(/FORTUNE[:：]\s*([\s\S]+)/);

    const theme       = themeMatch   ? themeMatch[1].trim()   : '';
    const fortuneText = fortuneMatch
      ? fortuneMatch[1].trim()
      : fallbackText(name, calc, sureiNumber);

    return buildResult(name, date, age, calc, sureiNumber, sureiMeaning, fortuneText, theme);
  } catch (error) {
    console.error('Fortune generation error:', error);
    return { error: '占いの生成に失敗しました。しばらくしてからお試しください。' };
  }
}

function buildResult(name, date, age, calc, sureiNumber, sureiMeaning, fortuneText, theme = '') {
  const { yearPillar, monthPillar, dayPillar, tsuhen, junishi, element } = calc;
  return {
    name,
    date,
    age,
    fortune: fortuneText,
    theme,
    sureiNumber,
    sureiMeaning,
    metadata: {
      year_stem_branch:  yearPillar.display,
      month_stem_branch: monthPillar.display,
      day_stem_branch:   dayPillar.display,
      element,
      tsuhen_year:       tsuhen.year,
      tsuhen_month:      tsuhen.month,
      junishi_year:      junishi.year,
      junishi_month:     junishi.month,
      junishi_day:       junishi.day,
      surei_number:      sureiNumber,
    },
  };
}

function fallbackText(name, calc, sureiNumber) {
  const { element, tsuhen, junishi } = calc;
  return `${name}さんは${element}の気質を持ち、日柱の十二運星は「${junishi.day}」。年柱との関係は「${tsuhen.year}」を示します。数霊${sureiNumber}番の力が人生に方向性を与え、今後の歩みを力強く支えるでしょう。`;
}

// ─── 有料版 system プロンプト ─────────────────────────────────────

const PAID_PERSONA = `あなたは月の光のように優しく人に寄り添う占い師です。
訪れる人は皆、何かに悩み、迷い、それでも前へ進もうとしている方々です。
その方の心に、暗闇を優しく照らす月明かりのような言葉を届けてください。
答えを押しつけるのではなく、その人自身の中にある光に気づかせるような
温かく柔らかい鑑定文を書いてください。
権威的・断定的な表現は避け、寄り添い、包み込むようなトーンで書いてください。\n\n`;

const PAID_PROMPTS = {
  renai: PAID_PERSONA + `渡された命式・数霊データをもとに、この人の恋愛傾向・求める愛の形・
パートナーシップのパターン・縁が動きやすい時期について400〜500文字で鑑定してください。
温かく寄り添うトーンで、です・ます調で書いてください。
記号・箇条書き・見出しは使わず、ひと続きの文章で。`,

  shigoto: PAID_PERSONA + `渡された命式・数霊データをもとに、この人の仕事における才能・
向いている分野・転機のサイン・財運の流れについて400〜500文字で鑑定してください。
温かく寄り添うトーンで、です・ます調で書いてください。
記号・箇条書き・見出しは使わず、ひと続きの文章で。`,

  zaiu: PAID_PERSONA + `渡された命式・数霊データをもとに、この人のお金との向き合い方・
財運の特徴・豊かさを引き寄せるための心がけについて400〜500文字で鑑定してください。
温かく寄り添うトーンで、です・ます調で書いてください。
記号・箇条書き・見出しは使わず、ひと続きの文章で。`,

  honshitsu: PAID_PERSONA + `渡された命式・数霊データをもとに、この人の隠れた本質・
深い縁を結びやすい人のタイプ・人間関係での強みと課題について400〜500文字で鑑定してください。
温かく寄り添うトーンで、です・ます調で書いてください。
記号・箇条書き・見出しは使わず、ひと続きの文章で。`,
};

// ─── 有料版鑑定生成 ───────────────────────────────────────────────

async function generatePaidFortune(name, date, fortuneType) {
  try {
    const calc = calcAll(name, date);
    const { yearPillar, monthPillar, dayPillar, tsuhen, junishi, element, sureiNumber, age } = calc;

    const sureiMeaning = await getSureiMeaning(sureiNumber);

    // ── kotoshi: 日付に応じた期間判定 ────────────────────────────
    let systemPrompt;
    let periodLine = '';

    if (fortuneType === 'kotoshi') {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const nextYear = year + 1;

      let period, opening, periodDetail;

      if (month <= 4) {
        period       = `${year}年1月〜12月`;
        opening      = `${year}年のあなたのテーマは`;
        periodDetail = `${year}年全体の運勢を鑑定してください。`;
      } else if (month <= 9) {
        period       = `${year}年${month}月〜${nextYear}年${month}月`;
        opening      = `これからの一年、あなたのテーマは`;
        periodDetail = `${year}年${month}月から${nextYear}年${month}月までの一年間の運勢を鑑定してください。`;
      } else {
        period       = `${nextYear}年1月〜12月`;
        opening      = `来年${nextYear}年に向けて、あなたのテーマは`;
        periodDetail = `来年${nextYear}年全体の運勢を鑑定してください。`;
      }

      periodLine = `\n鑑定期間: ${period}`;

      systemPrompt = `あなたは30年以上の経験を持つ占い師です。
渡された命式・五行・数霊データをもとに、${periodDetail}

【鑑定対象期間】${period}

【必ず含める内容】
・冒頭は必ず「${opening}〜」という書き出しで始める
・対象期間全体の運気の流れとテーマ
・この時期に特に意識すべきこと・チャンスが来る分野
・対人関係・仕事・恋愛のうち最も動きやすい分野を1つ選んで具体的に
・この時期にやっておくべき具体的な行動
・最後に温かい締めくくりのメッセージ

【ルール】
・400〜500文字、です・ます調
・記号・箇条書き・見出し・#・*は使わない
・ひと続きの読み物として書く
・占い師が目の前の人に語りかけるような温かいトーンで
・「${opening}」という書き出しを必ず冒頭に使うこと`;
    } else {
      systemPrompt = PAID_PROMPTS[fortuneType] ?? PAID_PROMPTS.honshitsu;
    }

    const structuredData = `
【鑑定対象】${name}（${date}生まれ・${age}歳）

【四柱推命】
・年柱: ${yearPillar.display}（通変星: ${tsuhen.year}／十二運星: ${junishi.year}）
・月柱: ${monthPillar.display}（通変星: ${tsuhen.month}／十二運星: ${junishi.month}）
・日柱（日主）: ${dayPillar.display}（十二運星: ${junishi.day}）
・主五行: ${element}

【数霊】
・数霊数: ${sureiNumber}
・意味: ${sureiMeaning}${periodLine}
`.trim();

    if (!anthropic) {
      return { text: fallbackText(name, calc, sureiNumber), error: null };
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: structuredData }],
    });

    return { text: message.content[0]?.text ?? fallbackText(name, calc, sureiNumber), error: null };
  } catch (error) {
    console.error('Paid fortune generation error:', error);
    return { text: null, error: '有料鑑定の生成に失敗しました。しばらくしてからお試しください。' };
  }
}

// ─── 人生の設計図（sekkei）生成 ──────────────────────────────────

async function generateSekkei(name, date) {
  try {
    const calc = calcAll(name, date);
    const { yearPillar, monthPillar, dayPillar,
            tsuhen, junishi, element, sureiNumber, age } = calc;
    const sureiMeaning = await getSureiMeaning(sureiNumber);

    const structuredData = `
【鑑定対象】${name}（${date}生まれ・${age}歳）

【四柱推命】
・年柱: ${yearPillar.display}（通変星: ${tsuhen.year}／十二運星: ${junishi.year}）
・月柱: ${monthPillar.display}（通変星: ${tsuhen.month}／十二運星: ${junishi.month}）
・日柱（日主）: ${dayPillar.display}（十二運星: ${junishi.day}）
・主五行: ${element}

【数霊】
・数霊数: ${sureiNumber}
・意味: ${sureiMeaning}
`.trim();

    // 1. 人生のテーマ生成
    const themeMessage = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      system: `あなたは月の光のように優しく人に寄り添う占い師です。
渡された命式・五行・数霊データをもとに、
この人の人生のテーマを10文字以内で言い切ってください。
テーマのみを出力してください。余分な説明は不要です。`,
      messages: [{ role: 'user', content: structuredData }],
    });
    const theme = themeMessage.content[0]?.text?.trim() ?? '';

    // 2. 恋愛鑑定生成
    const renaiMessage = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: `あなたは月の光のように優しく人に寄り添う占い師です。
訪れる人は皆、何かに悩み、迷い、それでも前へ進もうとしている方々です。
渡された命式・五行・数霊データをもとに、この人の恋愛鑑定を書いてください。
無料鑑定より深く、具体的に、より寄り添った内容にしてください。

【必ず含める内容】
・冒頭に「あなたの恋愛における本質は〜」という切り口で始める
・この人が無意識に求めているパートナー像
・愛情表現のパターンと、相手に誤解されやすい点
・深い縁を結びやすい相手のタイプ
・縁が動きやすい時期・きっかけ
・今のあなたへの恋愛メッセージ

【ルール】
・600〜700文字、です・ます調
・記号・箇条書き・見出し・#・*は使わない
・ひと続きの読み物として書く
・月の光のように優しく包み込むトーンで`,
      messages: [{ role: 'user', content: structuredData }],
    });
    const renaiText = renaiMessage.content[0]?.text?.trim() ?? '';

    // 3. 仕事鑑定生成
    const shigotoMessage = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: `あなたは月の光のように優しく人に寄り添う占い師です。
訪れる人は皆、何かに悩み、迷い、それでも前へ進もうとしている方々です。
渡された命式・五行・数霊データをもとに、この人の仕事鑑定を書いてください。
無料鑑定より深く、具体的に、より寄り添った内容にしてください。

【必ず含める内容】
・冒頭に「あなたが最も力を発揮できる舞台は〜」という切り口で始める
・天職・向いている仕事環境の特徴
・仕事における行動パターンと強み
・チームの中での役割・立ち位置
・転機のサインと、次のステージへのヒント
・今のあなたへの仕事メッセージ

【ルール】
・600〜700文字、です・ます調
・記号・箇条書き・見出し・#・*は使わない
・ひと続きの読み物として書く
・月の光のように優しく包み込むトーンで`,
      messages: [{ role: 'user', content: structuredData }],
    });
    const shigotoText = shigotoMessage.content[0]?.text?.trim() ?? '';

    // 4. 財運鑑定生成
    const zaiuMessage = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: `あなたは月の光のように優しく人に寄り添う占い師です。
訪れる人は皆、何かに悩み、迷い、それでも前へ進もうとしている方々です。
渡された命式・五行・数霊データをもとに、この人の財運鑑定を書いてください。
無料鑑定より深く、具体的に、より寄り添った内容にしてください。

【必ず含める内容】
・冒頭に「あなたとお金の関係を一言で表すなら〜」という切り口で始める
・この人固有のお金の引き寄せ方のパターン
・お金が貯まりやすい時期・逃げやすい時期の傾向
・財運を高めるための具体的な心がけ・行動
・やってはいけないお金の使い方
・今のあなたへの財運メッセージ

【ルール】
・600〜700文字、です・ます調
・記号・箇条書き・見出しは使わない
・ひと続きの読み物として書く
・月の光のように優しく包み込むトーンで`,
      messages: [{ role: 'user', content: structuredData }],
    });
    const zaiuText = zaiuMessage.content[0]?.text?.trim() ?? '';

    // 5. 時の運生成
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const nextYear = year + 1;

    let period, opening, periodDetail;
    if (month <= 4) {
      period       = `${year}年1月〜12月`;
      opening      = `${year}年のあなたのテーマは`;
      periodDetail = `${year}年全体の運勢を鑑定してください。`;
    } else if (month <= 9) {
      period       = `${year}年${month}月〜${nextYear}年${month}月`;
      opening      = `これからの一年、あなたのテーマは`;
      periodDetail = `${year}年${month}月から${nextYear}年${month}月までの一年間の運勢を鑑定してください。`;
    } else {
      period       = `${nextYear}年1月〜12月`;
      opening      = `来年${nextYear}年に向けて、あなたのテーマは`;
      periodDetail = `来年${nextYear}年全体の運勢を鑑定してください。`;
    }

    const kotoshiMessage = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: `あなたは月の光のように優しく人に寄り添う占い師です。
訪れる人は皆、何かに悩み、迷い、それでも前へ進もうとしている方々です。
渡された命式・五行・数霊データをもとに、${periodDetail}
無料鑑定より深く、具体的に、より寄り添った内容にしてください。

【鑑定対象期間】${period}

【必ず含める内容】
・冒頭は必ず「${opening}〜」という書き出しで始める
・対象期間全体の運気の流れとテーマ
・この時期に特に意識すべきこと・チャンスが来る分野
・対人関係・仕事・恋愛のうち最も動きやすい分野を具体的に
・この時期にやっておくべき具体的な行動
・最後に温かい締めくくりのメッセージ

【ルール】
・600〜700文字、です・ます調
・記号・箇条書き・見出しは使わない
・ひと続きの読み物として書く
・月の光のように優しく包み込むトーンで`,
      messages: [{ role: 'user', content: structuredData }],
    });
    const kotoshiText = kotoshiMessage.content[0]?.text?.trim() ?? '';

    // 6. 人生のテーマの物語生成
    const monogatariMessage = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: `あなたは月の光のように優しく人に寄り添う占い師です。
渡された命式・五行・数霊データをもとに、
この人の人生を一つの物語として紡いでください。

【構成】
・冒頭：「${name}さんの人生のテーマは「${theme}」です。」
  という一行で始める
・その後、このテーマがどういう意味を持つか、
  これまでの人生でどう現れてきたか、
  これからどう生きていくかを
  月明かりのように優しく照らす言葉で描く

【ルール】
・600〜700文字、です・ます調
・記号・箇条書き・見出しは使わない
・ひと続きの物語として書く
・月の光のように優しく、温かく、包み込むトーンで
・読んだ人が「これは私の物語だ」と感じる内容に`,
      messages: [{ role: 'user', content: structuredData }],
    });
    const monogatariText = monogatariMessage.content[0]?.text?.trim() ?? '';

    return {
      name,
      date,
      age,
      theme,
      renai:      renaiText,
      shigoto:    shigotoText,
      zaiu:       zaiuText,
      kotoshi:    kotoshiText,
      monogatari: monogatariText,
    };

  } catch (error) {
    console.error('Sekkei generation error:', error);
    return { error: '人生の設計図の生成に失敗しました。しばらくしてからお試しください。' };
  }
}

module.exports = { generateCompleteFortune, generatePaidFortune, generateSekkei };
