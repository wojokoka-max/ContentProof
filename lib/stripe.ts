import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not configured.');

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      typescript: true,
    });
  }

  return stripeClient;
}

export function getStripePrice(period: 'monthly' | 'yearly'): string {
  const price = period === 'monthly'
    ? process.env.STRIPE_PRICE_MONTHLY
    : process.env.STRIPE_PRICE_YEARLY;
  if (!price) throw new Error(`Stripe price for ${period} is not configured.`);
  return price;
}

export function getCreditPackPrice(): string {
  const price = process.env.STRIPE_PRICE_CREDITS_5;
  if (!price) throw new Error('Stripe price for 5 credits is not configured.');
  return price;
}
