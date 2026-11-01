import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field


class TeamCreate(BaseModel):
    event_id: uuid.UUID
    name: str = Field(min_length=2, max_length=50)


class TeamMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID          # was: str
    name: str
    college: str | None = None


class TeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID          # was: str
    event_id: uuid.UUID    # was: str
    name: str
    leader_id: uuid.UUID   # was: str
    created_at: datetime
    members: list[TeamMemberOut]

    @computed_field
    @property
    def member_count(self) -> int:
        return len(self.members)