# Stripe POC Monorepo

This repository now contains two projects:

- `/Users/Nuttayos.Suv/Desktop/stripe-poc/application_project` (Next.js frontend)
- `/Users/Nuttayos.Suv/Desktop/stripe-poc/backend_project` (backend server workspace)

Root keeps project-level docs and control files.

## Prerequisites

- Node `25.6.1` (or `^25`)
- Stripe account in test mode

## Run Frontend (`application_project`)

```bash
cd /Users/Nuttayos.Suv/Desktop/stripe-poc/application_project
nvm use
npm install
npm run dev
```

## Run Backend (`backend_project`)

```bash
cd /Users/Nuttayos.Suv/Desktop/stripe-poc/backend_project
cargo run
```

## Stripe Test Setup (Frontend Script)

1. Create env file in `application_project`:

```bash
cd /Users/Nuttayos.Suv/Desktop/stripe-poc/application_project
cp .env.example .env.local
```

2. Set test keys in `.env.local`:

```bash
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

3. Create/update Stripe test products and prices:

```bash
npm run stripe:setup:test
```

The script prints:

- `STRIPE_SILVER_PRICE_ID`
- `STRIPE_PLATINUM_PRICE_ID`

Add those IDs into `application_project/.env.local` and later `backend_project/.env`.

## Manual Test Payment (No Webhook)

Run from frontend workspace:

```bash
cd /Users/Nuttayos.Suv/Desktop/stripe-poc/application_project
```

Dry run (no charge):

```bash
npm run stripe:pay:test -- --plan silver --dry-run
```

Create a real Stripe **test mode** transaction:

```bash
npm run stripe:pay:test -- --plan silver
```

Optional payment method override:

```bash
npm run stripe:pay:test -- --plan platinum --payment-method pm_card_visa
```
