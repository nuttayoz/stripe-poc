import styles from "./page.module.css";

const plans = [
  {
    name: "Free",
    credit: "100 credit",
    price: "$0",
    description: "Good for trying your first Stripe checkout flow.",
    action: "Choose Free",
    featured: false,
  },
  {
    name: "Silver",
    credit: "1000 credit",
    price: "$19",
    description: "Balanced option for repeat testing and demos.",
    action: "Choose Silver",
    featured: true,
  },
  {
    name: "Platinum",
    credit: "100000 credit",
    price: "$299",
    description: "Large credit volume for heavy usage scenarios.",
    action: "Choose Platinum",
    featured: false,
  },
] as const;

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <p className={styles.kicker}>Stripe UI Only</p>
        <h1 className={styles.title}>Choose your credit plan</h1>
        <p className={styles.subtitle}>
          Clean frontend pricing view for payment flow testing.
        </p>

        <div className={styles.grid}>
          {plans.map((plan, index) => (
            <article
              className={`${styles.card} ${plan.featured ? styles.featured : ""}`}
              key={plan.name}
              style={{ animationDelay: `${index * 110}ms` }}
            >
              {plan.featured ? <span className={styles.badge}>Popular</span> : null}
              <h2 className={styles.name}>{plan.name}</h2>
              <p className={styles.price}>{plan.price}</p>
              <p className={styles.credit}>{plan.credit}</p>
              <p className={styles.description}>{plan.description}</p>
              <button type="button" className={styles.button}>
                {plan.action}
              </button>
            </article>
          ))}
        </div>

        <p className={styles.note}>Frontend only, no backend integration.</p>
      </section>
    </main>
  );
}
