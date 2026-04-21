const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_MAP = {
  renai:     process.env.STRIPE_PRICE_RENAI,
  shigoto:   process.env.STRIPE_PRICE_SHIGOTO,
  zaiu:      process.env.STRIPE_PRICE_ZAIU,
  honshitsu: process.env.STRIPE_PRICE_HONSHITSU,
};

const LABEL_MAP = {
  renai:     '恋愛',
  shigoto:   '仕事',
  zaiu:      '財運',
  honshitsu: '本質と対人',
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
