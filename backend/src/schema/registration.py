import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from src.models.registration import RegistrationStatus


class RegistrationCreate(BaseModel):
    event_id: uuid.UUID


class EventSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    venue: str
    start_time: datetime
    end_time: datetime
    status: str  # derived: upcoming / ongoing / completed


class RegistrationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_id: uuid.UUID
    status: RegistrationStatus
    created_at: datetime
    event: EventSummary