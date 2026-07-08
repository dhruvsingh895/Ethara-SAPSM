"""Bootstrap demo users (admin/hr/pm/employee).

Run:
    python -m app.bootstrap

Creates one user per role using SEED_DEMO_PASSWORD. Idempotent — skips
users that already exist. Full seed with 5k employees lives in
`app.seed` (Phase 4).
"""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.enums import UserRole
from app.models.user import User

logging.basicConfig(level="INFO", format="%(levelname)s %(message)s")
log = logging.getLogger("bootstrap")

DEMO_USERS = [
    ("admin", "admin@ethara.dev", UserRole.ADMIN),
    ("hr", "hr@ethara.dev", UserRole.HR),
    ("pm", "pm@ethara.dev", UserRole.PM),
    ("employee", "employee@ethara.dev", UserRole.EMPLOYEE),
]


async def bootstrap() -> None:
    settings = get_settings()
    password_hash = hash_password(settings.seed_demo_password)

    async with SessionLocal() as db:
        created = 0
        for username, email, role in DEMO_USERS:
            existing = (
                await db.execute(select(User).where(User.username == username))
            ).scalar_one_or_none()
            if existing:
                log.info("skip existing user: %s", username)
                continue
            db.add(
                User(
                    username=username,
                    email=email,
                    hashed_password=password_hash,
                    role=role,
                    is_active=True,
                )
            )
            created += 1
        await db.commit()
        log.info("bootstrap complete: %d user(s) created", created)


if __name__ == "__main__":
    asyncio.run(bootstrap())
