#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import Stripe from "stripe";

const APP_NAME = "stripe-poc";

function loadEnvFileIfExists(filePath, options = {}) {
  const { override = false } = options;
  const absolutePath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    return;
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separator = normalized.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const key = normalized.slice(0, separator).trim();
    if (!key) {
      continue;
    }

    let value = normalized.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return value;
}

function parseAmount(name, fallback) {
  const raw = process.env[name] ?? fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value <= 0) {
    console.error(`Invalid ${name}: "${raw}" (must be a positive integer in minor unit)`);
    process.exit(1);
  }
  return value;
}

async function findProductByMetadata(stripe, planSlug) {
  let hasMore = true;
  let startingAfter;

  while (hasMore) {
    const page = await stripe.products.list({
      active: true,
      limit: 100,
      starting_after: startingAfter,
    });

    const found = page.data.find(
      (product) =>
        product.metadata?.app === APP_NAME && product.metadata?.plan === planSlug,
    );

    if (found) {
      return found;
    }

    hasMore = page.has_more;
    startingAfter = page.data.at(-1)?.id;
  }

  return null;
}

async function ensureProduct(stripe, plan) {
  const existing = await findProductByMetadata(stripe, plan.slug);
  if (existing) {
    return existing;
  }

  return stripe.products.create({
    name: `${plan.name} Plan (${plan.credits} credits)`,
    description: `${plan.credits} credits package for ${APP_NAME}`,
    metadata: {
      app: APP_NAME,
      plan: plan.slug,
      credits: String(plan.credits),
    },
  });
}

function priceProductId(price) {
  return typeof price.product === "string" ? price.product : price.product?.id;
}

async function ensurePrice(stripe, product, plan, currency) {
  const lookupKey = `${APP_NAME}_${plan.slug}_credits`;
  const listed = await stripe.prices.list({
    lookup_keys: [lookupKey],
    limit: 1,
    expand: ["data.product"],
  });

  const existing = listed.data[0];
  if (
    existing &&
    existing.type === "one_time" &&
    existing.currency === currency &&
    existing.unit_amount === plan.amount &&
    priceProductId(existing) === product.id
  ) {
    return existing;
  }

  const created = await stripe.prices.create({
    product: product.id,
    currency,
    unit_amount: plan.amount,
    lookup_key: lookupKey,
    transfer_lookup_key: true,
    nickname: `${plan.name} - ${plan.credits} credits`,
    metadata: {
      app: APP_NAME,
      plan: plan.slug,
      credits: String(plan.credits),
    },
  });

  if (existing?.active) {
    await stripe.prices.update(existing.id, { active: false });
  }

  return created;
}

async function main() {
  loadEnvFileIfExists(".env");
  loadEnvFileIfExists(".env.local", { override: true });

  const secretKey = requireEnv("STRIPE_SECRET_KEY");
  if (secretKey.startsWith("sk_live_")) {
    console.error(
      "Refusing to run with a live secret key. Use STRIPE_SECRET_KEY with sk_test_...",
    );
    process.exit(1);
  }

  const stripe = new Stripe(secretKey);
  const currency = (process.env.STRIPE_CURRENCY ?? "usd").toLowerCase();

  const plans = [
    {
      slug: "silver",
      name: "Silver",
      credits: 1000,
      amount: parseAmount("STRIPE_SILVER_AMOUNT", "1900"),
    },
    {
      slug: "platinum",
      name: "Platinum",
      credits: 100000,
      amount: parseAmount("STRIPE_PLATINUM_AMOUNT", "29900"),
    },
  ];

  console.log("Creating/updating Stripe test-mode products and prices...");
  console.log("Free plan is internal only and does not create a Stripe price.");

  const outputs = [];
  for (const plan of plans) {
    const product = await ensureProduct(stripe, plan);
    const price = await ensurePrice(stripe, product, plan, currency);
    outputs.push({
      plan: plan.name,
      credits: plan.credits,
      currency,
      amount_minor: plan.amount,
      product_id: product.id,
      price_id: price.id,
      lookup_key: price.lookup_key ?? "",
    });
  }

  console.table(outputs);
  console.log("");
  console.log("Add these values to your .env or .env.local:");
  console.log(`STRIPE_SILVER_PRICE_ID=${outputs[0].price_id}`);
  console.log(`STRIPE_PLATINUM_PRICE_ID=${outputs[1].price_id}`);
}

main().catch((error) => {
  console.error("Stripe setup failed.");
  console.error(error?.message ?? error);
  process.exit(1);
});
