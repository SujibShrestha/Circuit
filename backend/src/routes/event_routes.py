from fastapi import APIRouter, status

from src.schema.registration import RegistrationOut
from src.controller import event_controller,registration_controller
from src.schema.event import EventOut

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
    "/{event_id}",
    event_controller.get_event,
    methods=["GET"],
    response_model=EventOut,
)

router.add_api_route(
    "/{event_id}",
   registration_controller.list_event_registrations,
    methods=["GET"],
    response_model=list[RegistrationOut],
)