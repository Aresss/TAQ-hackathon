# Crypto Wallet AML Risk Profiler (Hackathon MVP)

Fast, explainable MVP for screening wallet behavior using deterministic AML risk rules.

## What is built

- One-page web app (`index.html`) with:
  - Wallet/network input
  - Three demo scenarios (Low / Medium / High)
  - Optional CSV import
  - Explainable risk report with:
    - Risk score (0-100)
    - Tier (Low / Medium / High)
    - Action (Allow / Manual Review / Escalate)
    - Triggered factor breakdown

## Files

- `index.html` - UI shell
- `styles.css` - polished visual styling
- `app.js` - deterministic risk engine + UI logic
- `server.js` - local static/API server with file logging
- `sample-wallet.csv` - upload-ready sample
- `logs/wallet-checks.log` - appended wallet check logs (JSON lines)
- `Crypto_Wallet_AML_Risk_Profiler_Spec.docx.rtf` - source specification

## Run locally

Use the Node server (recommended, enables logging):

```bash
npm start
```

Then open [http://localhost:8080](http://localhost:8080).

## Logging

Every wallet analysis writes one log entry to:

- `logs/wallet-checks.log`

Each log line includes:

- timestamp
- wallet address
- network
- source label (manual/scenario/CSV file)
- score/tier/action
- triggered factors with weights

You can also view logs in browser:

- [http://localhost:8080/api/logs](http://localhost:8080/api/logs)

## CSV format

Provide a CSV with one header row and one data row containing any subset of:

- `wallet_address`
- `network`
- `sanctions_adjacent`
- `mixer_interactions`
- `high_velocity_burst` (true/false)
- `wallet_age_days`
- `flagged_entity_exposure`
- `cross_chain_hops`
- `risky_counterparty_ratio` (0-1)
- `structured_amounts` (true/false)
- `privacy_coin_exposure`

## Deterministic scoring model

Rules are weighted and summed; final score is capped at 100.

Tiers:
- Low: 0-29
- Medium: 30-69
- High: 70-100

## Perplexity prompt pack (build copilot)

Use these to iterate quickly:

1. "Review this deterministic AML scoring rubric and suggest 2-3 improvements that preserve explainability and demo stability."
2. "Write concise enterprise UI microcopy for this AML dashboard: field labels, helper text, warning states, and report disclaimers."
3. "Given this frontend-only MVP, propose a next-step backend architecture for hackathon scope without over-engineering."
4. "Generate 10 realistic wallet behavior scenarios (with field values) that deterministically produce low/medium/high tiers."
5. "Create a 2-minute live demo script for judges: clean wallet -> medium risk -> high risk transition with clear storytelling."

## Notes

- This is intentionally a hackathon MVP and not a full compliance system.
- Prioritizes speed, clarity, and believable outputs over deep chain infrastructure.
