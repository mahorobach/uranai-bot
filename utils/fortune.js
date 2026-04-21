/**
 * 占い計算エンジン
 * ・四柱推命: 年柱/月柱/日柱 × 十干・十二支・通変星・十二運星
 * ・数霊    : 氏名の画数合計 → 1〜81の数霊数
 */

// ─── 基礎定数 ────────────────────────────────────────────────

const STEMS   = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// 十干の五行 (0=木,1=火,2=土,3=金,4=水)
const STEM_ELEMENT = [0,0,1,1,2,2,3,3,4,4];

// 五行の相生サイクル: 木→火→土→金→水→木
const PRODUCES = [1,2,3,4,0];
// 五行の相剋サイクル: 木→土→水→火→金→木
const CONQUERS = [2,3,4,0,1];

// 十二運星 (長生〜養の12段階)
const JUNISHI = ['長生','沐浴','冠帯','臨官','帝旺','衰','病','死','墓','絶','胎','養'];

// 各日干の「長生」が位置する地支インデックス (陽干=順行, 陰干=逆行)
const CHOSEI_BRANCH = {
  0: 11, // 甲→亥
  1:  6, // 乙→午
  2:  2, // 丙→寅
  3:  9, // 丁→酉
  4:  2, // 戊→寅
  5:  9, // 己→酉
  6:  5, // 庚→巳
  7:  0, // 辛→子
  8:  8, // 壬→申
  9:  3, // 癸→卯
};

// ─── 四柱推命 計算 ───────────────────────────────────────────

/**
 * 年柱 (1984年=甲子 を基準に60干支サイクル)
 */
function calcYearPillar(year) {
  const idx    = (year - 4 + 400) % 60; // +400 は剰余が負にならないよう
  const sIdx   = idx % 10;
  const bIdx   = idx % 12;
  return {
    stemIndex:   sIdx,
    branchIndex: bIdx,
    stem:        STEMS[sIdx],
    branch:      BRANCHES[bIdx],
    display:     STEMS[sIdx] + BRANCHES[bIdx],
  };
}

/**
 * 月柱 (節月近似: 寅月=2月 とする簡略版)
 * month: 1〜12
 */
function calcMonthPillar(year, month) {
  // 地支: 1月→丑(1), 2月→寅(2), ... 11月→亥(11), 12月→子(0)
  const bIdx = month === 12 ? 0 : month % 12;

  // 月干の起点: 年干 % 5 から決定
  const yearStemIdx = (year - 4 + 400) % 10;
  const startStem   = ((yearStemIdx % 5) * 2 + 2) % 10; // 甲/己→丙, 乙/庚→戊, ...
  // 寅月(月インデックス0)から順に割り当て
  const monthOrder  = [2,3,4,5,6,7,8,9,10,11,0,1]; // 月→地支インデックス
  const mIdx        = monthOrder.indexOf(bIdx);
  const sIdx        = (startStem + mIdx) % 10;

  return {
    stemIndex:   sIdx,
    branchIndex: bIdx,
    stem:        STEMS[sIdx],
    branch:      BRANCHES[bIdx],
    display:     STEMS[sIdx] + BRANCHES[bIdx],
  };
}

/**
 * 日柱 (1900-01-01=甲戌 を基準に通日で算出)
 */
function calcDayPillar(year, month, day) {
  const target = new Date(year, month - 1, day);
  const base   = new Date(1900, 0, 1);
  const days   = Math.round((target - base) / 86400000);

  const sIdx = ((days % 10) + 10) % 10;          // 甲=0
  const bIdx = ((days + 10) % 12 + 12) % 12;     // 戌=10 を起点

  return {
    stemIndex:   sIdx,
    branchIndex: bIdx,
    stem:        STEMS[sIdx],
    branch:      BRANCHES[bIdx],
    display:     STEMS[sIdx] + BRANCHES[bIdx],
  };
}

/**
 * 通変星を返す (日干 vs 他の干 の関係)
 */
function getTsuhenStar(dayStemIdx, otherStemIdx) {
  const de  = STEM_ELEMENT[dayStemIdx];
  const oe  = STEM_ELEMENT[otherStemIdx];
  const sameYinYang = (dayStemIdx % 2) === (otherStemIdx % 2);

  if (de === oe)                  return sameYinYang ? '比肩' : '劫財';
  if (PRODUCES[de] === oe)        return sameYinYang ? '食神' : '傷官';
  if (CONQUERS[de] === oe)        return sameYinYang ? '偏財' : '正財';
  if (PRODUCES[oe] === de)        return sameYinYang ? '偏印' : '正印';
  if (CONQUERS[oe] === de)        return sameYinYang ? '偏官' : '正官';
  return '';
}

