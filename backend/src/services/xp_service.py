import uuid

from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.models.user import User
from src.models.xp_transaction import XpTransaction

XP_VALUES = {
    "attended": 15,
    "won_third": 50,
    "won_second": 75,
    "won_first": 100,
}

PLACEMENT_REASONS = {1: "won_first", 2: "won_second", 3: "won_third"}


def award_xp(
    db: Session,
    user_id: uuid.UUID,
    event_id: uuid.UUID | None,
    reason: str,
    xp: int,
) -> bool:
    """Write one ledger row and bump users.xp with a SQL-side increment.
    Returns False if this (user, event, reason) award already exists, so
    repeated calls are no-ops. Does NOT commit: the caller owns the transaction."""
    try:
        with db.begin_nested():  # savepoint: the failed insert can't poison the transaction
            db.add(
                XpTransaction(
                    user_id=user_id, event_id=event_id, reason=reason, xp=xp
                )
            )
            db.flush()
    except IntegrityError:
        return False

    db.execute(update(User).where(User.id == user_id).values(xp=User.xp + xp))
    return True


def users_with_placement(db: Session, event_id: uuid.UUID) -> set[uuid.UUID]:
    """Users who already earned placement XP for this event (one grouped query)."""
    rows = (
        db.query(XpTransaction.user_id)
        .filter(
            XpTransaction.event_id == event_id,
            XpTransaction.reason.in_(list(PLACEMENT_REASONS.values())),
        )
        .distinct()
        .all()
    )
    return {row[0] for row in rows}
