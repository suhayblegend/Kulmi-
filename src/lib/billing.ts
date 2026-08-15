// Kulmi+ billing configuration.
// ── YOUR STRIPE TODO ─────────────────────────────────────────────
// 1. In Stripe: create two Payment Links (recurring subscriptions):
//      • Kulmi+ Monthly   — £9.99 / month
//      • Kulmi+ Quarterly — £19.99 / every 3 months
//    Paste their URLs below.
// 2. In Stripe → Developers → Webhooks: add endpoint
//      https://uoiahrlnvkoivdlkhmby.supabase.co/functions/v1/smart-service?stripe=1
//    with events: checkout.session.completed, invoice.paid.
//    Copy its signing secret (whsec_...) into Supabase secrets as
//    STRIPE_WEBHOOK_SECRET, then redeploy smart-service.
// ─────────────────────────────────────────────────────────────────
export const STRIPE_LINK_MONTHLY = 'https://buy.stripe.com/bJe00lbeWcKm1UQaIPco000';
export const STRIPE_LINK_QUARTERLY = 'https://buy.stripe.com/4gMeVf6YGcKmczu9ELco001';

// "Support Kulmi" donations — create this page at buymeacoffee.com (claim the
// "kulmi" handle), or swap in a Stripe Payment Link with "customers choose
// what to pay".
export const DONATE_URL = 'https://buymeacoffee.com/kulmiplae';

export const PRICE_MONTHLY = '£9.99/month';
export const PRICE_QUARTERLY = '£19.99 every 3 months (save 33%)';

export const BILLING_READY = !!(STRIPE_LINK_MONTHLY && STRIPE_LINK_QUARTERLY);

/** Checkout URL carrying the member's id so the webhook knows who paid. */
export function checkoutUrl(link: string, uid: string, email?: string | null): string {
  const url = new URL(link);
  url.searchParams.set('client_reference_id', uid);
  if (email) url.searchParams.set('prefilled_email', email);
  return url.toString();
}

export const FOUNDING_DEADLINE = new Date('2026-09-01T00:00:00Z');
export const FOUNDING_ACTIVE = new Date() < FOUNDING_DEADLINE;
