# Backend — Ethara SAPSM

FastAPI service backing the SAPSM app. Async SQLAlchemy against Postgres (Neon in prod), Alembic migrations, JWT auth, and a Gemini-powered NL-to-SQL query endpoint.

## Layout

```
backend/
├── app/
│   ├── main.py              # FastAPI factory + CORS + router mount
│   ├── core/
│   │   └── config.py        # Pydantic settings
│   ├── api/v1/
│   │   ├── router.py        # Aggregate API v1 router
│   │   └── endpoints/
│   │       └── health.py    # Liveness + DB readiness probes
│   ├── db/
│   │   ├── base.py          # Declarative Base + naming convention
│   │   └── session.py       # Async engine + SessionLocal
│   ├── models/              # SQLAlchemy models (Phase 1)
│   ├── schemas/             # Pydantic request/response (Phase 1)
│   └── services/            # Business logic (Phase 3)
├── alembic/                 # Migrations
├── alembic.ini
├── requirements.txt
├── Dockerfile
└── .env.example
```

## Run locally

```bash
python -m venv .venv
.venv\Scripts\activate                 # Windows
# source .venv/bin/activate             # macOS/Linux

pip install -r requirements.txt
cp .env.example .env                    # then fill in DATABASE_URL etc.

alembic upgrade head                    # (no-op until Phase 1 models exist)
uvicorn app.main:app --reload
```

Visit http://localhost:8000/docs for Swagger.

## Endpoints (as of Phase 0)

| Method | Path                       | Purpose                    |
| ------ | -------------------------- | -------------------------- |
| GET    | `/`                        | Service info               |
| GET    | `/api/v1/health`           | Liveness (no DB hit)       |
| GET    | `/api/v1/health/db`        | Readiness (SELECT 1)       |

More endpoints land in Phase 2+.
