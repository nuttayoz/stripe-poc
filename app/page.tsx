import styles from "./page.module.css";

const plans = [
  {
    name: "Free",
    credits: "100",
    price: "$0",
    description: "A lightweight option to test your first Stripe payment flow.",
    cta: "Start Free",
    featured: false,
  },
  {
    name: "Silver",
    credits: "1,000",
    price: "$19",
    description: "Balanced plan for regular usage and faster iteration.",
    cta: "Choose Silver",
    featured: true,
  },
  {
    name: "Platinum",
    credits: "100,000",
    price: "$299",
    description: "High-volume credits for heavy testing and enterprise demos.",
    cta: "Go Platinum",
    featured: false,
  },
] as const;

export default function Home() {
  return (
    <main className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true" />
      <section className={styles.container}>
        <p className={styles.eyebrow}>Stripe UI Mock</p>
        <h1 className={styles.title}>Pick the right credit plan</h1>
        <p className={styles.subtitle}>
          Frontend-only pricing view for quick Stripe payment testing.
        </p>

        <div className={styles.grid}>
          {plans.map((plan, index) => (
            <article
              className={`${styles.card} ${plan.featured ? styles.featured : ""}`}
              style={{ animationDelay: `${index * 140}ms` }}
              key={plan.name}
            >
              {plan.featured ? <span className={styles.badge}>Most Popular</span> : null}
              <h2 className={styles.planName}>{plan.name}</h2>
              <p className={styles.price}>{plan.price}</p>
              <p className={styles.credits}>{plan.credits} credits</p>
              <p className={styles.description}>{plan.description}</p>
              <button type="button" className={styles.button}>
                {plan.cta}
              </button>
            </article>
          ))}
        </div>

        <p className={styles.note}>No backend connected in this demo.</p>
      </section>
    </main>
  );
}
