/**
 * Supabase クライアント設定
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
// サーバーサイドなので service_role キーを使用（RLS をバイパス）
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_ANON_KEY;

console.log('🔍 Supabase Debug Info:');
console.log('  SUPABASE_URL:', supabaseUrl || '[NOT SET]');
console.log(
  '  SUPABASE_ANON_KEY:',
  supabaseKey ? '[SET - Length: ' + supabaseKey.length + ']' : '[NOT SET]',
);

let supabase = null;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '⚠️ Supabase credentials not found. Database features will be disabled.',
  );
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase initialized successfully');
  } catch (error) {
    console.error('❌ Supabase initialization error:', error.message);
  }
}

module.exports = supabase;
