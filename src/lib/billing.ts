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
export const STRIPE_LINK_MONTHLY = '';   // e.g. 'https://buy.stripe.com/xxxx'
export const STRIPE_LINK_QUARTERLY = ''; // e.g. 'https://buy.stripe.com/yyyy'

// Optional "Support Kulmi" donations — either a Stripe Payment Link with
// "Customers choose what to pay", OR a Buy Me a Coffee page URL
// (e.g. 'https://buymeacoffee.com/kulmi'). Leave empty to hide the button.
export const DONATE_URL = '';

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
