use std::env;
use std::error::Error;
use std::fmt::{Display, Formatter};

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub port: u16,
    pub stripe: StripeConfig,
}

#[derive(Debug, Clone)]
pub struct StripeConfig {
    pub secret_key: String,
    pub silver_price_id: String,
    pub platinum_price_id: String,
    pub webhook_secret: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ConfigError {
    message: String,
}

impl ConfigError {
    fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl Display for ConfigError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl Error for ConfigError {}

impl AppConfig {
    pub fn from_env() -> Result<Self, ConfigError> {
        // Load optional .env file if it exists.
        dotenvy::dotenv().ok();

        let port = optional_env("PORT")
            .as_deref()
            .map(parse_port)
            .transpose()?
            .unwrap_or(4000);

        let stripe = StripeConfig {
            secret_key: required_env("STRIPE_SECRET_KEY")?,
            silver_price_id: required_env("STRIPE_SILVER_PRICE_ID")?,
            platinum_price_id: required_env("STRIPE_PLATINUM_PRICE_ID")?,
            webhook_secret: optional_env("STRIPE_WEBHOOK_SECRET"),
        };

        Ok(Self { port, stripe })
    }
}

fn parse_port(raw: &str) -> Result<u16, ConfigError> {
    raw.parse::<u16>()
        .map_err(|_| ConfigError::new(format!("Invalid PORT value: {raw}")))
}

fn required_env(key: &str) -> Result<String, ConfigError> {
    match env::var(key) {
        Ok(value) if !value.trim().is_empty() => Ok(value),
        _ => Err(ConfigError::new(format!("Missing required env var: {key}"))),
    }
}

fn optional_env(key: &str) -> Option<String> {
    match env::var(key) {
        Ok(value) if !value.trim().is_empty() => Some(value),
        _ => None,
    }
}
