mod config;

use config::AppConfig;

fn main() {
    match AppConfig::from_env() {
        Ok(config) => {
            let test_mode_key = config.stripe.secret_key.starts_with("sk_test_");
            println!(
                "backend_project core ready on port {} (silver={}, platinum={}, webhook_set={}, test_mode_key={})",
                config.port,
                config.stripe.silver_price_id,
                config.stripe.platinum_price_id,
                config.stripe.webhook_secret.is_some(),
                test_mode_key
            );
        }
        Err(error) => {
            eprintln!("Configuration error: {error}");
            std::process::exit(1);
        }
    }
}
