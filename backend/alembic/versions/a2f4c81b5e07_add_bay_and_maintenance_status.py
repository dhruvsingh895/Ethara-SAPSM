"""add seat.bay column, rename blocked -> maintenance, composite unique

Revision ID: a2f4c81b5e07
Revises: ce61f5725b04
Create Date: 2026-07-09 12:00:00.000000

Aligns the seat model with the assessment spec:
  - Adds `bay` (nullable text) so seats have floor/zone/bay/seat_number.
  - Renames the "blocked" seat_status value to "maintenance" (spec wording).
  - Renames audit_actions.action "block" -> "maintenance" to match.
  - Adds a unique index on (building, floor, zone, seat_number) so a
    duplicate seat within the same physical spot is rejected at the DB.

The status/action columns are VARCHAR-backed (native_enum=False), so no
enum-type ALTER is required — a plain UPDATE swaps the string value.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a2f4c81b5e07"
down_revision: Union[str, None] = "ce61f5725b04"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add the new column and unique index first — cheap, non-destructive.
    op.add_column(
        "seats",
        sa.Column("bay", sa.String(length=16), nullable=True),
    )
    op.create_index(
        "uq_seats_building_floor_zone_seat_number",
        "seats",
        ["building", "floor", "zone", "seat_number"],
        unique=True,
    )

    # ------------------------------------------------------------------
    # SQLAlchemy with `native_enum=False` stores enum NAMES (uppercase:
    # 'BLOCKED', 'BLOCK'), and the initial migration wrote CHECK
    # constraints against those uppercase names. Keep the same on-disk
    # contract — just rename BLOCKED -> MAINTENANCE. Values-in-code
    # ('maintenance' lowercase) are the client-facing wire format and
    # don't touch the DB directly.
    # ------------------------------------------------------------------
    op.execute("ALTER TABLE seats DROP CONSTRAINT IF EXISTS seat_status")
    op.execute("ALTER TABLE seats DROP CONSTRAINT IF EXISTS ck_seats_seat_status")
    op.execute("ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_action")
    op.execute("ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS ck_audit_log_audit_action")

    # Rename existing rows to the new enum name.
    op.execute("UPDATE seats SET status = 'MAINTENANCE' WHERE status = 'BLOCKED'")
    op.execute("UPDATE audit_log SET action = 'MAINTENANCE' WHERE action = 'BLOCK'")

    # Recreate CHECK constraints with the new NAME set. Names, not
    # values, are what SQLAlchemy inserts under native_enum=False.
    op.execute(
        "ALTER TABLE seats ADD CONSTRAINT ck_seats_seat_status "
        "CHECK (status IN ('AVAILABLE','OCCUPIED','RESERVED','MAINTENANCE'))"
    )
    op.execute(
        "ALTER TABLE audit_log ADD CONSTRAINT ck_audit_log_audit_action "
        "CHECK (action IN ("
        "'ALLOCATE','RELEASE','TRANSFER','MAINTENANCE','RESERVE',"
        "'ASSIGN_PROJECT','UNASSIGN_PROJECT','CREATE_EMPLOYEE',"
        "'UPDATE_EMPLOYEE','CHANGE_ROLE'))"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE seats DROP CONSTRAINT IF EXISTS ck_seats_seat_status")
    op.execute("ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS ck_audit_log_audit_action")
    op.execute("UPDATE audit_log SET action = 'BLOCK' WHERE action = 'MAINTENANCE'")
    op.execute("UPDATE seats SET status = 'BLOCKED' WHERE status = 'MAINTENANCE'")
    op.execute(
        "ALTER TABLE seats ADD CONSTRAINT ck_seats_seat_status "
        "CHECK (status IN ('AVAILABLE','OCCUPIED','RESERVED','BLOCKED'))"
    )
    op.execute(
        "ALTER TABLE audit_log ADD CONSTRAINT ck_audit_log_audit_action "
        "CHECK (action IN ("
        "'ALLOCATE','RELEASE','TRANSFER','BLOCK','RESERVE',"
        "'ASSIGN_PROJECT','UNASSIGN_PROJECT','CREATE_EMPLOYEE',"
        "'UPDATE_EMPLOYEE','CHANGE_ROLE'))"
    )
    op.drop_index("uq_seats_building_floor_zone_seat_number", table_name="seats")
    op.drop_column("seats", "bay")
