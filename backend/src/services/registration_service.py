import uuid
from datetime import datetime, timezone

from src.services.team_membership import remove_from_team
from src.schema.event import ResultItem
from src.services.xp_service import (
    PLACEMENT_REASONS,
    XP_VALUES,
    award_xp,
    users_with_placement,
)
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from src.models.event import Event
from src.models.registration import Registration, RegistrationStatus
from src.services.event_service import EventNotFoundError

class AlreadyRegisteredError(Exception):
    pass

class EventEndedError(Exception):
    pass


class EventNotStartedError(Exception):
    pass


class EventNotEndedError(Exception):
    pass


class ResultsInvalidError(Exception):
    pass


class RegistrationStatusError(Exception):
    pass


class OrganizerCannotRegisterError(Exception):
    pass


class RegistrationNotFoundError(Exception):
    pass


class NotEventOrganizerError(Exception):
    pass

def _lock_event(db: Session, event_id: uuid.UUID) -> Event:
    """Fetch the event and lock its row until this transaction ends.
    A second request for the same event waits here, so two people can't
    both grab the last spot."""
    if not event_id:
        raise ValueError("Event ID is required")

    event = (
        db.query(Event).filter(Event.id == event_id).with_for_update().first() # Lock the row for update
    )
    if not event:
        raise EventNotFoundError("Event not found")
    return event

def _taken_spot(db:Session,event_id:uuid.UUID) -> int:
    """Return the number of taken spots for an event."""
    if not event_id:
        raise ValueError("Event ID is required")

    count = (
        db.query(func.count(Registration.id))
        .filter(
            Registration.event_id == event_id,
            Registration.status == RegistrationStatus.confirmed,
        )
        .scalar()
    )
    return count

def register_for_event(db: Session, user_id: uuid.UUID, event_id: uuid.UUID) -> Registration:
    event = _lock_event(db, event_id)

    if event.organizer_id == user_id:
        raise OrganizerCannotRegisterError("Organizer cannot register for their own event")

    if event.end_time < datetime.now(timezone.utc):
        raise EventEndedError("Event has already ended")

    existing = (db.query(Registration)
                .filter(Registration.event_id == event_id, Registration.user_id == user_id)
                .first())

    if existing and existing.status != RegistrationStatus.cancelled:
        raise AlreadyRegisteredError("User is already registered for this event")

    status = (
        RegistrationStatus.confirmed
        if _taken_spot(db, event_id) < event.capacity
        else RegistrationStatus.waitlisted
    )

    if existing:
        existing.status = status
        registration = existing
    else:
        registration = Registration(
            user_id=user_id,
            event_id=event_id,
            status=status,
        )
        db.add(registration)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AlreadyRegisteredError("User is already registered for this event")

    db.refresh(registration)
    return registration

def cancel_registration(db:Session, user_id:uuid.UUID, registration_id:uuid.UUID) -> Registration:
    registration = (
        db.query(Registration)
        .options(joinedload(Registration.event))
        .filter(Registration.id == registration_id, Registration.user_id == user_id)
        .first()
    )

    if not registration or registration.status not in (
        RegistrationStatus.confirmed,
        RegistrationStatus.waitlisted,
    ):
        raise RegistrationNotFoundError("Registration not found")

    _lock_event(db, registration.event_id)
    remove_from_team(db, user_id, registration.event_id)  
    freed_a_spot = registration.status == RegistrationStatus.confirmed
    registration.status = RegistrationStatus.cancelled

    if freed_a_spot:
        # Promote the first waitlisted registration to confirmed
        waitlisted_registration = (
            db.query(Registration)
            .filter(
                Registration.event_id == registration.event_id,
                Registration.status == RegistrationStatus.waitlisted,
            )
            .order_by(Registration.created_at)
            .first()
        )
        if waitlisted_registration:
            waitlisted_registration.status = RegistrationStatus.confirmed
            # later: send 'you are in' email to waitlisted_registration.user_id

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise RegistrationNotFoundError("Registration not found")

    db.refresh(registration)
    return registration


def list_registrations(db: Session, user_id: uuid.UUID)-> list[Registration]:
    """List all registrations for a user."""
    registrations = (
        db.query(Registration)
        .options(joinedload(Registration.event))
        .filter(Registration.user_id == user_id)
        .all()
    )
    if registrations is None:
        raise RegistrationNotFoundError("No registrations found for this user")
    return registrations   

