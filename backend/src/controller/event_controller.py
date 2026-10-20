import uuid

from fastapi import Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from src.api.deps import get_current_user, require_role
from src.db.session import get_db
from src.models.event import EventCategory
from src.models.user import RoleEnum, User
from src.schema.event import EventCreate, EventOut
from src.schema.registration import AttendeeOut
from src.services import event_service, registration_service

def create_event(
    payload: EventCreate,
    current_user: User = Depends(require_role(RoleEnum.organizer)),
    db: Session = Depends(get_db),
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
    category: EventCategory | None = None,
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    radius_km: float | None = Query(default=None, gt=0, le=500),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[EventOut]:
    has_lat = lat is not None
    has_lng = lng is not None
    has_location = has_lat and has_lng

    if has_lat != has_lng:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="lat and lng must be provided together.",
        )

    if radius_km is not None and not has_location:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="radius_km requires lat and lng.",
        )

    event = event_service.list_events(
        db=db,
        category=category,
        lat=lat,
        lng=lng,
        radius_km=radius_km if has_location else None,
        limit=limit,
        offset=offset,
    )

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No events found.",
        )
    return [EventOut.model_validate(e) for e in event]


def get_event(event_id: uuid.UUID, db: Session = Depends(get_db)) -> EventOut:
    try:
        event = event_service.get_event(db, event_id)
    except event_service.EventNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found.",
        ) from exc

    return EventOut.model_validate(event)


def list_attendees(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AttendeeOut]:
    try:
        attendees = registration_service.list_event_attendees(db, event_id, current_user.id)
    except event_service.EventNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found.",
        ) from exc
    except registration_service.NotEventOrganizerError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc

    return [AttendeeOut.model_validate(attendee) for attendee in attendees]
