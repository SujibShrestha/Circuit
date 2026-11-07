"""One-time dev migration: xp_transactions.event_id must be nullable for the
signup bonus (which has no event). create_all never alters existing columns."""
import pathlib
import re

from sqlalchemy import create_engine, text

env = pathlib.Path(__file__).with_name(".env").read_text()
url = re.search(r"DATABASE_URL\s*=\s*'([^']+)'", env).group(1)
engine = create_engine(url)

check = text(
    "select is_nullable from information_schema.columns "
    "where table_name='xp_transactions' and column_name='event_id'"
)

with engine.connect() as conn:
    before = conn.execute(check).scalar()
    print("event_id nullable before:", before)
    if before == "NO":
        conn.execute(text("ALTER TABLE xp_transactions ALTER COLUMN event_id DROP NOT NULL"))
        conn.commit()
        print("altered")
    print("event_id nullable after:", conn.execute(check).scalar())
