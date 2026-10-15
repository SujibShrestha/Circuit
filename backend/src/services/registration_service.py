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

def cancel_registration(db:Session, user_id:uuid.UUID, event_id:uuid.UUID) -> None:
    _lock_event(db, event_id)
    registration = (
        db.query(Registration)
        .filter(Registration.event_id == event_id, Registration.user_id == user_id)
        .first()
    )

    if not registration or registration.status not in (
        RegistrationStatus.CONFIRMED,
        RegistrationStatus.WAITLISTED,
    ):
        raise RegistrationNotFoundError("Registration not found")
    freed_a_spot = registration.status == RegistrationStatus.CONFIRMED
    registration.status = RegistrationStatus.CANCELLED

    if freed_a_spot:
        # Promote the first waitlisted registration to confirmed
        waitlisted_registration = (
            db.query(Registration)
            .filter(
                Registration.event_id == event_id,
                Registration.status == RegistrationStatus.WAITLISTED,
            )
            .order_by(Registration.created_at)
            .first()
        )
        if waitlisted_registration:
            waitlisted_registration.status = RegistrationStatus.CONFIRMED
            # later: send 'you are in' email to waitlisted_registration.user_id

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise RegistrationNotFoundError("Registration not found")

    

    
    
    