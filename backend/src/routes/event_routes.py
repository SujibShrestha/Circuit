import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.api.deps import require_role
from src.controller import event_controller
from src.db.session import get_db
from src.models.event import EventCategory
from src.models.user import RoleEnum, User
from src.schema.event import EventCreate, EventOut

router = APIRouter(prefix="/events", tags=["Events"])


@router.post("/", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event_route(
    payload: EventCreate,
    current_user: User = Depends(require_role(RoleEnum.organizer)),
    db: Session = Depends(get_db),
):
    return event_controller.create_event(payload, current_user, db)


@router.get("/", response_model=list[EventOut])
def list_events_route(
    category: EventCategory | None = None,
    db: Session = Depends(get_db),
):
    return event_controller.list_events(db, category)


@router.get("/{event_id}", response_model=EventOut)
def get_event_route(
    event_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    return event_controller.get_event(event_id, db)
