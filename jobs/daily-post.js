const cron      = require('node-cron');
const { postToX } = require('../services/xpost');

// 毎日21時00分（JST）に実行
// node-cron: 秒 分 時 日 月 曜
const SCHEDULE = '0 21 * * *';

function startDailyPostJob() {
  cron.schedule(
    SCHEDULE,
    async () => {
      console.log('🕘 定時X投稿ジョブ開始');
      try {
        await postToX();
      } catch (err) {
        console.error('定時X投稿ジョブ エラー:', err.message);
      }
    },
    { timezone: 'Asia/Tokyo' },
  );

  console.log('📅 定時X投稿スケジューラー起動 → 毎日21:00 JST');
}

module.exports = { startDailyPostJob };
