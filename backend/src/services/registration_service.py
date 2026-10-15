import uuid
from datetime import datetime, timezone

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
            Registration.status == RegistrationStatus.CONFIRMED,
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

    if existing and existing.status != RegistrationStatus.CANCELLED:
        raise AlreadyRegisteredError("User is already registered for this event")

    status = (
        RegistrationStatus.CONFIRMED
        if _taken_spot(db, event_id) < event.capacity
        else RegistrationStatus.WAITLISTED
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


