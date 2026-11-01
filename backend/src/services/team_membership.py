import uuid

from sqlalchemy.orm import Session

from src.models.registration import Registration
from src.models.team import Team


def remove_from_team(db: Session, user_id: uuid.UUID, event_id: uuid.UUID) -> bool:
    """Take a user out of their team for this event.
    Hands leadership on, or deletes the team if it's now empty.
    Does NOT commit: the caller owns the transaction.
    Returns True if the user was actually in a team."""
    registration = (
        db.query(Registration)
        .filter(Registration.user_id == user_id, Registration.event_id == event_id)
        .first()
    )
    if not registration or registration.team_id is None:
        return False

    # Lock order is always team first, then registration. join_team does the
    # same, which prevents two requests from deadlocking each other.
    team = (
        db.query(Team).filter(Team.id == registration.team_id).with_for_update().first()
    )
    registration = (
        db.query(Registration)
        .filter(Registration.id == registration.id)
        .with_for_update()
        .first()
    )

    registration.team_id = None
    db.flush()

    successor = (
        db.query(Registration)
        .filter(Registration.team_id == team.id)
        .order_by(Registration.created_at)   # earliest registered member
        .first()
    )

    if successor is None:
        db.delete(team)                      # last member left
    elif team.leader_id == user_id:
        team.leader_id = successor.user_id   # leader left: pass it on

    return True