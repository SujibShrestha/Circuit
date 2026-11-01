import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.api.deps import get_current_user
from src.db.session import get_db
from src.models.user import User
from src.schema.team import TeamCreate, TeamOut
from src.services import team_service as svc
from src.services.event_service import EventNotFoundError
from src.services.registration_service import EventEndedError

_STATUS_FOR = {
    EventNotFoundError: status.HTTP_404_NOT_FOUND,
    svc.TeamNotFoundError: status.HTTP_404_NOT_FOUND,
    svc.NotInTeamError: status.HTTP_404_NOT_FOUND,
    svc.AlreadyInTeamError: status.HTTP_409_CONFLICT,
    svc.TeamNameTakenError: status.HTTP_409_CONFLICT,
    svc.NotRegisteredError: status.HTTP_403_FORBIDDEN,
    svc.TeamsNotAllowedError: status.HTTP_400_BAD_REQUEST,
    svc.TeamFullError: status.HTTP_400_BAD_REQUEST,
    EventEndedError: status.HTTP_400_BAD_REQUEST,
}
_EXPECTED = tuple(_STATUS_FOR)


def _raise_http(exc: Exception):
    raise HTTPException(status_code=_STATUS_FOR[type(exc)], detail=str(exc)) from exc


def create_team(
    payload: TeamCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TeamOut:
    try:
        return svc.create_team(db, payload, current_user.id)
    except _EXPECTED as exc:
        _raise_http(exc)


def get_team(team_id: uuid.UUID, db: Session = Depends(get_db)) -> TeamOut:
    try:
        return svc.get_team(db, team_id)
    except _EXPECTED as exc:
        _raise_http(exc)


def list_event_teams(event_id: uuid.UUID, db: Session = Depends(get_db)) -> list[TeamOut]:
    try:
        return svc.list_event_teams(db, event_id)
    except _EXPECTED as exc:
        _raise_http(exc)


def join_team(
    team_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TeamOut:
    try:
        return svc.join_team(db, team_id, current_user.id)
    except _EXPECTED as exc:
        _raise_http(exc)


def leave_team(
    team_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    try:
        svc.leave_team(db, team_id, current_user.id)
    except _EXPECTED as exc:
        _raise_http(exc)