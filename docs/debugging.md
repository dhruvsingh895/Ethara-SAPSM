# Debugging Notes

Chronological log of non-trivial issues encountered during development and their resolutions.

Each entry follows the schema:

```
## <YYYY-MM-DD> — <short title>
**Symptom:** <what was observed>
**Root cause:** <what was actually wrong>
**Fix:** <what changed>
**Prevention:** <how to avoid a recurrence>
```

---

## 2026-07-08 — passlib 1.7.4 crashes on bcrypt 5.x

**Symptom:** `hash_password("demo1234")` raised
`AttributeError: module 'bcrypt' has no attribute '__about__'` followed by
`ValueError: password cannot be longer than 72 bytes`.

**Root cause:** `passlib==1.7.4` probes `bcrypt.__about__.__version__` on
first use. `bcrypt` 4.1+ removed the `__about__` module, so passlib's
version detection fails and it falls back through a broken code path
that trips bcrypt's 72-byte input check.

**Fix:** Pinned `bcrypt==4.0.1` in `backend/requirements.txt`. Reinstall
inside the venv resolves the crash.

**Prevention:** Move to `argon2-cffi` if passlib maintenance stalls
further; short-term the pin is safe because bcrypt hashes we produce now
verify against any future backend.

## 2026-07-08 — EmailStr rejects `.local` TLD

**Symptom:** `POST /auth/login` returned 500. Server log showed
`ValidationError: The part after the @-sign is a special-use or reserved
name that cannot be used with email` for `admin@ethara.local`.

**Root cause:** `pydantic.EmailStr` uses `email-validator` which rejects
RFC 6761 special-use names (`.local`, `.localhost`, `.invalid`, `.test`).
Demo users had been seeded with `@ethara.local` emails, so serializing
them through the login response schema blew up.

**Fix:** Two changes:
1. Switched demo emails to `@ethara.dev` in `app/bootstrap.py` and
   updated existing rows with a one-off `UPDATE users` on Neon.
2. Relaxed `UserPublic.email` from `EmailStr` to `str` — it is an output
   schema, not user input, so strict validation adds no safety.

**Prevention:** Reserve `EmailStr` for request bodies (where user input
must be validated). Response schemas can trust DB contents and use plain
`str` for fields that already have DB-side constraints.

