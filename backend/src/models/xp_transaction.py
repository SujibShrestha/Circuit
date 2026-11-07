import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.db.base import Base


class XpTransaction(Base):
    # reason is a plain string, not a Postgres enum: new reasons (badges, events)
    # can be added without an ALTER TYPE, and the unique constraint still makes
    # awards idempotent.
    __tablename__ = "xp_transactions"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "event_id", "reason", name="uq_xp_user_event_reason"
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    # nullable: awards with no event (signup bonus) point nowhere
    event_id = Column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    reason = Column(String, nullable=False)
    xp = Column(Integer, nullable=False)

    event = relationship("Event")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
