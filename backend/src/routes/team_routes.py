from fastapi import APIRouter, Depends
from src.models.user import User
from src.schema.team import TeamCreate
from src.controller import team_controller
from src.api.deps import get_current_user

router = APIRouter(prefix="/teams", tags=["teams"])

@router.post("/")
def create_team(payload: TeamCreate, current_user: User = Depends(get_current_user)):
    return team_controller.create(payload, current_user)