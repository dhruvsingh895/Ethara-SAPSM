# Neon Setup

## 1. Create the project

1. Sign up at [neon.tech](https://neon.tech).
2. Create a new project. Pick the region closest to your Render backend (typically `us-east-1`).
3. Postgres 16 is fine.

## 2. Get the connection strings

Neon shows two connection strings:

- **Pooled** (preferred) — `postgres://user:pass@ep-xxx-pooler.<region>.neon.tech/dbname?sslmode=require`
- **Direct** — same host without `-pooler`.

Use the **pooled** string as `DATABASE_URL` in the backend. Render free tier has strict per-instance connection limits, and the Neon pooler multiplexes connections cleanly.

For SQLAlchemy async, replace the scheme:

```
postgresql+asyncpg://user:pass@ep-xxx-pooler.<region>.neon.tech/dbname
```

Note: with `asyncpg`, `sslmode=require` is passed via connection args, not the URL. The backend does this automatically.

## 3. Create the read-only role for the AI assistant

Open Neon's SQL Editor and run:

```sql
-- 1. Create role with random password.
CREATE ROLE ai_reader WITH LOGIN PASSWORD 'REPLACE_WITH_STRONG_PASSWORD';

-- 2. Grant read on the public schema.
GRANT USAGE ON SCHEMA public TO ai_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ai_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ai_reader;

-- 3. Revoke access to sensitive tables.
REVOKE ALL ON TABLE users FROM ai_reader;
REVOKE ALL ON TABLE audit_log FROM ai_reader;
REVOKE ALL ON TABLE ai_query_log FROM ai_reader;
```

Then set `AI_READER_DATABASE_URL` in the backend `.env` using this role.

## 4. Verify

From a psql client:

```bash
psql "postgres://ai_reader:PASS@ep-xxx-pooler.<region>.neon.tech/dbname?sslmode=require" \
  -c "SELECT COUNT(*) FROM employees;"        # should succeed
psql "postgres://ai_reader:PASS@..." \
  -c "SELECT * FROM users LIMIT 1;"           # should fail with permission denied
psql "postgres://ai_reader:PASS@..." \
  -c "INSERT INTO employees(...) VALUES (...);"  # should fail
```
