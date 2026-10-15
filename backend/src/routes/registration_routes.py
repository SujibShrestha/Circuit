from fastapi import APIRouter,status
from src.schema.registration import RegistrationOut
from src.controller.registration_controller import register

router = APIRouter(prefix="/registrations", tags=["Registrations"])

router.add_api_route(
    "/",
    methods=["POST"],
    response_model=RegistrationOut,
    endpoint=register,
    status_code=status.HTTP_201_CREATED,
)