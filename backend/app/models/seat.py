"""Seat model — physical desk."""

from __future__ import annotations

from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Enum as SAEnum, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import SeatStatus
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.employee import Employee
    from app.models.seat_allocation import SeatAllocation


class Seat(Base, TimestampMixin):
    __tablename__ = "seats"
    __table_args__ = (
        Index("ix_seats_building_floor", "building", "floor"),
        Index("ix_seats_status_floor", "status", "floor"),
        # Spec requires no duplicate seat_number on the same floor/zone.
        # Include building so multi-building estates still work.
        Index(
            "uq_seats_building_floor_zone_seat_number",
            "building",
            "floor",
            "zone",
            "seat_number",
            unique=True,
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    seat_code: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)

    building: Mapped[str] = mapped_column(String(16), nullable=False)
    floor: Mapped[int] = mapped_column(Integer, nullable=False)
    zone: Mapped[str] = mapped_column(String(16), nullable=False)
    # Bay = physical cluster of seats within a zone (spec field). Kept
    # nullable so existing rows before the migration don't blow up; the
    # seed always populates it.
    bay: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    seat_number: Mapped[int] = mapped_column(Integer, nullable=False)

    status: Mapped[SeatStatus] = mapped_column(
        SAEnum(SeatStatus, name="seat_status", native_enum=False, length=32),
        nullable=False,
        default=SeatStatus.AVAILABLE,
        index=True,
    )

    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    current_occupant: Mapped[Optional["Employee"]] = relationship(
        back_populates="current_seat",
        foreign_keys="Employee.current_seat_id",
        uselist=False,
    )

    allocations: Mapped[List["SeatAllocation"]] = relationship(
        back_populates="seat",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Seat {self.seat_code} status={self.status.value}>"
