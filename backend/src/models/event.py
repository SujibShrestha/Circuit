import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.db.base import Base


class EventCategory(str, enum.Enum):
    hackathon = "hackathon"
    workshop = "workshop"
    seminar = "seminar"
    meetup = "meetup"


class Event(Base):
    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organizer_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    category = Column(Enum(EventCategory), nullable=False)

    venue = Column(String, nullable=False)
    latitude = Column(Float, nullable=True)    # null if geocoding failed
    longitude = Column(Float, nullable=True)

    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)

    capacity = Column(Integer, nullable=False, default=100)
    allow_teams = Column(Boolean, nullable=False, default=False)
    max_team_size = Column(Integer, nullable=False, default=1)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organizer = relationship("User")

    @property
    def status(self) -> str:
        now = datetime.now(timezone.utc)
        if now < self.start_time:
            return "upcoming"
        if now <= self.end_time:
            return "ongoing"
        return "completed"