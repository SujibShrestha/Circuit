import uuid
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from src.models.event import EventCategory
from src.models.user import User
from src.schema.event import EventCreate, EventOut
from src.services import event_service

def create_event(
    payload: EventCreate,
    current_user: User,
    db: Session,
) -> EventOut:
    try:
        event = event_service.create_event(db, payload, current_user.id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    if not event:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create event.",
        )
    return EventOut.model_validate(event)


def list_events(
    db: Session,
    category: Optional[EventCategory] = None,
) -> list[EventOut]:
    event = event_service.list_events(db, category)

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No events found.",
        )
    return [EventOut.model_validate(e) for e in event]


def get_event(event_id: uuid.UUID, db: Session) -> EventOut:
    try:
        event = event_service.get_event(db, event_id)
    except event_service.EventNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found.",
        ) from exc

    return EventOut.model_validate(event)
