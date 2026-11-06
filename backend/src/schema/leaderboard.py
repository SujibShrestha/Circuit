import uuid

from pydantic import BaseModel, ConfigDict


class LeaderboardEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    rank: int
    id: uuid.UUID
    name: str
    college: str | None = None
    xp: int
    level: int
