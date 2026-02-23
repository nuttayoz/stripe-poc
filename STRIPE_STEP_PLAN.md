# Stripe Integration Step Plan

This file is the execution plan for adding Stripe payments and credit top-ups to this project.

## Scope

- Plans:
  - Free: `100` credits (no Stripe charge)
  - Silver: `1000` credits (Stripe payment)
  - Platinum: `100000` credits (Stripe payment)
- UI + backend integration for Stripe checkout and credit fulfillment.

## Current Status

- Step 1: Completed
- Step 2: Completed
- Stripe test products/prices created and saved in local env
- Env loading verified from app runtime
- Next step: Step 3 (config module + webhook secret later)

## Workspace Layout

- Frontend: `/Users/Nuttayos.Suv/Desktop/stripe-poc/application_project`
- Backend: `/Users/Nuttayos.Suv/Desktop/stripe-poc/backend_project`
- Root docs/control: `/Users/Nuttayos.Suv/Desktop/stripe-poc`

## Step-by-Step Plan

### 1. Confirm Business Rules

- [x] Confirm Free plan rule: one-time claim per user.
- [x] Confirm Silver and Platinum final prices.
- [x] Confirm currency (default: `usd`).
- [x] Confirm authentication approach (required before fulfillment).

Step 1 confirmed with defaults for this POC:

- Free plan: one-time claim per user (`100` credits).
- Silver plan: `$19.00` (`1000` credits).
- Platinum plan: `$299.00` (`100000` credits).
- Currency: `usd`.
- Auth approach: temporary POC identity via cookie-based `userId` (replace with real auth later).

### 2. Stripe Test Setup

- [x] Install Stripe SDK.
- [x] Add `.env.example` with Stripe keys and optional amount overrides.
- [x] Add test setup script to create/update Silver + Platinum Products/Prices.
- [x] Run setup script with your real `sk_test_...` key and store resulting price IDs.

Current test price IDs (local):

- `STRIPE_SILVER_PRICE_ID=price_1T3sI3F6bJOUXc3rKebQT2Zi`
- `STRIPE_PLATINUM_PRICE_ID=price_1T3sI4F6bJOUXc3rvrIUwze6`

Current setup script path:

- `application_project/scripts/setup-stripe-test.js`

### 3. Environment and Config

- [x] Add local env values (`.env` or `.env.local`):
  - `STRIPE_SECRET_KEY`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_SILVER_PRICE_ID`
  - `STRIPE_PLATINUM_PRICE_ID`
- [x] Verify app runtime can load env values.
- [ ] Add `STRIPE_WEBHOOK_SECRET` (after webhook setup)
- [ ] Add lightweight config module for plan-to-price mapping.

Notes:

- Frontend env file: `application_project/.env.local`
- Backend env file: `backend_project/.env`

### 4. Checkout Session API

- [ ] Create `POST /api/stripe/checkout-session`.
- [ ] Validate requested plan server-side (`silver`, `platinum` only).
- [ ] Create Stripe Checkout Session with success/cancel URLs.
- [ ] Return session URL or session ID for frontend redirect.

### 5. Webhook Fulfillment API

- [ ] Create `POST /api/stripe/webhook`.
- [ ] Verify Stripe signature using `STRIPE_WEBHOOK_SECRET`.
- [ ] Handle successful payment event(s).
- [ ] Add idempotency guard to prevent duplicate credit grants.

### 6. Credits Data Model

- [ ] Add `credits_ledger` persistence (DB or temporary store).
- [ ] Record credits granted from completed Stripe payments.
- [ ] Record Free-plan credit grants.
- [ ] Add simple credit balance read function.

### 7. Free Plan Claim Endpoint

- [ ] Create `POST /api/credits/claim-free`.
- [ ] Enforce rule from Step 1 (typically one-time per user).
- [ ] Write ledger event for 100 credits.

### 8. Frontend Integration

- [ ] Wire Silver/Platinum buttons to checkout-session API.
- [ ] Wire Free button to claim-free API.
- [ ] Add success/cancel state pages.
- [ ] Show current credit balance on pricing page.

### 9. Local Testing

- [ ] Run app with Stripe test keys.
- [ ] Use Stripe test card to complete payment.
- [ ] Verify webhook receives event and credits are added once.
- [ ] Validate all plan flows (Free, Silver, Platinum).

### 10. Hardening

- [ ] Error handling and user-facing messages.
- [ ] Logging around checkout and webhook events.
- [ ] Basic retry-safe/idempotent fulfillment behavior.
- [ ] Deployment env variable checklist.

## Execution Order

1. Finish Step 3 config module
2. Implement Steps 4 -> 8
3. Validate with Step 9
4. Finalize Step 10
