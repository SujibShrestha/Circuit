import enum
import uuid

from sqlalchemy import Column, String, Integer, Enum, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from src.db.base import Base


class RoleEnum(str, enum.Enum):
    organizer = "organizer"
    participant = "participant"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.participant, nullable=False)
    college = Column(String, nullable=True)
    xp = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    @property
    def level(self) -> int:
        """Derived, not stored — level = floor(sqrt(xp / 50)) + 1"""
        import math
        return math.floor(math.sqrt(self.xp / 50)) + 1