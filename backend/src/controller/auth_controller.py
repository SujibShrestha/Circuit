from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from src.api.deps import get_current_user
from src.core.security import create_access_token
from src.db.session import get_db
from src.models.user import User
from src.schema.user import UserCreate, UserOut
from src.services import auth_service


def register(payload:UserCreate, db: Session= Depends(get_db)):
    try: 
        user = auth_service.register_user(db, payload)
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except auth_service.EmailAlreadyExistsError as e:
        raise HTTPException(status_code=400, detail=str(e))


def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = auth_service.authenticate_user(db, form_data.username, form_data.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(user.id, user.role.value)
    return {"access_token": token, "token_type": "bearer"}


def me(current_user: User = Depends(get_current_user)):
    return current_user