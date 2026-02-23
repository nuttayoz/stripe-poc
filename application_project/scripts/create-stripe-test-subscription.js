#!/usr/bin/env node

import Stripe from "stripe";
import {
  loadStripeEnv,
  requireEnv,
  upsertEnvFile,
} from "./lib/env-file-utils.js";

function parseArgs(argv) {
  const options = {
    plan: "silver",
    customerId: "",
    priceId: "",
    interval: "month",
    paymentToken: "tok_visa",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      printUsageAndExit(0);
    }

    if (arg === "--plan") {
      options.plan = (argv[i + 1] ?? "").toLowerCase();
      i += 1;
      continue;
    }

    if (arg.startsWith("--plan=")) {
      options.plan = arg.slice("--plan=".length).toLowerCase();
      continue;
    }

    if (arg === "--customer-id") {
      options.customerId = argv[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (arg.startsWith("--customer-id=")) {
      options.customerId = arg.slice("--customer-id=".length);
      continue;
    }

    if (arg === "--price-id") {
      options.priceId = argv[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (arg.startsWith("--price-id=")) {
      options.priceId = arg.slice("--price-id=".length);
      continue;
    }

    if (arg === "--interval") {
      options.interval = (argv[i + 1] ?? "").toLowerCase();
      i += 1;
      continue;
    }

    if (arg.startsWith("--interval=")) {
      options.interval = arg.slice("--interval=".length).toLowerCase();
      continue;
    }

    if (arg === "--payment-token") {
      options.paymentToken = argv[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (arg.startsWith("--payment-token=")) {
      options.paymentToken = arg.slice("--payment-token=".length);
      continue;
    }

    console.error(`Unknown argument: ${arg}`);
    printUsageAndExit(1);
  }

  if (!["silver", "platinum"].includes(options.plan)) {
    console.error('Invalid --plan value. Use "silver" or "platinum".');
    process.exit(1);
  }

  if (!["day", "week", "month", "year"].includes(options.interval)) {
    console.error('Invalid --interval value. Use "day", "week", "month", or "year".');
    process.exit(1);
  }

  if (!options.paymentToken) {
    console.error("Missing --payment-token value.");
    process.exit(1);
  }

  return options;
}

function printUsageAndExit(code) {
  console.log("Usage:");
  console.log("  npm run stripe:subscribe:test -- --plan silver");
  console.log(
    "  npm run stripe:subscribe:test -- --plan platinum --interval month --payment-token tok_visa",
  );
  process.exit(code);
}

function priceProductId(price) {
  return typeof price.product === "string" ? price.product : price.product?.id;
}

async function ensureRecurringPrice(stripe, sourcePriceId, plan, interval) {
  const sourcePrice = await stripe.prices.retrieve(sourcePriceId, {
    expand: ["product"],
  });

  if (sourcePrice.type === "recurring" && sourcePrice.recurring?.interval === interval) {
    return { recurringPriceId: sourcePrice.id, sourcePriceId: sourcePrice.id, created: false };
  }

  if (!sourcePrice.unit_amount) {
    throw new Error(`Price ${sourcePrice.id} has no unit_amount and cannot be reused.`);
  }

  const productId = priceProductId(sourcePrice);
  if (!productId) {
    throw new Error(`Price ${sourcePrice.id} has no product.`);
  }

  const lookupKey = `stripe-poc_${plan}_subscription_${interval}`;
  const listed = await stripe.prices.list({
    lookup_keys: [lookupKey],
    limit: 1,
    expand: ["data.product"],
  });

  const existing = listed.data[0];
  if (
    existing &&
    existing.active &&
    existing.type === "recurring" &&
    existing.recurring?.interval === interval &&
    existing.currency === sourcePrice.currency &&
    existing.unit_amount === sourcePrice.unit_amount &&
    priceProductId(existing) === productId
  ) {
    return { recurringPriceId: existing.id, sourcePriceId: sourcePrice.id, created: false };
  }

  const created = await stripe.prices.create({
    product: productId,
    currency: sourcePrice.currency,
    unit_amount: sourcePrice.unit_amount,
    recurring: { interval },
    lookup_key: lookupKey,
    transfer_lookup_key: true,
    nickname: `${plan} subscription ${interval}`,
    metadata: {
      app: "stripe-poc",
      plan,
      source_price_id: sourcePrice.id,
      created_by: "create-stripe-test-subscription.js",
    },
  });

  if (existing?.active) {
    await stripe.prices.update(existing.id, { active: false });
  }

  return { recurringPriceId: created.id, sourcePriceId: sourcePrice.id, created: true };
}

function getPlanPriceEnvKey(plan) {
  return plan === "silver" ? "STRIPE_SILVER_PRICE_ID" : "STRIPE_PLATINUM_PRICE_ID";
}

async function main() {
  loadStripeEnv();
  const options = parseArgs(process.argv.slice(2));

  const secretKey = requireEnv("STRIPE_SECRET_KEY");
  if (!secretKey.startsWith("sk_test_")) {
    console.error("This script only supports Stripe test mode keys (sk_test_...).");
    process.exit(1);
  }

  const customerId =
    options.customerId || process.env.STRIPE_TEST_CUSTOMER_ID || process.env.CUSTOMER_ID || "";
  if (!customerId) {
    console.error(
      "Missing customer id. Run `npm run stripe:customer:test` first or pass --customer-id.",
    );
    process.exit(1);
  }

  const sourcePriceId =
    options.priceId ||
    process.env[getPlanPriceEnvKey(options.plan)] ||
    process.env.STRIPE_TEST_SUBSCRIPTION_PRICE_ID ||
    "";

  if (!sourcePriceId) {
    console.error(
      `Missing source price id. Set ${getPlanPriceEnvKey(options.plan)} or pass --price-id.`,
    );
    process.exit(1);
  }

  const stripe = new Stripe(secretKey);
  await stripe.customers.retrieve(customerId);

  const recurring = await ensureRecurringPrice(
    stripe,
    sourcePriceId,
    options.plan,
    options.interval,
  );

  const paymentMethod = await stripe.paymentMethods.create({
    type: "card",
    card: { token: options.paymentToken },
  });

  await stripe.paymentMethods.attach(paymentMethod.id, { customer: customerId });
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethod.id },
  });

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: recurring.recurringPriceId }],
    default_payment_method: paymentMethod.id,
    expand: ["latest_invoice.payment_intent"],
    metadata: {
      app: "stripe-poc",
      plan: options.plan,
    },
  });

  const subscriptionSnapshot = {
    id: subscription.id,
    status: subscription.status,
    customer: typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id,
    price_id: recurring.recurringPriceId,
    source_price_id: recurring.sourcePriceId,
    current_period_start: subscription.current_period_start,
    current_period_end: subscription.current_period_end,
  };

  upsertEnvFile(".env.example", {
    STRIPE_TEST_CUSTOMER_ID: customerId,
    STRIPE_TEST_SUBSCRIPTION_PRICE_ID: recurring.recurringPriceId,
    STRIPE_TEST_SUBSCRIPTION_ID: subscription.id,
    STRIPE_TEST_SUBSCRIPTION_OBJECT: JSON.stringify(subscriptionSnapshot),
  });

  console.log("Stripe test subscription created.");
  console.table([
    {
      customer_id: customerId,
      plan: options.plan,
      source_price_id: recurring.sourcePriceId,
      recurring_price_id: recurring.recurringPriceId,
      subscription_id: subscription.id,
      status: subscription.status,
      recurring_price_created: recurring.created,
    },
  ]);
  console.log("Updated .env.example with customer/subscription fields.");
}

main().catch((error) => {
  console.error("Failed to create Stripe subscription.");
  console.error(error?.message ?? error);
  process.exit(1);
});
