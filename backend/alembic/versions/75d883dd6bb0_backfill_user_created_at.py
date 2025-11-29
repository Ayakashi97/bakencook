"""backfill_user_created_at

Revision ID: 75d883dd6bb0
Revises: d8982b222726
Create Date: 2025-11-29 19:19:22.860114

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '75d883dd6bb0'
down_revision: Union[str, None] = 'd8982b222726'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Update existing users with NULL created_at to current timestamp
    op.execute("UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL")


def downgrade() -> None:
    # No need to revert this data change
    pass