/**
 * 十二運星を返す (日干 と 地支 の組み合わせ)
 */
function getJunishiStar(dayStemIdx, branchIdx) {
  const chosei  = CHOSEI_BRANCH[dayStemIdx];
  const isYang  = dayStemIdx % 2 === 0;
  const diff    = isYang
    ? (branchIdx - chosei + 12) % 12
    : (chosei - branchIdx + 12) % 12;
  return JUNISHI[diff];
}

/**
 * 五行属性を文字列で返す
 */
function getElement(stemIndex) {
  const NAMES = ['木','火','土','金','水'];
  return NAMES[STEM_ELEMENT[stemIndex]];
}

// ─── 画数テーブル ─────────────────────────────────────────────

// 人名でよく使われる漢字の画数。未登録文字はUTF-16コードポイントから暫定値を使う
const STROKES = {
  // 1画
  '一':1,
  // 2画
  '二':2,'人':2,'八':2,'力':2,'十':2,'丁':2,'刀':2,'又':2,
  // 3画
  '三':3,'山':3,'川':3,'上':3,'下':3,'子':3,'小':3,'大':3,'丸':3,'久':3,'口':3,'土':3,'千':3,
  // 4画
  '中':4,'文':4,'心':4,'水':4,'木':4,'火':4,'日':4,'月':4,'手':4,'天':4,'不':4,'元':4,'公':4,'友':4,'太':4,'仁':4,'内':4,'六':4,'少':4,'今':4,'方':4,'比':4,'互':4,
  // 5画
  '田':5,'生':5,'正':5,'四':5,'本':5,'代':5,'世':5,'白':5,'平':5,'由':5,'史':5,'弘':5,'央':5,'玄':5,'民':5,'永':5,'玉':5,'北':5,'石':5,'矢':5,'令':5,'外':5,'出':5,'加':5,'功':5,'古':5,'右':5,'左':5,'巧':5,'且':5,
  // 6画
  '光':6,'名':6,'多':6,'有':6,'行':6,'合':6,'竹':6,'地':6,'池':6,'西':6,'朱':6,'羊':6,'江':6,'安':6,'成':6,'好':6,'如':6,'妃':6,'百':6,'任':6,'伊':6,'会':6,'全':6,'共':6,'向':6,'年':6,'早':6,'旨':6,'次':6,'自':6,'舟':6,
  // 7画
  '花':7,'村':7,'男':7,'谷':7,'里':7,'杉':7,'克':7,'声':7,'妙':7,'廷':7,'快':7,'佐':7,'低':7,'寿':7,'伸':7,'初':7,'希':7,'芳':7,'亨':7,'岡':7,'岩':7,'形':7,'見':7,'言':7,'住':7,'助':7,'体':7,'弟':7,'束':7,'走':7,'足':7,'判':7,
  // 8画
  '林':8,'明':8,'京':8,'和':8,'東':8,'長':8,'知':8,'武':8,'幸':8,'典':8,'昌':8,'治':8,'直':8,'忠':8,'英':8,'佳':8,'果':8,'依':8,'奈':8,'並':8,'享':8,'昇':8,'周':8,'咲':8,'実':8,'歩':8,'岸':8,'金':8,'松':8,'阿':8,'岡':8,'青':8,'学':8,'官':8,'空':8,'協':8,'固':8,'建':8,'具':8,'国':8,'承':8,'宙':8,'命':8,
  // 9画
  '南':9,'春':9,'秋':9,'星':9,'信':9,'保':9,'俊':9,'則':9,'政':9,'洋':9,'美':9,'紀':9,'彦':9,'哉':9,'泉':9,'宣':9,'昭':9,'柔':9,'柳':9,'津':9,'相':9,'省':9,'祐':9,'拓':9,'将':9,'栄':9,'城':9,'施':9,'奏':9,'映':9,'海':9,'研':9,'建':9,
  // 10画
  '海':10,'桜':10,'高':10,'真':10,'健':10,'浩':10,'桂':10,'桃':10,'泰':10,'純':10,'素':10,'紘':10,'倫':10,'修':10,'哲':10,'航':10,'悟':10,'時':10,'晃':10,'朔':10,'桐':10,'員':10,'原':10,'粋':10,'剛':10,'豪':10,'徒':10,'流':10,'留':10,'烈':10,'格':10,'家':10,'夏':10,'恵':10,
  // 11画
  '野':11,'晴':11,'清':11,'梅':11,'望':11,'理':11,'常':11,'康':11,'崇':11,'彩':11,'菜':11,'菊':11,'敏':11,'梓':11,'淳':11,'渉':11,'雪':11,'麻':11,'勝':11,'啓':11,'偲':11,'猛':11,'彬':11,'旋':11,'堅':11,'将':11,'捷':11,'悠':11,'笑':11,
  // 12画
  '森':12,'晶':12,'湖':12,'創':12,'智':12,'雄':12,'琴':12,'結':12,'朝':12,'渚':12,'博':12,'喜':12,'敦':12,'貴':12,'隆':12,'詠':12,'絡':12,'幾':12,'晩':12,'惇':12,'朗':12,'竣':12,'紫':12,'善':12,'尊':12,'順':12,'貂':12,
  // 13画
  '裕':13,'稔':13,'絵':13,'路':13,'義':13,'瑞':13,'鈴':13,'暖':13,'照':13,'嵐':13,'禅':13,'督':13,'嗣':13,'源':13,'節':13,'遥':13,'蒼':13,'新':13,'電':13,'煌':13,'楓':13,'想':13,'瑛':13,'瑳':13,'聖':13,'総':13,'慈':13,
  // 14画
  '誠':14,'碧':14,'睦':14,'聡':14,'翠':14,'綾':14,'福':14,'維':14,'慎':14,'蓮':14,'魁':14,'漣':14,'銀':14,'嘉':14,'徳':14,'境':14,'静':14,'緒':14,'寧':14,'徹':14,
  // 15画
  '憲':15,'潤':15,'輝':15,'澄':15,'穂':15,'駿':15,'慶':15,'範':15,'広':15,'緑':15,'確':15,'震':15,'稿':15,'論':15,
  // 16画
  '薫':16,'頼':16,'凛':16,'澪':16,'橋':16,'燈':16,'親':16,'学':16,'樹':16,
  // 17画
  '優':17,'謙':17,'繁':17,'環':17,'鍵':17,'嶋':17,'濃':17,
  // 18画
  '織':18,'麗':18,'瞳':18,'藍':18,'藤':18,'曜':18,
  // 19画
  '譲':19,'瀬':19,'識':19,
  // 20画
  '競':20,'響':20,
};

