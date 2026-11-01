from fastapi import APIRouter, status

from src.controller import team_controller as ctrl
from src.schema.team import TeamOut

router = APIRouter(prefix="/teams", tags=["Teams"])

router.add_api_route(
    "", ctrl.create_team, methods=["POST"],
    response_model=TeamOut, status_code=status.HTTP_201_CREATED,
)
router.add_api_route("/{team_id}", ctrl.get_team, methods=["GET"], response_model=TeamOut)
router.add_api_route("/{team_id}/join", ctrl.join_team, methods=["POST"], response_model=TeamOut)
router.add_api_route(
    "/{team_id}/members/me", ctrl.leave_team, methods=["DELETE"],
    status_code=status.HTTP_204_NO_CONTENT,
)