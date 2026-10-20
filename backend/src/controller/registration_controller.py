import uuid

from fastapi import Depends, HTTPException,  status
from sqlalchemy.orm import Session

from src.api.deps import get_current_user
from src.db.session import get_db
from src.models.user import RoleEnum, User
from src.schema.registration import RegistrationCreate, RegistrationOut
from src.services import event_service, registration_service as svc

def register(
        payload: RegistrationCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
)-> RegistrationOut:
    try:
        registration = svc.register_for_event(db, current_user.id, payload.event_id)
    except event_service.EventNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except svc.AlreadyRegisteredError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except svc.EventEndedError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except svc.OrganizerCannotRegisterError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    if not registration:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to register for event.",
        )
    return RegistrationOut.model_validate(registration)


def cancel(
        registration_id: uuid.UUID,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
) -> RegistrationOut:
    try:
        registration = svc.cancel_registration(db, current_user.id, registration_id)
    except svc.RegistrationNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except event_service.EventNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except svc.NotEventOrganizerError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc

    if not registration:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to cancel registration.",
        )
    return RegistrationOut.model_validate(registration)


def my_registrations(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
) -> list[RegistrationOut]:
    
    
    registrations = svc.list_registrations(db, current_user.id)
    return [RegistrationOut.model_validate(reg) for reg in registrations]

def list_event_registrations(
        event_id: uuid.UUID,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
) -> list[RegistrationOut]:
    if current_user.role != RoleEnum.ORGANIZER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organizers can view event registrations.",
        )
    try:
        registrations = svc.list_registrations(db, event_id, current_user.id)
    except svc.NotEventOrganizerError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    except svc.EventNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    return [RegistrationOut.model_validate(reg) for reg in registrations]
