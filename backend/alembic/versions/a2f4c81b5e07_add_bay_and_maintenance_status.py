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

    # SQLAlchemy's `native_enum=False` created CHECK constraints on
    # seats.status and audit_log.action that reference the OLD enum
    # names (BLOCKED, BLOCK). Widen those first, then UPDATE data.
    # We drop-if-exists because Alembic's initial migration used
    # auto-generated constraint names and we don't want a stale name
    # blocking prod deploys.
    op.execute("ALTER TABLE seats DROP CONSTRAINT IF EXISTS seat_status")
    op.execute("ALTER TABLE seats DROP CONSTRAINT IF EXISTS ck_seats_seat_status")
    op.execute("ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_action")
    op.execute("ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS ck_audit_log_audit_action")

    # Migrate existing data to the new spec vocabulary.
    op.execute("UPDATE seats SET status = 'maintenance' WHERE status = 'blocked'")
    op.execute("UPDATE audit_log SET action = 'maintenance' WHERE action = 'block'")

    # Recreate CHECK constraints with the new value set. Using stable
    # names so future migrations can find them.
    op.execute(
        "ALTER TABLE seats ADD CONSTRAINT ck_seats_seat_status "
        "CHECK (status IN ('available','occupied','reserved','maintenance'))"
    )
    op.execute(
        "ALTER TABLE audit_log ADD CONSTRAINT ck_audit_log_audit_action "
        "CHECK (action IN ("
        "'allocate','release','transfer','maintenance','reserve',"
        "'assign_project','unassign_project','create_employee',"
        "'update_employee','change_role'))"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE seats DROP CONSTRAINT IF EXISTS ck_seats_seat_status")
    op.execute("ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS ck_audit_log_audit_action")
    op.execute("UPDATE audit_log SET action = 'block' WHERE action = 'maintenance'")
    op.execute("UPDATE seats SET status = 'blocked' WHERE status = 'maintenance'")
    op.execute(
        "ALTER TABLE seats ADD CONSTRAINT ck_seats_seat_status "
        "CHECK (status IN ('available','occupied','reserved','blocked'))"
    )
    op.execute(
        "ALTER TABLE audit_log ADD CONSTRAINT ck_audit_log_audit_action "
        "CHECK (action IN ("
        "'allocate','release','transfer','block','reserve',"
        "'assign_project','unassign_project','create_employee',"
        "'update_employee','change_role'))"
    )
    op.drop_index("uq_seats_building_floor_zone_seat_number", table_name="seats")
    op.drop_column("seats", "bay")
