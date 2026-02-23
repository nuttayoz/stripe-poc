#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import Stripe from "stripe";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });
dotenv.config({
  path: path.resolve(process.cwd(), ".env.local"),
  override: true,
  quiet: true,
});

const PLAN_ENV_KEYS = {
  silver: "STRIPE_SILVER_PRICE_ID",
  platinum: "STRIPE_PLATINUM_PRICE_ID",
};

function usage() {
  console.log("Usage:");
  console.log("  npm run stripe:pay:test -- --plan silver|platinum [--payment-method pm_card_visa]");
  console.log("  npm run stripe:pay:test -- --plan silver --dry-run");
}

function parseArgs(argv) {
  const options = {
    plan: "silver",
    paymentMethod: "pm_card_visa",
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
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

    if (arg === "--payment-method") {
      options.paymentMethod = argv[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (arg.startsWith("--payment-method=")) {
      options.paymentMethod = arg.slice("--payment-method=".length);
      continue;
    }

    console.error(`Unknown argument: ${arg}`);
    usage();
    process.exit(1);
  }

  if (!PLAN_ENV_KEYS[options.plan]) {
    console.error('Invalid --plan. Use "silver" or "platinum".');
    usage();
    process.exit(1);
  }

  if (!options.paymentMethod) {
    console.error("Missing --payment-method value.");
    process.exit(1);
  }

  return options;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return value;
}

function productName(product) {
  if (typeof product === "string") {
    return product;
  }
  return product?.name ?? product?.id ?? "";
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const secretKey = requireEnv("STRIPE_SECRET_KEY");

  if (!secretKey.startsWith("sk_test_")) {
    console.error("This script only supports Stripe test mode keys (sk_test_...).");
    process.exit(1);
  }

  const priceId = requireEnv(PLAN_ENV_KEYS[options.plan]);
  const stripe = new Stripe(secretKey);

  const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
  if (!price.active) {
    console.error(`Price is not active: ${price.id}`);
    process.exit(1);
  }
  if (price.type !== "one_time" || !price.unit_amount) {
    console.error(`Price must be one_time with unit_amount: ${price.id}`);
    process.exit(1);
  }

  const payload = {
    amount: price.unit_amount,
    currency: price.currency,
    payment_method: options.paymentMethod,
    payment_method_types: ["card"],
    confirm: true,
    description: `stripe-poc manual test payment for ${options.plan} plan`,
    metadata: {
      app: "stripe-poc",
      plan: options.plan,
      price_id: price.id,
    },
  };

  if (options.dryRun) {
    console.log("Dry run only. No payment was created.");
    console.table([
      {
        plan: options.plan,
        product: productName(price.product),
        price_id: price.id,
        amount_minor: price.unit_amount,
        currency: price.currency,
        payment_method: options.paymentMethod,
      },
    ]);
    return;
  }

  const intent = await stripe.paymentIntents.create(payload);
  const latestChargeId =
    typeof intent.latest_charge === "string"
      ? intent.latest_charge
      : intent.latest_charge?.id ?? "";

  console.log("Stripe test payment created.");
  console.table([
    {
      payment_intent_id: intent.id,
      status: intent.status,
      amount_minor: intent.amount,
      currency: intent.currency,
      latest_charge_id: latestChargeId,
      payment_method: options.paymentMethod,
      plan: options.plan,
    },
  ]);
  console.log(intent)

  if (intent.status !== "succeeded") {
    console.log(
      `Payment intent status is "${intent.status}". Use a different test payment method if needed.`,
    );
  }
}

main().catch((error) => {
  console.error("Failed to create Stripe test payment.");
  console.error(error?.message ?? error);
  process.exit(1);
});


// example charge result

// {
//   id: 'pi_3T3sxlF6bJOUXc3r1I75kNa3',
//   object: 'payment_intent',
//   amount: 29900,
//   amount_capturable: 0,
//   amount_details: { tip: {} },
//   amount_received: 29900,
//   application: null,
//   application_fee_amount: null,
//   automatic_payment_methods: null,
//   canceled_at: null,
//   cancellation_reason: null,
//   capture_method: 'automatic_async',
//   client_secret: 'pi_3T3sxlF6bJOUXc3r1I75kNa3_secret_MenbWVyxZf4RWhJgbhsBxwYuN',
//   confirmation_method: 'automatic',
//   created: 1771829389,
//   currency: 'usd',
//   customer: null,
//   customer_account: null,
//   description: 'stripe-poc manual test payment for platinum plan',
//   excluded_payment_method_types: null,
//   last_payment_error: null,
//   latest_charge: 'ch_3T3sxlF6bJOUXc3r1gTa9rBn',
//   livemode: false,
//   metadata: {
//     app: 'stripe-poc',
//     plan: 'platinum',
//     price_id: 'price_1T3sI4F6bJOUXc3rvrIUwze6'
//   },
//   next_action: null,
//   on_behalf_of: null,
//   payment_method: 'pm_1T3sxlF6bJOUXc3ro4joAJ89',
//   payment_method_configuration_details: null,
//   payment_method_options: {
//     card: {
//       installments: null,
//       mandate_options: null,
//       network: null,
//       request_three_d_secure: 'automatic'
//     }
//   },
//   payment_method_types: [ 'card' ],
//   processing: null,
//   receipt_email: null,
//   review: null,
//   setup_future_usage: null,
//   shipping: null,
//   source: null,
//   statement_descriptor: null,
//   statement_descriptor_suffix: null,
//   status: 'succeeded',
//   transfer_data: null,
//   transfer_group: null
// }