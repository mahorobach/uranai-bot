/**
 * 占い結果キャッシング - Supabase を使用
 * キャッシュキー: name + date
 * 同じ氏名・生年月日の2人目以降は Claude API を呼ばずに即返却する
 */
const supabase = require('../config/supabase');

async function getFromCache(name, date) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('fortune_cache')
      .select('*')
      .eq('name', name)
      .eq('date', date)
      .single();

    if (error || !data) return null;

    // DB レコードを services/fortune.js の返却形式に変換して返す
    return {
      name:        data.name,
      date:        data.date,
      age:         new Date().getFullYear() - new Date(data.date).getFullYear(),
      fortune:     data.fortune_text,
      sureiNumber: data.surei_number,
      metadata: {
        year_stem_branch:  data.year_stem_branch,
        month_stem_branch: data.month_stem_branch,
        day_stem_branch:   data.day_stem_branch,
        element:           data.element,
        tsuhen_year:       data.tsuhen_year,
        tsuhen_month:      data.tsuhen_month,
        junishi_year:      data.junishi_year,
        junishi_month:     data.junishi_month,
        junishi_day:       data.junishi_day,
        surei_number:      data.surei_number,
      },
    };
  } catch (err) {
    console.error('Cache retrieval error:', err);
    return null;
  }
}

async function saveToCache(fortuneData) {
  if (!supabase) return false;
  try {
    const { name, date, fortune, metadata } = fortuneData;
    const m = metadata ?? {};

    const { error } = await supabase.from('fortune_cache').insert([{
      name,
      date,
      fortune_text:      fortune,
      year_stem_branch:  m.year_stem_branch,
      month_stem_branch: m.month_stem_branch,
      day_stem_branch:   m.day_stem_branch,
      element:           m.element,
      tsuhen_year:       m.tsuhen_year,
      tsuhen_month:      m.tsuhen_month,
      junishi_year:      m.junishi_year,
      junishi_month:     m.junishi_month,
      junishi_day:       m.junishi_day,
      surei_number:      m.surei_number,
      created_at:        new Date().toISOString(),
    }]);

    if (error) {
      // UNIQUE 制約違反は警告のみ（先勝ちで問題なし）
      if (error.code !== '23505') console.error('Cache save error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Cache save error:', err);
    return false;
  }
}

async function getUserFortuneHistory(userId) {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('user_fortunes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) { console.error('History retrieval error:', error); return []; }
    return data ?? [];
  } catch (err) {
    console.error('History retrieval error:', err);
    return [];
  }
}

module.exports = { getFromCache, saveToCache, getUserFortuneHistory };
