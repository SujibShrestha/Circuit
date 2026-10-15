import uuid

from fastapi import Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from src.api.deps import get_current_user, require_role
from src.db.session import get_db
from src.models.event import EventCategory
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