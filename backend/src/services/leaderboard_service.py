import uuid

from sqlalchemy.orm import Session

from src.models.user import User


def list_leaderboard(
    db: Session,
    scope: str,
    college: str | None,
    limit: int,
) -> list[tuple[int, User]]:
    """Top users ordered by xp desc, oldest account first on ties.
    Returns (rank, user) pairs; rank is the row position, and because the
    ordering is total (xp, created_at, id) it is the true global rank."""
    if scope == "college":
        if college is None:
            return []  # caller signed up without a college: empty board, not an error

    query = db.query(User)
    if scope == "college":
        query = query.filter(User.college == college)

    rows = (
        query.order_by(User.xp.desc(), User.created_at.asc(), User.id.asc())
        .limit(limit)
        .all()
    )
    return list(enumerate(rows, start=1))
