const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_MAP = {
  renai:   process.env.STRIPE_PRICE_RENAI,
  shigoto: process.env.STRIPE_PRICE_SHIGOTO,
  zaiu:    process.env.STRIPE_PRICE_ZAIU,
  kotoshi: process.env.STRIPE_PRICE_KOTOSHI,
  sekkei:  process.env.STRIPE_PRICE_SEKKEI,
};

const LABEL_MAP = {
  renai:   '恋愛鑑定',
  shigoto: '仕事鑑定',
  zaiu:    '財運鑑定',
  kotoshi: '時の運',
  sekkei:  '人生の設計図',
};

async function createCheckoutSession(lineUserId, fortuneType, userName, birthDate) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price: PRICE_MAP[fortuneType],
      quantity: 1,
    }],
    mode: 'payment',
    success_url: 'https://line.me/R/ti/p/@776zhkvc',
    cancel_url:  'https://line.me/R/ti/p/@776zhkvc',
    metadata: {
      lineUserId,
      fortuneType,
      userName,
      birthDate,
    },
  });
  return session.url;
}

module.exports = { createCheckoutSession, LABEL_MAP };
