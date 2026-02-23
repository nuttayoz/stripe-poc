# backend_project (Rust)

Minimal Rust backend core project.

## Structure

- `Cargo.toml`
- `.env.example`
- `src/config.rs`
- `src/main.rs`

## Run (after installing Rust)

```bash
cd /Users/Nuttayos.Suv/Desktop/stripe-poc/backend_project
cp .env.example .env
cargo run
```

## Endpoints

- `GET /health`
- `POST /api/stripe/checkout-session`

### Checkout Request Example

```bash
curl -X POST http://localhost:4000/api/stripe/checkout-session \
  -H "content-type: application/json" \
  -d '{"plan":"silver"}'
```
