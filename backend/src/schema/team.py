from pydantic import BaseModel, Field


class TeamCreate(BaseModel):
    event_id: str = Field(..., description="The ID of the event the team is associated with")
    name: str = Field(..., description="The name of the team")

class TeamMemberOut(BaseModel):
    id: str = Field(..., description="The ID of the team member")
    name: str = Field(..., description="The name of the team member")
    email: str = Field(..., description="The email of the team member")

class TeamOut(BaseModel):
    id: str = Field(..., description="The ID of the team")
    event_id: str = Field(..., description="The ID of the event the team is associated with")
    leader_id: str = Field(..., description="The ID of the team leader")
    name: str = Field(..., description="The name of the team")
    members: list[TeamMemberOut] = Field(..., description="List of team members")

