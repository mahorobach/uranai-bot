/**
 * Claude API クライアント設定
 */
const Anthropic = require('@anthropic-ai/sdk');

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.warn('⚠️ CLAUDE_API_KEY is not set in environment variables');
  console.warn('Claude API features will not work');
}

let anthropic = null;

if (apiKey) {
  try {
    anthropic = new Anthropic({
      apiKey: apiKey,
    });
    console.log('✅ Claude API initialized successfully');
  } catch (error) {
    console.error('❌ Claude API initialization error:', error.message);
  }
}

module.exports = anthropic;
