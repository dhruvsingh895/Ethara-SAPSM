"""Seat allocation history — one row per allocation event.

A seat is "currently allocated" when there is a row with released_at IS NULL.
Historical rows carry the released_at timestamp.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.employee import Employee
    from app.models.seat import Seat


class SeatAllocation(Base, TimestampMixin):
    __tablename__ = "seat_allocations"
    __table_args__ = (
        # Fast lookup of currently-active allocations for a seat or employee.
        Index("ix_alloc_seat_active", "seat_id", "released_at"),
        Index("ix_alloc_emp_active", "employee_id", "released_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    seat_id: Mapped[int] = mapped_column(
        ForeignKey("seats.id", ondelete="CASCADE"), nullable=False
    )
    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )

    allocated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    released_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    allocated_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    released_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    note: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    seat: Mapped["Seat"] = relationship(back_populates="allocations")
    employee: Mapped["Employee"] = relationship(
        back_populates="seat_allocations", foreign_keys=[employee_id]
    )

    def __repr__(self) -> str:
        state = "active" if self.released_at is None else "released"
        return f"<SeatAllocation seat={self.seat_id} emp={self.employee_id} {state}>"
