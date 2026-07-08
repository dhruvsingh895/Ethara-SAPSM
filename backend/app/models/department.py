"""Department model.

Intentionally has no FK link to `employees.department`. That column stays
a plain string. This table is the canonical list of allowed departments
for the UI dropdown and admin management; renaming a department here
optionally cascades to employees via a separate service call. This avoids
tearing every employee row on a soft label change.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class Department(Base, TimestampMixin):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    def __repr__(self) -> str:
        return f"<Department {self.name}>"
