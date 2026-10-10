from fastapi import APIRouter
from src.controller import event_controller
from src.schema.event import EventOut

router = APIRouter(prefix="/events", tags=["Events"])


router.post("/", response_model=EventOut)
def create_event_route(payload: event_controller.EventCreate):
    return event_controller.create_event(payload)