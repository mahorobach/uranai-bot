/**
 * ユーザー管理 - Supabase を使用
 */
const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

/**
 * LINE ユーザー情報からユーザーを取得または作成
 * @param {string} lineUserId - LINE ユーザーID
 * @returns {Promise<object>} ユーザーオブジェクト
 */
async function getOrCreateUser(lineUserId) {
  try {
    if (!supabase) {
      return { id: uuidv4(), line_user_id: lineUserId };
    }

    // 既存ユーザーを検索
    const { data: existingUser, error: searchError } = await supabase
      .from('users')
      .select('*')
      .eq('line_user_id', lineUserId)
      .single();

    if (!searchError && existingUser) {
      return existingUser;
    }

    // 新規ユーザーを作成
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([
        {
          line_user_id: lineUserId,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (createError) {
      console.error('User creation error:', createError);
      return { id: uuidv4(), line_user_id: lineUserId };
    }

    return newUser;
  } catch (error) {
    console.error('User management error:', error);
    return { id: uuidv4(), line_user_id: lineUserId };
  }
}

/**
 * ユーザー情報を更新
 * @param {string} userId - ユーザーID
 * @param {string} name - 名前
 * @param {string} dateOfBirth - 生年月日
 * @returns {Promise<boolean>} 成功したか
 */
async function updateUserInfo(userId, name, dateOfBirth) {
  try {
    if (!supabase) {
      return false;
    }

    const { error } = await supabase
      .from('users')
      .update({
        name,
        date_of_birth: dateOfBirth,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('User update error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('User update error:', error);
    return false;
  }
}

/**
 * ユーザーの占い履歴を記録
 * @param {string} userId - ユーザーID
 * @param {object} fortuneData - 占い結果データ
 * @param {boolean} isPaid - 有料版か
 * @returns {Promise<object|null>} 記録されたデータ
 */
async function recordUserFortune(userId, fortuneData, isPaid = false) {
  try {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from('user_fortunes')
      .insert([
        {
          user_id: userId,
          name: fortuneData.name,
          date_of_birth: fortuneData.date,
          fortune_text: fortuneData.fortune,
          metadata: fortuneData.metadata,
          is_paid: isPaid,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Fortune record error:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Fortune record error:', error);
    return null;
  }
}

module.exports = {
  getOrCreateUser,
  updateUserInfo,
  recordUserFortune,
};
