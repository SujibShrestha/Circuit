import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.models.event import EventCategory


class EventCreate(BaseModel):
    name: str = Field(min_length=3, max_length=150)
    description: Optional[str] = Field(default=None, max_length=5000)
    category: EventCategory
    venue: str = Field(min_length=3, max_length=300)
    start_time: datetime
    end_time: datetime
    capacity: int = Field(default=100, ge=1, le=100000)
    allow_teams: bool = False
    max_team_size: int = Field(default=1, ge=1, le=20)

    @model_validator(mode="after")
    def check_times(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organizer_id: uuid.UUID
    name: str
    description: Optional[str] = None
    category: EventCategory
    venue: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    start_time: datetime
    end_time: datetime
    capacity: int
    allow_teams: bool
    max_team_size: int
    status: str  # derived property on the model
    distance_km: Optional[float] = None
    spots_left: Optional[int] = None


class ResultItem(BaseModel):
    place: int = Field(ge=1, le=3)
    team_id: Optional[uuid.UUID] = None
    user_id: Optional[uuid.UUID] = None

    @model_validator(mode="after")
    def exactly_one_target(self):
        if (self.team_id is None) == (self.user_id is None):
            raise ValueError("exactly one of team_id or user_id is required")
        return self


class ResultsCreate(BaseModel):
    results: list[ResultItem] = Field(min_length=1, max_length=1000)


class ResultsOut(BaseModel):
    awarded: int
