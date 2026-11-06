from fastapi import APIRouter

from src.controller import leaderboard_controller
from src.schema.leaderboard import LeaderboardEntry

router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])

router.add_api_route(
    "",
    leaderboard_controller.leaderboard,
    methods=["GET"],
    response_model=list[LeaderboardEntry],
)