def list_event_attendees(db:Session, event_id:uuid.UUID, organizer_id:uuid.UUID) -> list[Registration]:
    """List all registrations for an event. Only the organizer can view this."""
    event = _lock_event(db, event_id)
    if event.organizer_id != organizer_id:
        raise NotEventOrganizerError("Only the organizer can view attendees")
    registrations = (
        db.query(Registration)
        .options(joinedload(Registration.user))
        .filter(Registration.event_id == event_id)
        .all()
    )
    if registrations is None:
        raise RegistrationNotFoundError("No registrations found for this event")
    return registrations


def mark_attended(
    db: Session,
    event_id: uuid.UUID,
    organizer_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Registration:
    """Organizer marks a confirmed registration attended and awards the
    attendance XP. Idempotent: re-running does not award twice.
    Commits: it owns the transaction."""
    event = _lock_event(db, event_id)
    if event.organizer_id != organizer_id:
        raise NotEventOrganizerError("Only the organizer can mark attendance")
    if event.start_time > datetime.now(timezone.utc):
        raise EventNotStartedError("Event has not started yet")

    registration = (
        db.query(Registration)
        .filter(Registration.event_id == event_id, Registration.user_id == user_id)
        .with_for_update()
        .first()
    )
    if not registration:
        raise RegistrationNotFoundError("Registration not found")
    if registration.status == RegistrationStatus.attended:
        return registration
    if registration.status != RegistrationStatus.confirmed:
        raise RegistrationStatusError("Only confirmed registrations can be marked attended")

    registration.status = RegistrationStatus.attended
    award_xp(db, user_id, event_id, "attended", XP_VALUES["attended"])

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise RegistrationNotFoundError("Registration not found")
    db.refresh(registration)
    return registration


def post_results(
    db: Session,
    event_id: uuid.UUID,
    organizer_id: uuid.UUID,
    results: list[ResultItem],
) -> int:
    """Award placement XP for a finished event. Per team on team events, per
    person otherwise. Idempotent: users who already have placement XP for this
    event are skipped. Commits once at the end: it owns the transaction."""
    event = _lock_event(db, event_id)
    if event.organizer_id != organizer_id:
        raise NotEventOrganizerError("Only the organizer can post results")
    if event.end_time > datetime.now(timezone.utc):
        raise EventNotEndedError("Event has not ended yet")

    # All validation happens before any award, so a bad payload never half-pays.
    places = [item.place for item in results]
    targets = [item.team_id or item.user_id for item in results]
    if len(set(places)) != len(places):
        raise ResultsInvalidError("Each place can only be used once")
    if len(set(targets)) != len(targets):
        raise ResultsInvalidError("Each team/user can only be placed once")
    if event.allow_teams and any(item.team_id is None for item in results):
        raise ResultsInvalidError("Team events take team_id in results")
    if not event.allow_teams and any(item.user_id is None for item in results):
        raise ResultsInvalidError("Solo events take user_id in results")

    # One grouped query, not one per row.
    members: dict[uuid.UUID, list[uuid.UUID]] = {}
    if event.allow_teams:
        rows = (
            db.query(Registration.team_id, Registration.user_id)
            .filter(
                Registration.event_id == event_id,
                Registration.status == RegistrationStatus.attended,
                Registration.team_id.in_(targets),
            )
            .all()
        )
        for team_id, member_id in rows:
            members.setdefault(team_id, []).append(member_id)
    else:
        rows = (
            db.query(Registration.user_id)
            .filter(
                Registration.event_id == event_id,
                Registration.status == RegistrationStatus.attended,
                Registration.user_id.in_(targets),
            )
            .all()
        )
        members = {member_id: [member_id] for (member_id,) in rows}

    unattended = [target for target in targets if not members.get(target)]
    if unattended:
        raise ResultsInvalidError(
            "Every place needs at least one attendee marked attended"
        )

    already_placed = users_with_placement(db, event_id)
    awarded = 0
    for item, target in zip(results, targets):
        reason = PLACEMENT_REASONS[item.place]
        for member_id in members[target]:
            if member_id in already_placed:
                continue
            if award_xp(db, member_id, event_id, reason, XP_VALUES[reason]):
                awarded += 1

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ResultsInvalidError("Results could not be saved")
    return awarded

    
