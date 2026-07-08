"""add departments table

Revision ID: ce61f5725b04
Revises: 382bc0c49159
Create Date: 2026-07-08 22:04:26.624001

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ce61f5725b04'
down_revision: Union[str, None] = '382bc0c49159'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'departments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=64), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_departments')),
    )
    op.create_index(
        op.f('ix_departments_name'),
        'departments',
        ['name'],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_departments_name'), table_name='departments')
    op.drop_table('departments')
