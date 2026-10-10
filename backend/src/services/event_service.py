import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from src.models.event import Event, EventCategory
from src.schema.event import EventCreate
from src.utils.geocode import geocode_address


class EventNotFoundError(Exception):
    pass

def create_event(db:Session, payload: EventCreate, organizer_id: uuid.UUID) ->Event:

    coords = geocode_address(payload.venue)
    lat, lng = coords if coords else (None, None)
    event = Event(
        **payload.model_dump(),
        organizer_id=organizer_id,
        latitude=lat,
        longitude=lng,
    )
    if event == None:
        raise ValueError("Failed to create event.")
    
    db.add(event)
    try:
     db.commit()
    except Exception as e:
        db.rollback()
        raise ValueError(f"Failed to create event: {e}")
    db.refresh(event)

    return event


def list_events(db: Session, category: EventCategory | None = None) -> list[Event]:
    query = db.query(Event).filter(Event.end_time >= datetime.now(timezone.utc))
    if category:
        query = query.filter(Event.category == category)
    return query.order_by(Event.start_time).all()

def get_event(db: Session, event_id: uuid.UUID) -> Event:
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise EventNotFoundError("Event not found")
    return event