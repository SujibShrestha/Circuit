from typing import Literal

from fastapi import Depends, Query
from sqlalchemy.orm import Session

from src.api.deps import get_current_user
from src.db.session import get_db
from src.models.user import User
from src.schema.leaderboard import LeaderboardEntry
from src.services import leaderboard_service


def leaderboard(
    scope: Literal["global", "college"] = "global",
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[LeaderboardEntry]:
    college = current_user.college if scope == "college" else None
    rows = leaderboard_service.list_leaderboard(db, scope, college, limit)
    return [
        LeaderboardEntry(
            rank=rank,
            id=user.id,
            name=user.name,
            college=user.college,
            xp=user.xp,
            level=user.level,
        )
        for rank, user in rows
    ]
