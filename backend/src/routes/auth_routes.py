from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from src.api.deps import get_current_user
from src.controller.auth_controller import register, login
from src.db.session import get_db
from src.models.user import User
from src.schema.user import UserCreate, UserOut

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register_route(payload: UserCreate, db: Session = Depends(get_db)):
    return register(payload, db)


@router.post("/login")
def login_route(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    print("Login route called with username:", form_data.username)
    return login(form_data, db)


@router.get("/me", response_model=UserOut)
def me_route(current_user: User = Depends(get_current_user)):
    return current_user