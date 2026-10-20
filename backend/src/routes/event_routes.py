from fastapi import APIRouter, status

from src.controller import event_controller
from src.schema.event import EventOut
from src.schema.registration import AttendeeOut

router = APIRouter(prefix="/events", tags=["Events"])

router.add_api_route(
    "/",
    event_controller.create_event,
    methods=["POST"],
    response_model=EventOut,
    status_code=status.HTTP_201_CREATED,
)
router.add_api_route(
    "/",
    event_controller.list_events,
    methods=["GET"],
    response_model=list[EventOut],
)
router.add_api_route(
    "/{event_id}/attendees",
    event_controller.list_attendees,
    methods=["GET"],
    response_model=list[AttendeeOut],
)
router.add_api_route(
    "/{event_id}",
    event_controller.get_event,
    methods=["GET"],
    response_model=EventOut,
)
