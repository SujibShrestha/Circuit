import uuid
from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError ,func
from sqlalchemy.orm import Session, selectinload

from src.models.event import Event
from src.models.registration import Registration, RegistrationStatus
from src.models.team import Team
from src.schema.team import TeamCreate
from src.services.event_service import EventNotFoundError
from src.services.registration_service import EventEndedError
from src.services.team_membership import remove_from_team


class TeamsNotAllowedError(Exception):
    pass


class NotRegisteredError(Exception):
    pass


class AlreadyInTeamError(Exception):
    pass


class TeamNameTakenError(Exception):
    pass

class TeamNotFoundError(Exception):
    pass


class TeamFullError(Exception):
    pass


class NotInTeamError(Exception):
    pass


def create_team(db: Session, payload: TeamCreate, user_id: uuid.UUID) -> Team:
    event = db.query(Event).filter(Event.id == payload.event_id).first()
    if not event:
        raise EventNotFoundError("Event not found")
    if not event.allow_teams:
        raise TeamsNotAllowedError("This event doesn't allow teams")
    if event.end_time < datetime.now(timezone.utc):
        raise EventEndedError("This event has already ended")

    # Lock the user's own registration row, so two simultaneous requests
    # can't both pass the "not in a team yet" check.
    registration = (
        db.query(Registration)
        .filter(
            Registration.user_id == user_id,
            Registration.event_id == payload.event_id,
            Registration.status == RegistrationStatus.confirmed,
        )
        .with_for_update()
        .first()
    )
    if not registration:
        raise NotRegisteredError("You need a confirmed registration to create a team")
    if registration.team_id is not None:
        raise AlreadyInTeamError("You are already in a team for this event")

    team = Team(
        event_id=payload.event_id,
        name=payload.name.strip(),
        leader_id=user_id,
    )
    db.add(team)

    try:
        db.flush()  # assigns team.id and checks the unique (event_id, name) constraint
    except IntegrityError:
        db.rollback()
        raise TeamNameTakenError("A team with this name already exists in this event")

    registration.team_id = team.id  # the leader is the first member
    db.commit()                     # team and membership are saved together, or not at all
    return get_team(db, team.id) 



def _load_team(db: Session, team_id: uuid.UUID) -> Team | None:
    """Team with members loaded in 2 queries, not one per member."""
    return (
        db.query(Team)
        .options(selectinload(Team.registrations).selectinload(Registration.user))
        .filter(Team.id == team_id)
        .first()
    )


def get_team(db: Session, team_id: uuid.UUID) -> Team:
    team = _load_team(db, team_id)
    if not team:
        raise TeamNotFoundError("Team not found")
    return team

def list_event_teams(db: Session, event_id: uuid.UUID) -> list[Team]:
    if not db.query(Event.id).filter(Event.id == event_id).first():
        raise EventNotFoundError("Event not found")
    return (
        db.query(Team)
        .options(selectinload(Team.registrations).selectinload(Registration.user))
        .filter(Team.event_id == event_id)
        .order_by(Team.created_at)
        .all()
    )


def join_team(db: Session, team_id: uuid.UUID, user_id: uuid.UUID) -> Team:
    # lock the team first so two people can't both take the last slot
    team = db.query(Team).filter(Team.id == team_id).with_for_update().first()
    if not team:
        raise TeamNotFoundError("Team not found")

    event = team.event
    if event.end_time < datetime.now(timezone.utc):
        raise EventEndedError("This event has already ended")

    registration = (
        db.query(Registration)
        .filter(
            Registration.user_id == user_id,
            Registration.event_id == team.event_id,
            Registration.status == RegistrationStatus.confirmed,
        )
        .with_for_update()
        .first()
    )
    if not registration:
        raise NotRegisteredError("You need a confirmed registration to join a team")
    if registration.team_id is not None:
        raise AlreadyInTeamError("You are already in a team for this event")

    member_count = (
        db.query(func.count(Registration.id))
        .filter(Registration.team_id == team.id)
        .scalar()
    )
    if member_count >= event.max_team_size:
        raise TeamFullError("This team is full")

    registration.team_id = team.id
    db.commit()
    return get_team(db, team.id)


def leave_team(db: Session, team_id: uuid.UUID, user_id: uuid.UUID) -> None:
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise TeamNotFoundError("Team not found")

    registration = (
        db.query(Registration)
        .filter(Registration.user_id == user_id, Registration.event_id == team.event_id)
        .first()
    )
    if not registration or registration.team_id != team_id:
        raise NotInTeamError("You are not a member of this team")

    remove_from_team(db, user_id, team.event_id)
    db.commit()