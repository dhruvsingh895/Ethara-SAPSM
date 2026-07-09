"""enforce one active project per employee (spec §3.2)

Revision ID: c7d3e2a91f10
Revises: a2f4c81b5e07
Create Date: 2026-07-09 13:30:00.000000

Adds a partial unique index on project_assignments so an employee can
have at most one row with end_date IS NULL. Historical rows (end_date
set) are unrestricted so we don't lose audit trail.

If existing data violates the constraint, this migration will fail —
run the reseed first (`python -m app.seed --wipe`) or manually close
out extra active assignments before upgrading.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "c7d3e2a91f10"
down_revision: Union[str, None] = "a2f4c81b5e07"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE UNIQUE INDEX uq_pa_active_employee "
        "ON project_assignments (employee_id) "
        "WHERE end_date IS NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_pa_active_employee")
