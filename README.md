# Stripe POC (Next.js + UI Plans)

This project is a Next.js app for testing Stripe plan purchase flows.

## Prerequisites

- Node `25.6.1` (or Node `^25`)
- Stripe account in test mode

## Local Run

```bash
nvm use
npm install
npm run dev
```

## Step 2: Stripe Test Setup

1. Copy env template:

```bash
cp .env.example .env.local
```

2. Put your Stripe test secret key in `.env.local`:

```bash
STRIPE_SECRET_KEY=sk_test_...
```

3. Optional: adjust price amount in minor unit (cents for `usd`):

```bash
STRIPE_CURRENCY=usd
STRIPE_SILVER_AMOUNT=1900
STRIPE_PLATINUM_AMOUNT=29900
```

4. Create/update Stripe test products and prices:

```bash
npm run stripe:setup:test
```

The script creates:

- `Silver` product + price (1000 credits)
- `Platinum` product + price (100000 credits)

It then prints:

- `STRIPE_SILVER_PRICE_ID`
- `STRIPE_PLATINUM_PRICE_ID`

Add those IDs to `.env.local` for the next backend/API step.

## Notes

- Free plan is internal only (no Stripe charge).
- The setup script refuses to run with `sk_live_` keys.
