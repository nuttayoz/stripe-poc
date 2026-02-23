#!/usr/bin/env node

import Stripe from "stripe";
import {
  loadStripeEnv,
  requireEnv,
  upsertEnvFile,
} from "./lib/env-file-utils.js";

function parseArgs(argv) {
  const options = {
    email: `stripe-poc+${Date.now()}@example.com`,
    name: "Stripe POC Test Customer",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--email") {
      options.email = argv[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (arg.startsWith("--email=")) {
      options.email = arg.slice("--email=".length);
      continue;
    }

    if (arg === "--name") {
      options.name = argv[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (arg.startsWith("--name=")) {
      options.name = arg.slice("--name=".length);
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printUsageAndExit(0);
    }

    console.error(`Unknown argument: ${arg}`);
    printUsageAndExit(1);
  }

  if (!options.email) {
    console.error("Missing customer email.");
    process.exit(1);
  }

  return options;
}

function printUsageAndExit(code) {
  console.log("Usage:");
  console.log("  npm run stripe:customer:test");
  console.log("  npm run stripe:customer:test -- --email test@example.com --name \"Test User\"");
  process.exit(code);
}

async function main() {
  loadStripeEnv();
  const options = parseArgs(process.argv.slice(2));

  const secretKey = requireEnv("STRIPE_SECRET_KEY");
  if (!secretKey.startsWith("sk_test_")) {
    console.error("This script only supports Stripe test mode keys (sk_test_...).");
    process.exit(1);
  }

  const stripe = new Stripe(secretKey);
  const customer = await stripe.customers.create({
    email: options.email,
    name: options.name,
    metadata: {
      app: "stripe-poc",
      created_by: "create-stripe-test-customer.js",
    },
  });

  upsertEnvFile(".env.example", {
    STRIPE_TEST_CUSTOMER_ID: customer.id,
  });

  console.log("Stripe test customer created.");
  console.table([
    {
      customer_id: customer.id,
      email: customer.email ?? "",
      name: customer.name ?? "",
    },
  ]);
  console.log("Updated .env.example with STRIPE_TEST_CUSTOMER_ID.");
}

main().catch((error) => {
  console.error("Failed to create Stripe customer.");
  console.error(error?.message ?? error);
  process.exit(1);
});
