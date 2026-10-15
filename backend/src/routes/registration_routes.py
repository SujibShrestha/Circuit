from fastapi import APIRouter,status
from src.schema.registration import RegistrationOut
from src.controller.registration_controller import cancel, register

router = APIRouter(prefix="/registrations", tags=["Registrations"])

router.add_api_route(
    "/",
    methods=["POST"],
    response_model=RegistrationOut,
    endpoint=register,
    status_code=status.HTTP_201_CREATED,
)

router.add_api_route(
    "/{registration_id}",
    methods=["DELETE"],
    response_model=RegistrationOut,
    endpoint=cancel,
    status_code=status.HTTP_200_OK,
)