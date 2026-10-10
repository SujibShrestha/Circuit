import uuid
from typing import Optional

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.api.deps import require_role
from src.db.session import get_db
from src.models.event import EventCategory
from src.models.user import RoleEnum, User
from src.schema.event import EventCreate, EventOut
from src.services import event_service

def create_event(
    payload: EventCreate,
    current_user: User = Depends(require_role(RoleEnum.organizer)),
    db: Session = Depends(get_db),
) -> EventOut:
    event = event_service.create_event(db, payload, current_user.id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create event.",
        )
    print(EventOut.model_validate(event))
    return EventOut.model_validate(event)


