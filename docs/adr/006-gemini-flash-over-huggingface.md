# ADR-006: Gemini 2.5 Flash over a self-hosted HuggingFace model

**Date:** 2026-07-08 · **Status:** Accepted

## Context

The AI Assistant needs an LLM to translate natural-language questions into safe Postgres SQL. Two credible zero-cost options were considered mid-way through the assessment:

1. **Managed API — Gemini 2.5 Flash** via Google AI Studio. This is what we currently use.
2. **Self-hosted or public-endpoint HuggingFace model.** For example `defog/sqlcoder-7b`, `Salesforce/codegen-350M-multi`, or a small instruct model behind HuggingFace's public Inference API.

The choice matters because ADR-002 already locks in NL-to-SQL with guardrails as the interface design. This ADR is only about *which* LLM sits behind that design.

## Options

| Dimension | Gemini 2.5 Flash | HuggingFace Inference (free tier) |
| --- | --- | --- |
| **SQL quality on our schema** | Consistently correct — handles CTEs, aggregations, ILIKE, joins, enum casing | Mixed. Small models often emit invalid Postgres (MySQL syntax, wrong `LIMIT` placement, imaginary column names). Would require heavy prompt-engineering and a much larger schema-few-shot example set. |
| **Latency** | 1.5–2.5s per query, measured live | Public HF Inference API: 5–30s warm, minutes on cold-start. A dedicated Inference Endpoint is faster but costs money. |
| **Reliability** | Free-tier 250 requests/day for `gemini-2.5-flash`. Rate-limited but consistent when in-quota. | Public endpoints go 503 unpredictably, models get taken down or gated without notice. Not a good demo surface. |
| **Setup effort** | Working in production. `pip install google-generativeai`, one API key, done. | New HTTP client, prompt-tuning cycle for the target model, retry/timeout handling, redeploy — several hours of work for a lateral outcome. |
| **Cost** | $0 within free tier | $0 on public endpoints (but slow/unreliable). Dedicated endpoints start at ~$0.60/hr. |
| **Evaluator readability** | "We use Gemini with defense-in-depth guards" — one sentence | "We use `<some-model>` via HF Inference" — needs justification for the model choice, quality comparison, and a plan for when the endpoint goes down |

## Decision

**Gemini 2.5 Flash.**

## Consequences

**Accepted:**

- Dependency on Google AI Studio quota. Free tier is 250 requests/day per project. A grading session that hammered the endpoint could exhaust it and start getting 429s. Mitigated by the UI already surfacing 429s as a clean warning banner (verified during the Phase 6 smoke test).
- Vendor lock-in to Gemini's SDK surface. Mitigated because the LLM boundary is a single service module (`backend/app/services/gemini.py`) — swapping to a different provider is a one-file change.
- Data leaves our infrastructure to reach Google. Acceptable for this project — the prompt is the user's natural-language question and the DDL schema. Row data never leaves the DB. ADR-002's Layer 1 (schema hiding) is what actually enforces that boundary.

**Gained:**

- Consistently good SQL quality without prompt-engineering churn. The system prompt in `backend/app/services/gemini.py` is straightforward and produces valid Postgres SELECTs across the full range of questions we've tested.
- Fast enough to feel snappy in the UI (~2s p95).
- Zero infra cost. A HuggingFace dedicated endpoint at even the smallest size would cost more than any hosting we're using for the rest of the stack.
- Simple story to tell reviewers. "Managed LLM with a defense-in-depth SQL guard" is one sentence and doesn't invite quality-comparison follow-ups.

**Rejected explicitly:**

- **Public HuggingFace Inference API.** Slow, unreliable, quality varies per model. A grading session hitting a cold endpoint would time out and look worse than a rate-limit warning.
- **Dedicated HuggingFace Inference Endpoint.** Would work well but costs money, adding operational complexity for no measurable quality win over Gemini Flash.
- **Self-hosted quantized model** (e.g. `sqlcoder-7b` via Ollama on the backend host). Blows through Render's 512 MB RAM limit on the free tier. Would need a much bigger deploy just to serve the LLM, which defeats the $0/mo constraint.

## When we would change our mind

- If Gemini stops offering a free tier suitable for this project, or the daily quota gets cut below what a real user would generate.
- If the assessment or a future production deployment explicitly required prompts and data to stay inside a specific network — then a self-hosted model becomes non-negotiable regardless of quality.
- If a specialized text-to-SQL model (like the SQLCoder line) reaches quality parity with Gemini on our schema. Worth revisiting every 6–12 months.

## Related

- [ADR-002](002-nl-to-sql-with-guardrails-over-tool-use.md) — the interface-level decision to do NL-to-SQL at all. This ADR is downstream of that one.
- [`docs/ai_safety.md`](../ai_safety.md) — the 5-layer defense that makes any of these LLM choices safe.
- [`backend/app/services/gemini.py`](../../backend/app/services/gemini.py) — the LLM boundary, isolated so swapping providers is a one-file change.
