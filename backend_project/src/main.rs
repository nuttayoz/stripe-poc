mod config;

use std::sync::Arc;

use axum::extract::State;
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use config::AppConfig;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tower_http::cors::{Any, CorsLayer};

#[derive(Clone)]
struct AppState {
    config: AppConfig,
    http: Client,
}

#[derive(Debug)]
enum Plan {
    Silver,
    Platinum,
}

impl Plan {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Silver => "silver",
            Self::Platinum => "platinum",
        }
    }
}

#[derive(Debug, Deserialize)]
struct CheckoutSessionRequest {
    plan: String,
}

#[derive(Debug, Serialize)]
struct CheckoutSessionResponse {
    session_id: String,
    checkout_url: String,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
}

#[derive(Debug, Deserialize)]
struct StripeCheckoutSession {
    id: String,
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct StripeErrorBody {
    error: StripeErrorDetail,
}

#[derive(Debug, Deserialize)]
struct StripeErrorDetail {
    message: Option<String>,
}

type ApiResult<T> = Result<T, (StatusCode, Json<ErrorResponse>)>;

#[tokio::main]
async fn main() {
    let config = match AppConfig::from_env() {
        Ok(config) => config,
        Err(error) => {
            eprintln!("Configuration error: {error}");
            std::process::exit(1);
        }
    };

    let test_mode_key = config.stripe.secret_key.starts_with("sk_test_");
    println!(
        "backend_project ready on port {} (webhook_set={}, test_mode_key={})",
        config.port,
        config.stripe.webhook_secret.is_some(),
        test_mode_key
    );

    let port = config.port;
    let app_state = Arc::new(AppState {
        config,
        http: Client::new(),
    });

    let app = Router::new()
        .route("/health", get(health))
        .route(
            "/api/stripe/checkout-session",
            post(create_checkout_session),
        )
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(app_state);

    let listener = match tokio::net::TcpListener::bind(("0.0.0.0", port)).await {
        Ok(listener) => listener,
        Err(error) => {
            eprintln!("Failed to bind server: {error}");
            std::process::exit(1);
        }
    };

    if let Err(error) = axum::serve(listener, app).await {
        eprintln!("Server error: {error}");
        std::process::exit(1);
    }
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        service: "backend_project",
    })
}

async fn create_checkout_session(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CheckoutSessionRequest>,
) -> ApiResult<Json<CheckoutSessionResponse>> {
    let plan = parse_plan(payload.plan.as_str()).ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Invalid plan. Use \"silver\" or \"platinum\".".to_string(),
            }),
        )
    })?;

    let price_id = match plan {
        Plan::Silver => state.config.stripe.silver_price_id.as_str(),
        Plan::Platinum => state.config.stripe.platinum_price_id.as_str(),
    };

    let form = [
        ("mode", "payment"),
        ("success_url", state.config.checkout.success_url.as_str()),
        ("cancel_url", state.config.checkout.cancel_url.as_str()),
        ("line_items[0][price]", price_id),
        ("line_items[0][quantity]", "1"),
        ("metadata[app]", "stripe-poc"),
        ("metadata[plan]", plan.as_str()),
    ];

    let stripe_response = state
        .http
        .post("https://api.stripe.com/v1/checkout/sessions")
        .basic_auth(state.config.stripe.secret_key.as_str(), Some(""))
        .form(&form)
        .send()
        .await
        .map_err(internal_error)?;

    if !stripe_response.status().is_success() {
        let fallback_error = format!(
            "Stripe checkout session failed with status {}",
            stripe_response.status()
        );
        let body = stripe_response.text().await.map_err(internal_error)?;
        let parsed = serde_json::from_str::<StripeErrorBody>(&body).ok();
        let message = parsed
            .and_then(|item| item.error.message)
            .unwrap_or(fallback_error);
        return Err((
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse { error: message }),
        ));
    }

    let session = stripe_response
        .json::<StripeCheckoutSession>()
        .await
        .map_err(internal_error)?;

    let checkout_url = session.url.ok_or_else(|| {
        (
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse {
                error: "Stripe response missing checkout URL".to_string(),
            }),
        )
    })?;

    Ok(Json(CheckoutSessionResponse {
        session_id: session.id,
        checkout_url,
    }))
}

fn internal_error(error: impl std::fmt::Display) -> (StatusCode, Json<ErrorResponse>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorResponse {
            error: format!("Internal error: {error}"),
        }),
    )
}

fn parse_plan(value: &str) -> Option<Plan> {
    match value.to_lowercase().as_str() {
        "silver" => Some(Plan::Silver),
        "platinum" => Some(Plan::Platinum),
        _ => None,
    }
}
