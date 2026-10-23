
from fastapi import Depends, HTTPException, status
from src.db.session import get_db
from sqlalchemy.orm import Session
from src.schema.team import TeamCreate, TeamOut
from src.models.user import User
from src.services import team_service


def create(payload:TeamCreate, current_user: User, db: Session = Depends(get_db)) -> TeamOut:
    try:
        team = team_service.create_team(db, payload, current_user.id)
    except (team_service.EventNotFoundError, team_service.TeamsNotAllowedError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except team_service.EventEndedError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except team_service.NotRegisteredError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    except team_service.AlreadyInTeamError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    except team_service.TeamNameTakenError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    if not team:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create team.",
        )
    return TeamOut.model_validate(team)