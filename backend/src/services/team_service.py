import uuid
from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.models.event import Event
from src.models.registration import Registration, RegistrationStatus
from src.models.team import Team
from src.schema.team import TeamCreate
from src.services.event_service import EventNotFoundError
from src.services.registration_service import EventEndedError


class TeamsNotAllowedError(Exception):
    pass


class NotRegisteredError(Exception):
    pass


class AlreadyInTeamError(Exception):
    pass


class TeamNameTakenError(Exception):
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
    db.refresh(team)
    return team