/**
 * 1文字の画数を返す（テーブル未登録時は1を返す）
 */
function getStrokeCount(char) {
  return STROKES[char] ?? 1;
}

/**
 * 氏名の全画数を合計して 1〜81 の数霊数を返す
 */
function calcSurei(name) {
  let total = 0;
  for (const ch of name) {
    total += getStrokeCount(ch);
  }
  // 82以上は81を引いて1〜81に収める（繰り返し）
  while (total > 81) total -= 81;
  return total === 0 ? 81 : total;
}

// ─── メイン: 全データをまとめて返す ────────────────────────────

/**
 * 四柱推命 + 数霊 を計算してすべてのデータを返す
 * @returns {{
 *   yearPillar, monthPillar, dayPillar,
 *   tsuhen: {year, month},
 *   junishi: {year, month, day},
 *   element: string,
 *   sureiNumber: number,
 *   age: number
 * }}
 */
function calcAll(name, dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);

  const yearPillar  = calcYearPillar(year);
  const monthPillar = calcMonthPillar(year, month);
  const dayPillar   = calcDayPillar(year, month, day);

  const dsi = dayPillar.stemIndex;

  return {
    yearPillar,
    monthPillar,
    dayPillar,
    tsuhen: {
      year:  getTsuhenStar(dsi, yearPillar.stemIndex),
      month: getTsuhenStar(dsi, monthPillar.stemIndex),
    },
    junishi: {
      year:  getJunishiStar(dsi, yearPillar.branchIndex),
      month: getJunishiStar(dsi, monthPillar.branchIndex),
      day:   getJunishiStar(dsi, dayPillar.branchIndex),
    },
    element:     getElement(dsi),
    sureiNumber: calcSurei(name),
    age:         new Date().getFullYear() - year,
  };
}

module.exports = {
  calcAll,
  calcYearPillar,
  calcMonthPillar,
  calcDayPillar,
  getTsuhenStar,
  getJunishiStar,
  calcSurei,
  getStrokeCount,
  getElement,
};
